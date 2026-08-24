import { buildAssetSessionPath, buildProjectAssetPath, type AssetKind } from "@/lib/assets/asset-policy";

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 560 * 1024;
const MAX_EDGE = 1600;

function dataUrlToBlob(dataUrl: string) {
  const [header, encoded] = dataUrl.split(",", 2);
  const mime = header.match(/^data:([^;]+);base64$/)?.[1];
  if (!mime || !encoded) throw new Error("이미지 데이터 형식이 올바르지 않습니다.");
  const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("이미지를 변환하지 못했습니다.")), "image/webp", quality);
  });
}

export async function optimizeImageFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 업로드할 수 있습니다.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("이미지는 파일당 12MB 이하만 업로드할 수 있습니다.");

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    await image.decode();

    const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이미지 편집기를 초기화하지 못했습니다.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    let quality = 0.86;
    let blob = await canvasToBlob(canvas, quality);
    while (blob.size > MAX_OUTPUT_BYTES && quality > 0.45) {
      quality -= 0.1;
      blob = await canvasToBlob(canvas, quality);
    }
    return blobToDataUrl(blob);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** 생성 요청 하나가 쓰는 이미지 세션 식별자입니다. 요청이 끝나면 새 세션으로 갈아 끼웁니다. */
export function createAssetSessionId() {
  return crypto.randomUUID();
}

/**
 * 업로드 이미지를 이번 이미지 세션이나 현재 프로젝트 폴더에만 저장합니다.
 * 계정 공용 staging 폴더를 쓰지 않으므로 이전 프로젝트 이미지와 경로가 섞이지 않습니다.
 */
export async function persistProjectAsset(dataUrl: string, kind: "logo" | "image", scope: { sessionId: string } | { projectId: string }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null;
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("이미지를 영구 저장하려면 먼저 로그인해 주세요.");
  const assetKind: AssetKind = kind;
  const path = "projectId" in scope
    ? buildProjectAssetPath(user.id, scope.projectId, assetKind, crypto.randomUUID())
    : buildAssetSessionPath(user.id, scope.sessionId, assetKind, crypto.randomUUID());
  const { error } = await supabase.storage.from("project-assets").upload(path, dataUrlToBlob(dataUrl), { contentType: "image/webp", upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("project-assets").getPublicUrl(path);
  return { url: data.publicUrl, storagePath: path };
}
