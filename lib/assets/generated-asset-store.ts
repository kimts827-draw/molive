import "server-only";
import { buildAssetSessionPath } from "@/lib/assets/asset-policy";
import type { GeneratedImageBytes, GeneratedImageStore } from "@/lib/openai/preview-image-generator";
import { hasSupabaseServerConfig } from "@/lib/supabase/config";

export type StoredGeneratedAsset = { storagePath: string; url: string };

/**
 * 이번 생성에서 만든 이미지를 이번 이미지 세션 폴더에만 저장합니다.
 * 저장 경로가 세션 밖으로 나갈 수 없으므로 다른 프로젝트가 이 사진을 물려받는 경로도 없습니다.
 * Supabase 저장소가 없으면 세션 밖으로 나가지 않는 data: URI로 대신합니다.
 */
export function createGeneratedImageStore(input: { ownerId: string; sessionId: string }) {
  const saved: StoredGeneratedAsset[] = [];

  const store: GeneratedImageStore = async (image: GeneratedImageBytes) => {
    if (!hasSupabaseServerConfig()) {
      return `data:${image.contentType};base64,${image.data.toString("base64")}`;
    }
    const storagePath = buildAssetSessionPath(input.ownerId, input.sessionId, "generated", `${image.kind}-${image.index}-${crypto.randomUUID()}`);
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const client = createAdminClient();
    const { error } = await client.storage.from("project-assets").upload(storagePath, image.data, { contentType: image.contentType, upsert: false });
    if (error) throw new Error(`생성 이미지 저장 실패: ${error.message}`);
    const { data } = client.storage.from("project-assets").getPublicUrl(storagePath);
    saved.push({ storagePath, url: data.publicUrl });
    return data.publicUrl;
  };

  return { store, saved };
}
