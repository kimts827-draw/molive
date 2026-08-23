import { z } from "zod";
import { errorResponse, requireApiUser } from "@/lib/api/auth";
import { editProjectNode } from "@/lib/openai/site-generator";

const requestSchema = z.object({
  prompt: z.string().min(2).max(3000),
  nodeId: z.string().min(1).max(180),
  nodeType: z.string().min(1).max(80),
  nodeHtml: z.string().min(10).max(120000),
  projectCss: z.string().max(180000),
  rootValue: z.string().min(1).max(180),
  architecture: z.object({ header: z.string(), hero: z.string(), sections: z.array(z.string()), productPresentation: z.string(), typography: z.string(), footer: z.string() }),
});

export async function POST(request: Request) {
  try {
    await requireApiUser(request);
    const parsedInput = requestSchema.safeParse(await request.json());
    if (!parsedInput.success) return Response.json({ error: "요청 데이터 형식이 올바르지 않습니다.", issues: parsedInput.error.issues }, { status: 400 });
    try {
      const result = await editProjectNode(parsedInput.data);
      return Response.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) return Response.json({ error: "AI 수정 결과를 선택 영역 patch로 변환하지 못했습니다. 다시 시도해 주세요." }, { status: 422 });
      throw error;
    }
  } catch (error) { return errorResponse(error); }
}
