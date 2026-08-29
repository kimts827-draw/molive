import { requireResourceAdminApi } from "@/lib/admin/auth";
import { errorResponse } from "@/lib/api/auth";
import { resourceBoardKeySchema, resourcePostSchema } from "@/lib/resources/schema";
import { createResourcePost } from "@/lib/resources/service";

export async function POST(request: Request, context: { params: Promise<{ board: string }> }) {
  try {
    const admin = await requireResourceAdminApi();
    const board = resourceBoardKeySchema.parse((await context.params).board);
    const input = resourcePostSchema(board).parse(await request.json());
    const post = await createResourcePost(board, input, admin);
    return Response.json({ post }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET() {
  return Response.json({ error: "지원하지 않는 메서드입니다." }, { status: 405 });
}

export const dynamic = "force-dynamic";
