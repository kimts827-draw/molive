/**
 * Preview 전용 상품 mock입니다.
 *
 * Cafe24 export는 이 파일을 전혀 쓰지 않습니다. Export는 ProductCardV1의 Cafe24 template과
 * {$image_medium} 등 실제 상품 binding을 그대로 내보냅니다. 여기 있는 값은 Editor Preview에서만
 * 자리표시로 쓰이며, 이미지는 이번 생성/세션 자산이거나 이번 생성에서 그린 도형뿐입니다.
 * 이전 프로젝트의 mock 상품 데이터는 어떤 경로로도 재사용하지 않습니다.
 */

import { svgDataUri } from "../assets/fallback-image.ts";

/** Preview 카드 하나에 바인딩되는 해석 완료된 mock 값입니다. */
export type PreviewProductMock = {
  /** 이번 생성의 업종/컨셉에 맞춘 Preview 전용 샘플 상품명입니다. 실제 상품 데이터가 아닙니다. */
  name: string;
  /** 이번 세션 첨부 주소이거나 이번 생성에서 만든 data: 이미지입니다. */
  image: string;
};

/** AI가 돌려주는 Preview mock 초안입니다. imageRef는 asset://N 또는 빈 문자열입니다. */
export type PreviewProductDraft = { name?: string; imageRef?: string };

/** 생성한 상품 타일에 쓰는 프로젝트 팔레트입니다. */
export type PreviewProductPalette = { background?: string; accent?: string; ink?: string };

const DEFAULT_PALETTE: Required<PreviewProductPalette> = { background: "#efece6", accent: "#cdc7bb", ink: "#4a463f" };

/** 실제 상품 값을 지어내지 않기 위해 Preview 가격 자리에 쓰는 고정 문구입니다. */
export const PREVIEW_PRICE_LABEL = "Cafe24 상품 가격";

/** 업종 정보가 없을 때 쓰는 중립 상품명입니다. */
export function neutralProductName(index: number) {
  return `상품명 ${String(index + 1).padStart(2, "0")}`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function safeColor(value: string | undefined, fallback: string) {
  return value && /^#[0-9a-f]{3,8}$|^rgb|^hsl/i.test(value.trim()) ? value.trim() : fallback;
}

/** index마다 구도를 바꿔 네 카드가 같은 타일로 보이지 않게 합니다. */
const TILE_SHAPES = [
  '<rect x="250" y="250" width="400" height="400" rx="24" fill="__ACCENT__" opacity="0.34"/>',
  '<circle cx="450" cy="430" r="210" fill="__ACCENT__" opacity="0.34"/>',
  '<path d="M240 640l150-260 130 120 120-190 120 330z" fill="__ACCENT__" opacity="0.34"/>',
  '<rect x="230" y="300" width="440" height="260" rx="130" fill="__ACCENT__" opacity="0.34"/>',
] as const;

/**
 * 이번 생성에서 그리는 상품 타일입니다. 외부 자산을 전혀 참조하지 않는 data: URI라서
 * 다른 프로젝트 이미지가 섞일 수 없고, 프로젝트 팔레트와 샘플 상품명을 그대로 씁니다.
 */
export function createPreviewProductImage(input: { label: string; index?: number; palette?: PreviewProductPalette }) {
  const palette = {
    background: safeColor(input.palette?.background, DEFAULT_PALETTE.background),
    accent: safeColor(input.palette?.accent, DEFAULT_PALETTE.accent),
    ink: safeColor(input.palette?.ink, DEFAULT_PALETTE.ink),
  };
  const shape = TILE_SHAPES[Math.abs(input.index ?? 0) % TILE_SHAPES.length].replaceAll("__ACCENT__", palette.accent);
  const label = escapeXml(input.label.trim().slice(0, 22));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 900"><rect width="900" height="900" fill="${palette.background}"/>${shape}<text x="450" y="790" text-anchor="middle" font-family="system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif" font-size="42" fill="${palette.ink}">${label}</text></svg>`;
  return svgDataUri(svg);
}

/** asset://N 참조를 이번 요청의 첨부 주소로만 해석합니다. 범위를 벗어나면 쓰지 않습니다. */
function resolveDraftImage(imageRef: string | undefined, assetUrls: readonly string[]) {
  const index = imageRef?.trim().match(/^asset:\/\/(\d+)$/)?.[1];
  if (index === undefined) return null;
  return assetUrls[Number(index)] ?? null;
}

/**
 * AI 초안을 Preview mock으로 확정합니다.
 * 이미지는 이번 세션 첨부이거나 이번 생성에서 그린 타일뿐이고, 그 외 주소는 버립니다.
 */
export function resolvePreviewProducts(input: {
  drafts?: readonly PreviewProductDraft[];
  assetUrls?: readonly string[];
  palette?: PreviewProductPalette;
  count?: number;
}): PreviewProductMock[] {
  const count = input.count ?? 4;
  const assetUrls = input.assetUrls ?? [];
  return Array.from({ length: count }, (_value, index) => {
    const draft = input.drafts?.[index];
    const name = draft?.name?.trim() || neutralProductName(index);
    return {
      name,
      image: resolveDraftImage(draft?.imageRef, assetUrls) ?? createPreviewProductImage({ label: name, index, palette: input.palette }),
    };
  });
}

/** 저장된 Preview mock을 카드 개수에 맞춰 채웁니다. mock이 없으면 중립 타일로 되돌아갑니다. */
export function previewProductAt(products: readonly PreviewProductMock[] | undefined, index: number): PreviewProductMock {
  const stored = products?.[index];
  if (stored?.name && stored.image) return stored;
  const name = neutralProductName(index);
  return { name, image: createPreviewProductImage({ label: name, index }) };
}

export function isPreviewProductMock(value: unknown): value is PreviewProductMock {
  const mock = value as Partial<PreviewProductMock> | null;
  return Boolean(mock && typeof mock === "object" && typeof mock.name === "string" && typeof mock.image === "string");
}
