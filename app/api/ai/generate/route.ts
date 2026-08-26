import { z } from "zod";
import { errorResponse, requireApiUser } from "@/lib/api/auth";
import { isAssetSessionPath, validateAttachmentScope } from "@/lib/assets/asset-policy";
import { createGeneratedImageStore } from "@/lib/assets/generated-asset-store";
import { createImageProbe } from "@/lib/assets/image-probe";
import { generateProjectSource } from "@/lib/openai/site-generator";
import { attachGenerationUsageToProject, createGenerationUsageRecorder } from "@/lib/openai/usage-store";
import { createProjectWithVersion } from "@/lib/projects/service";
import { hasSupabaseServerConfig, isSupabaseDemoMode, missingSupabaseServerEnv } from "@/lib/supabase/config";
import { commitAiCredits, releaseAiCredits, reserveAiCredits } from "@/lib/credits/service";

const assetUrl = z.string().refine((value) => value.startsWith("https://") || /^data:image\/(jpeg|png|webp|avif);base64,/.test(value), "지원하지 않는 이미지 형식입니다.");
const requestSchema = z.object({ prompt: z.string().min(10).max(5000), brandName: z.string().max(120).optional(), colors: z.array(z.string()).max(8).optional(), assetSessionId: z.uuid().optional(), assetUrls: z.array(assetUrl).max(6).optional(), assetPaths: z.array(z.string().max(500)).max(6).optional(), assetRoles: z.array(z.enum(["logo", "product", "reference", "image"])).max(6).optional() });

export async function POST(request: Request) {
  try {
    if (!hasSupabaseServerConfig() && !isSupabaseDemoMode()) {
      return Response.json({ error: `영구 저장 설정이 완료되지 않았습니다. 누락된 환경변수: ${missingSupabaseServerEnv().join(", ")}` }, { status: 503 });
    }
    const user = await requireApiUser(request);
    if (hasSupabaseServerConfig() && (user.id === "public-demo-user" || user.id === "local-development-user")) {
      return Response.json({ error: "프로젝트를 저장하려면 로그인해 주세요." }, { status: 401 });
    }
    const parsedInput = requestSchema.safeParse(await request.json());
    if (!parsedInput.success) return Response.json({ error: "요청 데이터 형식이 올바르지 않습니다.", issues: parsedInput.error.issues }, { status: 400 });
    // 이번 생성 세션 밖의 저장 이미지가 첨부로 들어오면 생성을 시작하지 않습니다.
    const scope = validateAttachmentScope({ ownerId: user.id, sessionId: parsedInput.data.assetSessionId, assetUrls: parsedInput.data.assetUrls, assetPaths: parsedInput.data.assetPaths });
    if (!scope.ok) return Response.json({ error: scope.message }, { status: 400 });
    let creditReservation: Awaited<ReturnType<typeof reserveAiCredits>> | null = null;
    let creditCommitted = false;
    try {
      if (hasSupabaseServerConfig()) creditReservation = await reserveAiCredits(user.id, "design_generation");
      const generationId = crypto.randomUUID();
      const onUsage = hasSupabaseServerConfig() ? createGenerationUsageRecorder({ generationId, userId: user.id, usageType: "design_generation" }) : undefined;
      const onPreviewImageUsage = hasSupabaseServerConfig() ? createGenerationUsageRecorder({ generationId, userId: user.id, usageType: "preview_image" }) : undefined;
      // Preview 상품 사진은 이번 이미지 세션 폴더에만 저장합니다. 첨부가 없으면 이번 생성 id가 세션이 됩니다.
      const previewImages = createGeneratedImageStore({ ownerId: user.id, sessionId: parsedInput.data.assetSessionId ?? generationId });
      const result = await generateProjectSource(parsedInput.data, { onUsage, onPreviewImageUsage, previewImageStore: previewImages.store, imageProbe: createImageProbe() });
      if (!hasSupabaseServerConfig()) return Response.json({ ...result, persistenceMode: "demo" });
      const stored = await createProjectWithVersion(user.id, result.source, {
        prompt: parsedInput.data.prompt,
        brandName: parsedInput.data.brandName ?? null,
        colors: parsedInput.data.colors ?? [],
        assetCount: parsedInput.data.assetUrls?.length ?? 0,
      });
      try {
        await attachGenerationUsageToProject({ generationId, userId: user.id, projectId: stored.projectId });
      } catch (error) {
        console.error("OpenAI usage project link failed", error instanceof Error ? error.message : "unknown error");
      }
      const sessionId = parsedInput.data.assetSessionId;
      const assetRows = (parsedInput.data.assetPaths ?? []).flatMap((storagePath, index) => {
        if (!storagePath || !sessionId || !isAssetSessionPath(storagePath, user.id, sessionId)) return [];
        const role = parsedInput.data.assetRoles?.[index] ?? "reference";
        return [{ project_id: stored.projectId, owner_id: user.id, kind: role === "image" ? "reference" : role, storage_path: storagePath, mime_type: "image/webp", metadata: { source: "generation-upload", asset_session_id: sessionId } }];
      });
      // 이번 생성에서 만든 Preview 사진도 이 프로젝트 자산으로 연결합니다.
      const generatedRows = previewImages.saved.map((asset) => ({ project_id: stored.projectId, owner_id: user.id, kind: "generated", storage_path: asset.storagePath, mime_type: "image/webp", metadata: { source: "preview-product-image", generation_id: generationId } }));
      const allRows = [...assetRows, ...generatedRows];
      if (allRows.length) {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const { error } = await createAdminClient().from("project_assets").insert(allRows);
        if (error) throw error;
      }
      const balance = creditReservation ? await commitAiCredits(creditReservation.id, user.id, stored.projectId) : null;
      creditCommitted = true;
      return Response.json({ ...result, ...stored, balance });
    } catch (error) {
      if (error instanceof z.ZodError) return Response.json({ error: "AI 디자인 결과를 Project Source로 변환하지 못했습니다. 다시 시도해 주세요." }, { status: 422 });
      throw error;
    } finally {
      if (creditReservation && !creditCommitted) {
        try { await releaseAiCredits(creditReservation.id, user.id); }
        catch (releaseError) { console.error("Credit reservation release failed", releaseError instanceof Error ? releaseError.message : "unknown error"); }
      }
    }
  } catch (error) { return errorResponse(error); }
}
