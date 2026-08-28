/**
 * Preview 상품 샘플 사진 생성 계약입니다.
 *
 * Editor Preview의 상품 카드에만 쓰는 사진을 이번 생성에서 직접 만들어 씁니다.
 * 이전 프로젝트 이미지는 어떤 경로로도 들어오지 않고, 생성에 실패한 자리만
 * 코드가 그리는 SVG 자리표시자로 되돌아갑니다.
 * Cafe24 export는 이 파일과 무관하며 {$image_medium} 실제 상품 이미지를 그대로 씁니다.
 *
 * 상품군 보존: 사진 프롬프트에는 내부 업종 키가 아니라 page plan이 확정한
 * 사람이 읽는 업종 라벨과 판매 상품군(productCategory)이 들어갑니다.
 * 예전에는 "food-dessert" 같은 내부 키가 그대로 들어가서 "프리미엄 식품" 브리프가
 * 반복적으로 디저트·베이커리 사진으로 쏠렸습니다.
 */

import type { PreviewProductMock } from "../component-library/preview-mock.ts";

export type PreviewImagePalette = { surface?: string; accent?: string; thumbBackground?: string };

export type PreviewImageBrief = {
  /** 사람이 읽는 업종 라벨입니다(예: "프리미엄 정육"). 내부 업종 키를 넣지 않습니다. */
  industry: string;
  /** 사용자가 쓴 생성 브리프입니다. */
  brief: string;
  brandName?: string;
  /** 이 몰이 실제로 파는 상품군입니다. 사진이 다른 상품군으로 새지 않게 잠급니다. */
  productCategory?: string;
  /** 이 몰의 대표 상품 예시입니다. */
  productExamples?: readonly string[];
  palette?: PreviewImagePalette;
};

function backdropDescription(palette?: PreviewImagePalette) {
  const tone = (palette?.thumbBackground ?? palette?.surface ?? "").trim();
  return tone ? `a plain seamless studio backdrop in ${tone}` : "a plain seamless light grey studio backdrop";
}

/** 상품군을 붙잡는 공통 문장입니다. 두 프롬프트가 같은 규칙을 씁니다. */
function categoryLock(brief: PreviewImageBrief) {
  const category = brief.productCategory?.trim();
  if (!category) return [];
  const examples = (brief.productExamples ?? []).map((item) => item.trim()).filter(Boolean);
  return [
    `Product category of this store: ${category}.`,
    examples.length ? `Products this store actually sells: ${examples.join(", ")}.` : "",
    `Stay strictly inside "${category}". Do not substitute a neighbouring or more photogenic category, and do not default to desserts, bakery, coffee or flowers unless the category itself says so.`,
  ].filter(Boolean);
}

/**
 * 상품 하나의 사진 프롬프트입니다.
 * 업종 라벨·상품군·브리프·상품명을 함께 넣어 업종과 무관한 사진이 나오지 않게 합니다.
 */
export function buildPreviewImagePrompt(productName: string, brief: PreviewImageBrief) {
  const name = productName.trim();
  const brandLine = brief.brandName?.trim() ? `Store brand: ${brief.brandName.trim()}.` : "";
  return [
    "Product catalogue photograph for a Korean online store product list thumbnail.",
    `Industry: ${brief.industry}.`,
    ...categoryLock(brief),
    `Store brief: ${brief.brief.trim()}.`,
    brandLine,
    `Product: ${name}.`,
    `Photograph one real ${name}, shot straight on, centred, filling most of the frame, on ${backdropDescription(brief.palette)} with soft even lighting and a soft contact shadow.`,
    "Square 1:1 framing. Realistic commercial product photography that matches how this product actually looks in Korean retail.",
    "No text, no lettering, no logos, no watermarks, no packaging copy, no price tags, no people, no hands, no collage, no split frames, no borders.",
  ].filter(Boolean).join("\n");
}

/**
 * 깨진 일반 섹션 이미지를 대신할 사진 프롬프트입니다.
 * 상품 카드가 아니라 브랜드/무드 자리이므로 넓은 편집 사진을 요청합니다.
 */
export function buildSectionImagePrompt(label: string | undefined, brief: PreviewImageBrief) {
  const scene = label?.trim();
  const brandLine = brief.brandName?.trim() ? `Store brand: ${brief.brandName.trim()}.` : "";
  return [
    "Editorial photograph for a section of a Korean online store landing page.",
    `Industry: ${brief.industry}.`,
    ...categoryLock(brief),
    `Store brief: ${brief.brief.trim()}.`,
    brandLine,
    scene ? `Scene: ${scene}.` : "Scene: a mood image that matches this store's industry and tone.",
    "Wide landscape framing with room for the layout to crop, natural light, realistic commercial photography that fits this brand's tone.",
    "No text, no lettering, no logos, no watermarks, no captions, no collage, no split frames, no borders.",
  ].filter(Boolean).join("\n");
}

export type GeneratedPreviewPhoto = { index: number; url: string };

/**
 * 생성된 사진을 Preview mock에 채웁니다.
 * - 사용자가 첨부한 사진이 이미 붙은 자리는 그대로 둡니다(첨부가 항상 우선입니다).
 * - 생성에 성공한 자리만 사진으로 바꾸고, 실패한 자리는 SVG 자리표시자를 유지합니다.
 */
export function applyGeneratedPreviewPhotos(input: {
  products: readonly PreviewProductMock[];
  photos: readonly (GeneratedPreviewPhoto | null)[];
  /** 이번 요청의 첨부 주소입니다. 이 주소가 붙은 카드는 사진 생성 대상이 아닙니다. */
  attachmentUrls?: readonly string[];
}): PreviewProductMock[] {
  const attachments = new Set((input.attachmentUrls ?? []).map((url) => url.trim()).filter(Boolean));
  const photoByIndex = new Map((input.photos.filter(Boolean) as GeneratedPreviewPhoto[]).map((photo) => [photo.index, photo.url]));
  return input.products.map((product, index) => {
    if (attachments.has(product.image.trim())) return product;
    const url = photoByIndex.get(index);
    return url ? { ...product, image: url } : product;
  });
}

/** 첨부 사진이 이미 붙은 카드는 사진 생성 요청에서 빼기 위한 대상 목록입니다. */
export function previewPhotoTargets(input: {
  products: readonly PreviewProductMock[];
  attachmentUrls?: readonly string[];
}) {
  const attachments = new Set((input.attachmentUrls ?? []).map((url) => url.trim()).filter(Boolean));
  return input.products.flatMap((product, index) => attachments.has(product.image.trim()) ? [] : [{ index, name: product.name }]);
}
