import { isProductDisplayId, productDisplayOf } from "../commerce/product-display.ts";

export type ProductThumbnailGuidance = {
  label: string;
  ratio: string;
  size: string;
  note?: string;
};

const GUIDANCE: Record<string, ProductThumbnailGuidance> = {
  "grid-four": { label: "4열 그리드", ratio: "1:1", size: "1000 × 1000px" },
  "large-grid": { label: "대형 그리드", ratio: "4:5", size: "1200 × 1500px" },
  "editorial-two": { label: "에디토리얼 2열", ratio: "3:4", size: "1200 × 1600px" },
  "featured-grid": { label: "대표 상품 + 그리드", ratio: "4:5 / 1:1", size: "대표 1200 × 1500px · 나머지 1000 × 1000px", note: "첫 상품은 세로형, 나머지는 정사각형을 권장합니다." },
  "compact-five": { label: "콤팩트 5열", ratio: "1:1", size: "800 × 800px" },
};

/** 열 수에 따른 카드 폭 기준 권장 가로 크기입니다. 비율은 강제하지 않습니다. */
const DISPLAY_WIDTH: Record<number, string> = { 3: "가로 1200px 이상", 4: "가로 1000px 이상", 5: "가로 800px 이상" };

/**
 * Cafe24 원본 전시 12종의 안내입니다.
 * reference 12종에는 크롭(aspect-ratio/object-fit)이 전혀 없어 {$image_medium} 원본 비율이
 * 그대로 노출됩니다. 그래서 비율을 지정하지 않고 "원본 비율"로만 안내합니다.
 */
function displayGuidance(id: string): ProductThumbnailGuidance {
  const display = productDisplayOf(id);
  const mode = display.mode === "slide" ? "슬라이드" : "그리드";
  const style = display.style === "gallery" ? "이미지강조형" : "일반형";
  const notes = [
    display.mode === "slide"
      ? `PC에서 ${display.columns}개가 보이고 나머지는 좌우로 넘어갑니다.`
      : `PC ${display.columns}열 / 모바일 ${display.columns === 5 ? 3 : 2}열로 진열됩니다.`,
    display.style === "gallery"
      ? "상품명과 가격이 이미지 위에 겹쳐 보이므로 아래쪽이 단순한 컷을 권장합니다."
      : "",
    "Cafe24 원본과 같이 이미지를 자르지 않고 원본 비율 그대로 노출합니다.",
  ].filter(Boolean);
  return {
    label: `${mode} ${display.columns}단 · ${style}`,
    ratio: "원본 비율",
    size: `${DISPLAY_WIDTH[display.columns]} · 모든 상품 같은 비율 권장`,
    note: notes.join(" "),
  };
}

function overrideGuidance(ratioValue: string) {
  const match = ratioValue.trim().replace(/s+/g, "").match(/^(\d+(?:\.\d+)?)[:/](\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const widthRatio = Number(match[1]);
  const heightRatio = Number(match[2]);
  if (!(widthRatio > 0 && heightRatio > 0)) return null;
  const ratio = `${Number(widthRatio.toFixed(2))}:${Number(heightRatio.toFixed(2))}`;
  if (widthRatio === heightRatio) return { ratio, size: "1000 × 1000px" };
  const base = 1200;
  const width = widthRatio < heightRatio ? base : Math.round(base * widthRatio / heightRatio);
  const height = widthRatio < heightRatio ? Math.round(base * heightRatio / widthRatio) : base;
  return { ratio, size: `${width} × ${height}px` };
}

/**
 * 상품 전시가 Cafe24 원본 12종으로 정해져 있으면 그 안내가 우선합니다.
 * 그 경로는 크롭을 쓰지 않으므로 썸네일 비율 override도 반영하지 않습니다.
 */
export function productThumbnailGuidance(presentation: string, thumbRatioOverride?: string, productDisplay?: string): ProductThumbnailGuidance {
  if (isProductDisplayId(productDisplay)) return displayGuidance(productDisplay);
  const base = GUIDANCE[presentation] ?? { label: "기본 상품 진열", ratio: "1:1", size: "1000 × 1000px" };
  const override = thumbRatioOverride ? overrideGuidance(thumbRatioOverride) : null;
  if (!override) return base;
  return {
    ...base,
    ...override,
    note: `현재 Editor에 적용된 ${override.ratio} 비율 기준입니다.`,
  };
}
