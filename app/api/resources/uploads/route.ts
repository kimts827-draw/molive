import { z } from "zod";
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

/**
 * 이미지 파일 본문은 이 함수를 지나지 않는다.
 * Vercel Function의 요청 본문 한도(4.5MB) 때문에 큰 이미지가 라우트 실행 전에 413으로 끊겼기 때문에,
 * 여기서는 관리자 인증 후 Storage 업로드 토큰만 발급하고 파일은 브라우저가 Storage로 직접 올린다.
 * 토큰 발급에는 storage.objects insert 권한이 필요한데 resource-assets에는 anon/authenticated 정책이
 * 없으므로, service_role을 쓰는 이 라우트를 통과한 관리자만 업로드할 수 있다.
 */
const schema = z.object({
  board: resourceBoardKeySchema,
  contentType: z.string().trim().min(1).max(100),
  size: z.number().int().positive(),
});

export async function POST(request: Request) {
  try {
    await requireResourceAdminApi();

    const input = schema.parse(await request.json());
    if (input.size > RESOURCE_IMAGE_MAX_BYTES) throw new ApiError(413, "이미지는 10MB 이하만 업로드할 수 있습니다.");

    const extension = resourceImageExtension(input.contentType);
    if (!extension) throw new ApiError(415, "PNG, JPG, WebP, AVIF 이미지만 업로드할 수 있습니다.");

    const path = buildResourceImagePath(input.board, crypto.randomUUID(), extension);
    const client = createAdminClient();
    const { data, error } = await client.storage.from(RESOURCE_ASSET_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new ApiError(502, "이미지 업로드 주소를 발급하지 못했습니다.");

    const { data: publicUrl } = client.storage.from(RESOURCE_ASSET_BUCKET).getPublicUrl(path);
    return Response.json({ path: data.path, token: data.token, publicUrl: publicUrl.publicUrl }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export const dynamic = "force-dynamic";
