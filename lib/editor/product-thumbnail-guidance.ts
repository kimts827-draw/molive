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

export function productThumbnailGuidance(presentation: string, thumbRatioOverride?: string): ProductThumbnailGuidance {
  const base = GUIDANCE[presentation] ?? { label: "기본 상품 진열", ratio: "1:1", size: "1000 × 1000px" };
  const override = thumbRatioOverride ? overrideGuidance(thumbRatioOverride) : null;
  if (!override) return base;
  return {
    ...base,
    ...override,
    note: `현재 Editor에 적용된 ${override.ratio} 비율 기준입니다.`,
  };
}
