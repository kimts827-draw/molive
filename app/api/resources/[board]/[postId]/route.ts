import { z } from "zod";
import { requireResourceAdminApi } from "@/lib/admin/auth";
import { ApiError, errorResponse } from "@/lib/api/auth";
import { resourceBoardKeySchema, resourcePostSchema } from "@/lib/resources/schema";
import { deleteResourcePost, updateResourcePost } from "@/lib/resources/service";

async function readParams(context: { params: Promise<{ board: string; postId: string }> }) {
  const params = await context.params;
  return { board: resourceBoardKeySchema.parse(params.board), postId: z.uuid().parse(params.postId) };
}

export async function PATCH(request: Request, context: { params: Promise<{ board: string; postId: string }> }) {
  try {
    await requireResourceAdminApi();
    const { board, postId } = await readParams(context);
    const input = resourcePostSchema(board).parse(await request.json());
    const post = await updateResourcePost(board, postId, input);
    if (!post) throw new ApiError(404, "게시글을 찾을 수 없습니다.");
    return Response.json({ post });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ board: string; postId: string }> }) {
  try {
    await requireResourceAdminApi();
    const { board, postId } = await readParams(context);
    if (!await deleteResourcePost(board, postId)) throw new ApiError(404, "게시글을 찾을 수 없습니다.");
    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export const dynamic = "force-dynamic";
