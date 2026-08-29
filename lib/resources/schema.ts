import { z } from "zod";
import { RESOURCE_BOARD_KEYS, type ResourceBoardKey } from "./board.ts";

export const resourceBoardKeySchema = z.enum(RESOURCE_BOARD_KEYS as [ResourceBoardKey, ...ResourceBoardKey[]]);

const title = z.string().trim().min(1).max(160);
const summary = z.string().trim().max(300);
const content = z.string().trim().max(20000);
const category = z.string().trim().min(1).max(60);
const brandColor = z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, "브랜드 컬러는 #RRGGBB 형식이어야 합니다.");
const prompt = z.string().trim().min(1).max(4000);
const imageUrl = z.string().trim().min(1).max(500).regex(/^(?:\/|https:\/\/)/, "대표 이미지는 / 로 시작하는 경로이거나 https:// URL이어야 합니다.");

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
