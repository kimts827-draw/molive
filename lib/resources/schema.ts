import { z } from "zod";
import { RESOURCE_BOARD_KEYS, type ResourceBoardKey } from "./board.ts";
import { RESOURCE_ASSET_BUCKET } from "./assets.ts";

export const resourceBoardKeySchema = z.enum(RESOURCE_BOARD_KEYS as [ResourceBoardKey, ...ResourceBoardKey[]]);

const title = z.string().trim().min(1).max(160);
const summary = z.string().trim().max(300);
const content = z.string().trim().max(20000);
const category = z.string().trim().min(1).max(60);
const brandColor = z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, "브랜드 컬러는 #RRGGBB 형식이어야 합니다.");
const prompt = z.string().trim().min(1).max(4000);
/**
 * 대표 이미지는 두 가지만 허용한다.
 *  1. 저장소에 함께 배포된 seed 이미지 경로(/templates/*.png 등)
 *  2. 관리자 업로드 라우트가 만든 resource-assets 버킷의 public 주소
 * 관리자라도 임의의 외부 URL을 직접 저장할 수 없다.
 */
const imageUrl = z.string().trim().min(1).max(500).regex(
  new RegExp(`^(?:/(?!/)|https://[^/]+/storage/v\\d+/object/public/${RESOURCE_ASSET_BUCKET}/)`),
  "대표 이미지는 내장 경로이거나 업로드한 이미지 주소여야 합니다.",
);

const articlePostSchema = z.object({
  title,
  summary: summary.optional().default(""),
  content: content.min(1),
  imageUrl: imageUrl.optional().nullable(),
});

const templatePostSchema = z.object({
  title,
  summary: summary.optional().default(""),
  category,
  brandColor,
  prompt,
  imageUrl,
});

export type ResourceArticleInput = z.infer<typeof articlePostSchema>;
export type ResourceTemplateInput = z.infer<typeof templatePostSchema>;
export type ResourcePostInput = ResourceArticleInput | ResourceTemplateInput;

export function resourcePostSchema(board: ResourceBoardKey) {
  return board === "template" ? templatePostSchema : articlePostSchema;
}
