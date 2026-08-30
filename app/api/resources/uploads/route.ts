import { requireResourceAdminApi } from "@/lib/admin/auth";
import { ApiError, errorResponse } from "@/lib/api/auth";
import {
  RESOURCE_ASSET_BUCKET,
  RESOURCE_IMAGE_MAX_BYTES,
  buildResourceImagePath,
  resourceImageExtension,
} from "@/lib/resources/assets";
import { resourceBoardKeySchema } from "@/lib/resources/schema";
import { createAdminClient } from "@/lib/supabase/admin";

/** 자료실 대표 이미지 업로드. 관리자 세션을 먼저 검증한 뒤에만 파일을 읽는다. */
export async function POST(request: Request) {
  try {
    await requireResourceAdminApi();

    const form = await request.formData();
    const board = resourceBoardKeySchema.parse(form.get("board"));
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "업로드할 이미지 파일이 없습니다.");
    if (file.size === 0) throw new ApiError(400, "빈 파일은 업로드할 수 없습니다.");
    if (file.size > RESOURCE_IMAGE_MAX_BYTES) throw new ApiError(413, "이미지는 10MB 이하만 업로드할 수 있습니다.");

    const extension = resourceImageExtension(file.type);
    if (!extension) throw new ApiError(415, "PNG, JPG, WebP, AVIF 이미지만 업로드할 수 있습니다.");

    const path = buildResourceImagePath(board, crypto.randomUUID(), extension);
    const client = createAdminClient();
    const { error } = await client.storage
      .from(RESOURCE_ASSET_BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
    if (error) throw new ApiError(502, "이미지를 저장하지 못했습니다.");

    const { data } = client.storage.from(RESOURCE_ASSET_BUCKET).getPublicUrl(path);
    return Response.json({ imageUrl: data.publicUrl }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export const dynamic = "force-dynamic";
