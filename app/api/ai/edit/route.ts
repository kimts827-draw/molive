import { z } from "zod";
import { errorResponse, requireApiUser } from "@/lib/api/auth";
import { editProjectNode } from "@/lib/openai/site-generator";
import { createGenerationUsageRecorder } from "@/lib/openai/usage-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseServerConfig } from "@/lib/supabase/config";
import { commitAiCredits, releaseAiCredits, reserveAiCredits } from "@/lib/credits/service";

const requestSchema = z.object({
  prompt: z.string().min(2).max(3000),
  nodeId: z.string().min(1).max(500),
  nodeType: z.string().min(1).max(200),
  nodeHtml: z.string().min(10).max(400000),
  projectCss: z.string().max(600000),
  rootValue: z.string().min(1).max(500),
  architecture: z.object({ header: z.string(), hero: z.string(), sections: z.array(z.string()), productPresentation: z.string(), typography: z.string(), footer: z.string() }),
  renderMetrics: z.object({ width: z.number().finite().nonnegative(), height: z.number().finite().nonnegative(), fontSize: z.number().finite().nonnegative(), lineHeight: z.number().finite().nonnegative(), letterSpacing: z.number().finite(), marginTop: z.number().finite(), marginBottom: z.number().finite(), paddingTop: z.number().finite(), paddingBottom: z.number().finite() }).optional(),
  projectId: z.uuid().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    if (hasSupabaseServerConfig() && (user.id === "public-demo-user" || user.id === "local-development-user")) {
      return Response.json({ error: "AI 수정에는 로그인이 필요합니다." }, { status: 401 });
    }
    const parsedInput = requestSchema.safeParse(await request.json());
    if (!parsedInput.success) {
      const firstIssue = parsedInput.error.issues[0];
      const field = firstIssue?.path.join(".") || "요청";
      return Response.json({ error: `AI 수정 요청의 ${field} 값을 확인해 주세요.`, issues: parsedInput.error.issues }, { status: 400 });
    }
    const projectId = parsedInput.data.projectId ?? null;
    if (projectId && hasSupabaseServerConfig()) {
      const { data: ownedProject, error } = await createAdminClient().from("projects").select("id").eq("id", projectId).eq("owner_id", user.id).maybeSingle();
      if (error) throw error;
      if (!ownedProject) return Response.json({ error: "프로젝트에 접근할 수 없습니다." }, { status: 403 });
    }
    let creditReservation: Awaited<ReturnType<typeof reserveAiCredits>> | null = null;
    let creditCommitted = false;
    try {
      if (hasSupabaseServerConfig()) creditReservation = await reserveAiCredits(user.id, "editor_ai", projectId);
      const onUsage = hasSupabaseServerConfig() ? createGenerationUsageRecorder({ generationId: crypto.randomUUID(), userId: user.id, projectId, usageType: "editor_ai" }) : undefined;
      const result = await editProjectNode(parsedInput.data, { onUsage });
      const balance = creditReservation ? await commitAiCredits(creditReservation.id, user.id, projectId) : null;
      creditCommitted = true;
      return Response.json({ ...result, balance });
    } catch (error) {
      if (error instanceof z.ZodError) return Response.json({ error: "AI 수정 결과를 선택 영역 patch로 변환하지 못했습니다. 다시 시도해 주세요." }, { status: 422 });
      throw error;
    } finally {
      if (creditReservation && !creditCommitted) {
        try { await releaseAiCredits(creditReservation.id, user.id); }
        catch (releaseError) { console.error("Credit reservation release failed", releaseError instanceof Error ? releaseError.message : "unknown error"); }
      }
    }
  } catch (error) { return errorResponse(error); }
}
