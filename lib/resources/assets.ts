import { RESOURCE_BOARD_KEYS, type ResourceBoardKey } from "./board.ts";

/** 자료실 대표 이미지 전용 public 버킷. 쓰기는 service_role(관리자 서버 라우트)만 가능하다. */
export const RESOURCE_ASSET_BUCKET = "resource-assets";

export const RESOURCE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/** 업로드를 허용하는 이미지 형식과 저장 확장자. */
export const RESOURCE_IMAGE_TYPES: Readonly<Record<string, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
};

export const RESOURCE_IMAGE_ACCEPT = Object.keys(RESOURCE_IMAGE_TYPES).join(",");

export function resourceImageExtension(mimeType: string): string | null {
  return RESOURCE_IMAGE_TYPES[mimeType.trim().toLowerCase()] ?? null;
}

/** 게시판별 폴더 하나만 사용한다. 경로에 사용자 입력을 넣지 않아 경로 조작이 불가능하다. */
export function buildResourceImagePath(board: ResourceBoardKey, fileId: string, extension: string) {
  if (!RESOURCE_BOARD_KEYS.includes(board)) throw new Error(`알 수 없는 자료실 게시판입니다: ${board}`);
  if (!/^[0-9a-f-]{36}$/.test(fileId)) throw new Error("이미지 파일 식별자가 올바르지 않습니다.");
  if (!Object.values(RESOURCE_IMAGE_TYPES).includes(extension)) throw new Error("지원하지 않는 이미지 형식입니다.");
  return `${board}/${fileId}.${extension}`;
}
