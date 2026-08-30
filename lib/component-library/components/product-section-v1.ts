import { renderProductCardV1 } from "./product-card-v1.ts";
import { LEGACY_GRID_FOUR_VARIANT, PRODUCT_DISPLAY_IDS, productDisplayOf } from "../../commerce/product-display.ts";
import type { ComponentDefinition, ComponentRenderOptions, RenderTarget } from "../types.ts";

const PRODUCT_SECTION_V1_MODULE_INDEX = 1;

export const PRODUCT_SECTION_V1_CSS = `.moireProductSection.ec-base-product { margin: 0; }
.moireProductSection.ec-base-product .prdList { margin: 0 -10px; padding: 0; font-size: 0; line-height: 0; list-style: none; }
.moireProductSection.ec-base-product .prdList > li { display: inline-block; width: 25%; margin: 0 0 32px; vertical-align: top; box-sizing: border-box; }
.moireProductSection.ec-base-product .prdList .prdList__item { margin: 0 10px; }
.moireProductSection.ec-base-product .prdList .thumbnail { position: relative; width: auto; margin: 0 0 10px; text-align: center; white-space: normal; }
.moireProductSection.ec-base-product .prdList .thumbnail > a { display: block; }
.moireProductSection.ec-base-product .prdList .thumbnail a img { width: 100%; max-width: 100%; height: auto; vertical-align: middle; box-sizing: border-box; }
.moireProductSection.ec-base-product .prdList .thumbnail .prdIcon { position: absolute; inset: 0; width: 100%; height: 100%; background-repeat: no-repeat; }
.moireProductSection.ec-base-product .prdList .likeButton { position: absolute; right: 12px; bottom: 12px; z-index: 1; }
.moireProductSection.ec-base-product .prdList .icon__box { position: absolute; top: 12px; right: 12px; display: flex; flex-direction: column; gap: 12px; }
.moireProductSection.ec-base-product .prdList .icon__box span { display: block; cursor: pointer; }
.moireProductSection.ec-base-product .prdList .benefit { position: absolute; left: 0; bottom: 0; }
.moireProductSection.ec-base-product .prdList .description { margin: 20px 20px 0 0; padding: 0; font-size: 12px; line-height: 18px; text-align: left; white-space: normal; }
.moireProductSection.ec-base-product .prdList .description .name { display: block; font-weight: normal; text-align: left; }
.moireProductSection.ec-base-product .prdList .description .name a { color: #000; font-size: 13px; text-decoration: none; }
.moireProductSection.ec-base-product .spec { margin: 12px 0 0; padding: 0; list-style: none; }
.moireProductSection.ec-base-product .spec > li { margin: 0 0 14px; line-height: 19px; text-align: left; }
.moireProductSection.ec-base-product .prdList .icon { margin: 14px 0 0; text-align: left; }
.moireProductSection.ec-base-product .prdList .icon img { margin: 0 4px 0 0; max-height: 23px; vertical-align: middle; }
@media all and (min-width: 768px) and (max-width: 1024px) {
  .moireProductSection.ec-base-product .prdList { margin: 0 -8px; }
  .moireProductSection.ec-base-product .prdList > li { width: 33.3333%; }
  .moireProductSection.ec-base-product .prdList .prdList__item { margin: 0 8px; }
}
@media all and (max-width: 767px) {
  .moireProductSection.ec-base-product .prdList { margin: 0 -5px; }
  .moireProductSection.ec-base-product .prdList > li { width: 50%; }
  .moireProductSection.ec-base-product .prdList .prdList__item { margin: 0 5px; }
}`;

/**
 * Cafe24 module block입니다. 12종 전시 어디에서도 달라지지 않는 binding 계약입니다.
 * reference의 grid는 $count=100 + product_listmore, slide는 count 지정 없음이지만
 * MOLIVE는 실몰에서 검증·동결한 하나의 module 계약을 그대로 유지합니다.
 */
const MODULE_BLOCK = `  <!--
    $count = 8
    $basket_result = /product/add_basket.html
    $basket_option = /product/basket_option.html
    $moreview = yes
    $cache = yes
  -->`;

export function renderProductSectionV1(target: RenderTarget, options: ComponentRenderOptions = {}) {
  const display = productDisplayOf(options.variant);
  const slide = display.mode === "slide";
  const moduleAttribute = ` module="product_listmain_${PRODUCT_SECTION_V1_MODULE_INDEX}"`;
  const sampleCount = target === "preview" ? 4 : 2;
  const cards = Array.from(
    { length: sampleCount },
    (_value, index) => renderProductCardV1(target, index, options, slide ? "swiper-slide" : undefined),
  ).join("\n");
  // Cafe24 원본과 같은 클래스 토큰을 그대로 씁니다. Preview·ZIP·실몰이 같은 문자열을 갖습니다.
  const listClass = slide ? `swiper-wrapper prdList ${display.id}` : `prdList ${display.id}`;
  const sectionClass = slide
    ? "ec-base-product moireProductSection swiper-container special_slide"
    : "ec-base-product moireProductSection";
  const section = `<div${moduleAttribute} class="${sectionClass}">
${MODULE_BLOCK}
  <ul class="${listClass}" data-component="ProductCardV1" data-variant="commerce-standard">
${cards}
  </ul>${slide ? '\n  <div class="swiper-scrollbar"></div>' : ""}
</div>`;
  /**
   * 슬라이드 화살표는 reference와 같이 .swiper-container의 형제입니다.
   * MOLIVE는 상품 슬롯 요소의 position을 가정할 수 없으므로 자기 소유 wrapper로 감쌉니다.
   */
  const html = slide
    ? `<div class="moireProductSlide">
${section}
  <div class="swiper-button-prev swiper-prev-special"></div>
  <div class="swiper-button-next swiper-next-special"></div>
</div>`
    : section;
  if (target === "preview" && /\{\$/.test(html)) throw new Error("ProductSectionV1 Preview mock에 치환되지 않은 Cafe24 variable이 남아 있습니다.");
  return html;
}

export const productSectionV1Definition: ComponentDefinition = {
  id: "ProductSectionV1",
  version: 1,
  category: "product-section",
  status: "verified",
  /** legacy "grid-four"는 grid4의 별칭으로 남겨 기존 저장 데이터와 golden 계약을 지킵니다. */
  variants: [LEGACY_GRID_FOUR_VARIANT, ...PRODUCT_DISPLAY_IDS],
  canonical: {
    source: "tests/fixtures/product-section-v1-grid-four.html",
    cafe24HtmlSha256: "8da1436a6fa9a17317a3b6ab7cc977437abe6e68faa33f88b3d014666b0170e5",
    cssSha256: "1b9f16e54bec65ff9aac4db8b15af3fd65adc7cb129a58f1ce162f05f165bd41",
  },
  css: PRODUCT_SECTION_V1_CSS,
  render(target, options) {
    return renderProductSectionV1(target, options);
  },
};
