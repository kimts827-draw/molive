import { renderProductCardV1 } from "./product-card-v1.ts";
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

export function renderProductSectionV1(target: RenderTarget, options: ComponentRenderOptions = {}) {
  const moduleAttribute = ` module="product_listmain_${PRODUCT_SECTION_V1_MODULE_INDEX}"`;
  const sampleCount = target === "preview" ? 4 : 2;
  const cards = Array.from({ length: sampleCount }, (_value, index) => renderProductCardV1(target, index, options)).join("\n");
  const html = `<div${moduleAttribute} class="ec-base-product moireProductSection">
  <!--
    $count = 8
    $basket_result = /product/add_basket.html
    $basket_option = /product/basket_option.html
    $moreview = yes
    $cache = yes
  -->
  <ul class="prdList grid4" data-component="ProductCardV1" data-variant="commerce-standard">
${cards}
  </ul>
</div>`;
  if (target === "preview" && /\{\$/.test(html)) throw new Error("ProductSectionV1 Preview mock에 치환되지 않은 Cafe24 variable이 남아 있습니다.");
  return html;
}

export const productSectionV1Definition: ComponentDefinition = {
  id: "ProductSectionV1",
  version: 1,
  category: "product-section",
  status: "verified",
  variants: ["grid-four"],
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
