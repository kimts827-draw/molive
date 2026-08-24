/**
 * 검증에서 깨진 것으로 확정된 일반 섹션 이미지만 고칩니다.
 *
 * - 정상 이미지와 전체 디자인은 다시 만들지 않습니다. 주소 하나만 갈아 끼웁니다.
 * - 자리마다 재생성을 딱 1회 시도하고, 그래도 안 되면 안전한 fallback으로 마감합니다.
 * - 상품 영역은 대상이 아니므로 Cafe24 binding과 상품 사진은 그대로 남습니다.
 */

import { createFallbackImage, type FallbackPalette } from "./fallback-image.ts";
import { isRepairableVerdict, replaceImageReference, type ImageCheck } from "./image-verification.ts";

/** 깨진 자리에 넣을 이미지를 새로 만들어 저장하고 주소를 돌려줍니다. 실패하면 null입니다. */
export type ImageRegenerator = (request: { url: string; label?: string; index: number }) => Promise<string | null>;

export type ImageRepairAction = {
  url: string;
  verdict: ImageCheck["verdict"];
  httpStatus?: number;
  label?: string;
  /** regenerated = 재생성 성공, fallback = 안전한 대체 이미지로 마감 */
  resolution: "regenerated" | "fallback";
  replacement: string;
};

export type ImageRepairResult = {
  html: string;
  css: string;
  actions: ImageRepairAction[];
  /** 판정을 보류해 그대로 둔 주소입니다. */
  unverified: string[];
};

/**
 * 확정 실패만 1회 재생성하고, 실패하면 fallback으로 마감합니다.
 * regenerate가 없으면(이미지 생성이 꺼져 있으면) 바로 fallback으로 갑니다.
 */
export async function repairBrokenImages(input: {
  source: { html: string; css: string };
  checks: readonly ImageCheck[];
  regenerate?: ImageRegenerator;
  palette?: FallbackPalette;
}): Promise<ImageRepairResult> {
  let html = input.source.html;
  let css = input.source.css;
  const actions: ImageRepairAction[] = [];
  const unverified = input.checks.filter((check) => check.verdict === "unverified").map((check) => check.url);
  const broken = input.checks.filter((check) => isRepairableVerdict(check.verdict));

  for (const [index, check] of broken.entries()) {
    let replacement: string | null = null;
    if (input.regenerate) {
      try {
        replacement = await input.regenerate({ url: check.url, label: check.label, index });
      } catch (error) {
        console.error("깨진 이미지 재생성 실패", error instanceof Error ? error.message : "unknown error");
        replacement = null;
      }
    }
    const resolution: ImageRepairAction["resolution"] = replacement ? "regenerated" : "fallback";
    const finalUrl = replacement ?? createFallbackImage({ palette: input.palette, seed: index });
    ({ html, css } = replaceImageReference({ html, css }, check.url, finalUrl));
    actions.push({ url: check.url, verdict: check.verdict, httpStatus: check.httpStatus, label: check.label, resolution, replacement: finalUrl });
  }

  return { html, css, actions, unverified };
}
