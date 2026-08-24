import { z } from "zod";
import { errorResponse, requireApiUser } from "@/lib/api/auth";
import { editProjectNode } from "@/lib/openai/site-generator";
import { createGenerationUsageRecorder } from "@/lib/openai/usage-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseServerConfig } from "@/lib/supabase/config";

const requestSchema = z.object({
  prompt: z.string().min(2).max(3000),
  nodeId: z.string().min(1).max(180),
  nodeType: z.string().min(1).max(80),
  nodeHtml: z.string().min(10).max(120000),
  projectCss: z.string().max(180000),
  rootValue: z.string().min(1).max(180),
  architecture: z.object({ header: z.string(), hero: z.string(), sections: z.array(z.string()), productPresentation: z.string(), typography: z.string(), footer: z.string() }),
  projectId: z.uuid().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const parsedInput = requestSchema.safeParse(await request.json());
    if (!parsedInput.success) return Response.json({ error: "요청 데이터 형식이 올바르지 않습니다.", issues: parsedInput.error.issues }, { status: 400 });
    const projectId = parsedInput.data.projectId ?? null;
    if (projectId && hasSupabaseServerConfig()) {
      const { data: ownedProject, error } = await createAdminClient().from("projects").select("id").eq("id", projectId).eq("owner_id", user.id).maybeSingle();
      if (error) throw error;
      if (!ownedProject) return Response.json({ error: "프로젝트에 접근할 수 없습니다." }, { status: 403 });
    }
    try {
      const onUsage = hasSupabaseServerConfig() ? createGenerationUsageRecorder({ generationId: crypto.randomUUID(), userId: user.id, projectId, usageType: "editor_ai" }) : undefined;
      const result = await editProjectNode(parsedInput.data, { onUsage });
      return Response.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) return Response.json({ error: "AI 수정 결과를 선택 영역 patch로 변환하지 못했습니다. 다시 시도해 주세요." }, { status: 422 });
      throw error;
    }
  } catch (error) { return errorResponse(error); }
}
