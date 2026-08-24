import { z } from "zod";
import { errorResponse, requireApiUser } from "@/lib/api/auth";
import { generateProjectSource } from "@/lib/openai/site-generator";
import { attachGenerationUsageToProject, createGenerationUsageRecorder } from "@/lib/openai/usage-store";
import { createProjectWithVersion } from "@/lib/projects/service";
import { hasSupabaseServerConfig, isSupabaseDemoMode, missingSupabaseServerEnv } from "@/lib/supabase/config";

const assetUrl = z.string().refine((value) => value.startsWith("https://") || /^data:image\/(jpeg|png|webp|avif);base64,/.test(value), "지원하지 않는 이미지 형식입니다.");
const requestSchema = z.object({ prompt: z.string().min(10).max(5000), brandName: z.string().max(120).optional(), colors: z.array(z.string()).max(8).optional(), assetUrls: z.array(assetUrl).max(6).optional(), assetPaths: z.array(z.string().max(500)).max(6).optional(), assetRoles: z.array(z.enum(["logo", "product", "reference", "image"])).max(6).optional() });

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
    try {
      const generationId = crypto.randomUUID();
      const onUsage = hasSupabaseServerConfig() ? createGenerationUsageRecorder({ generationId, userId: user.id }) : undefined;
      const result = await generateProjectSource(parsedInput.data, { onUsage });
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
      const assetRows = (parsedInput.data.assetPaths ?? []).flatMap((storagePath, index) => {
        if (!storagePath || !storagePath.startsWith(`${user.id}/`)) return [];
        const role = parsedInput.data.assetRoles?.[index] ?? "reference";
        return [{ project_id: stored.projectId, owner_id: user.id, kind: role === "image" ? "reference" : role, storage_path: storagePath, mime_type: "image/webp", metadata: { source: "generation-upload" } }];
      });
      if (assetRows.length) {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const { error } = await createAdminClient().from("project_assets").insert(assetRows);
        if (error) throw error;
      }
      return Response.json({ ...result, ...stored });
    } catch (error) {
      if (error instanceof z.ZodError) return Response.json({ error: "AI 디자인 결과를 Project Source로 변환하지 못했습니다. 다시 시도해 주세요." }, { status: 422 });
      throw error;
    }
  } catch (error) { return errorResponse(error); }
}
