import { PREVIEW_PRICE_LABEL, previewProductAt, type PreviewProductMock } from "../preview-mock.ts";
import type { ComponentDefinition, ComponentRenderOptions, RenderTarget } from "../types.ts";

/**
 * Guide skin17/skin18의 product/list_product.html에서 공통으로 확인된 단일 반복 카드 계약입니다.
 * ProductSectionV1이 이 카드를 두 번 배치해 Cafe24의 반복 template을 소유합니다.
 */
export const PRODUCT_CARD_V1_CAFE24_HTML = `<li id="anchorBoxId_{$product_no}">
  <div class="prdList__item">
    <div class="thumbnail">
      <a href="{$link_product_detail}"><img src="{$image_medium}" id="{$image_medium_id}" alt="{$seo_alt_tag}" loading="lazy"><span module="product_Imagestyle"><span class="prdIcon {$icon_class_name}" style="background-image:url('{$icon_url}');"></span></span></a>
      <div class="likeButton {$disp_likeprd_class}"><button type="button">{$disp_likeprd_icon} <strong>{$disp_likeprd_count}</strong></button></div>
      <div class="badge"><span></span></div>
      <div class="icon__box">
        <span class="wish">{$list_wish_icon}WISH</span>
        <span class="cart">{$basket_icon}ADD</span>
        <span class="option">{$option_preview_icon}OPTION</span>
      </div>
    </div>
    <div class="description" ec-data-custom="{$product_custom}" ec-data-price="{$product_price}">
      <div class="name"><a href="{$link_product_detail}" class="{$product_name_display|display}"><span class="title {$product_name_title_display|display}">{$product_name_title} :</span> {$product_name}</a></div>
      <p class="ec-base-help txtWarn txt11 {$exclusive_purchase_olny|display}"> 단독구매상품</p>
      <ul module="product_ListItem" class="spec">
        <li class="{$item_display|display}">
          <strong class="title {$item_title_display|display}">{$item_title} :</strong> {$item_content}
        </li>
        <li class="{$item_display|display}">
          <strong class="title {$item_title_display|display}">{$item_title} :</strong> {$item_content}
        </li>
      </ul>
      <div class="icon">{$soldout_icon} {$stock_icon} {$recommend_icon} {$new_icon} {$product_icons} {$today_arrival_icon} {$pickup_icon} {$benefit_icons} {$regular_delivery_icon}</div>
    </div>
  </div>
</li>`;

/** 아이콘이 없을 때 쓰는 투명 1x1 이미지입니다. Cafe24 template의 {$icon_url}은 그대로 둡니다. */
const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const CLASS_BINDINGS = [
  "{$icon_class_name}",
  "{$disp_likeprd_class}",
  "{$product_name_display|display}",
  "{$product_name_title_display|display}",
  "{$exclusive_purchase_olny|display}",
  "{$item_display|display}",
  "{$item_title_display|display}",
] as const;

/**
 * Preview 카드에 넣을 mock 값입니다. 이번 생성의 Preview mock만 씁니다.
 * 가격은 실제 상품 값을 지어내지 않도록 고정 문구로 둡니다.
 */
function previewSample(index: number, product: PreviewProductMock) {
  const slot = Math.max(0, index);
  return { no: String(101 + slot), image: product.image, name: product.name, custom: PREVIEW_PRICE_LABEL, price: PREVIEW_PRICE_LABEL };
}

function bindPreviewProductCard(index: number, product: PreviewProductMock) {
  const sample = previewSample(index, product);
  let html = PRODUCT_CARD_V1_CAFE24_HTML;
  for (const binding of CLASS_BINDINGS) html = html.replaceAll(binding, "__binding__");
  const bindings: ReadonlyArray<readonly [string, string]> = [
    ["{$product_no}", sample.no],
    ["{$link_product_detail}", `/product/detail.html?product_no=${sample.no}`],
    ["{$image_medium}", sample.image],
    ["{$image_medium_id}", `${sample.no}-image`],
    ["{$seo_alt_tag}", sample.name],
    // Preview 바인딩 값입니다. "none"은 url(none)으로 해석돼 /none 404 요청을 만들므로 투명 픽셀을 씁니다.
    ["{$icon_url}", TRANSPARENT_PIXEL],
    ["{$disp_likeprd_icon}", "♡"],
    ["{$disp_likeprd_count}", "0"],
    ["{$list_wish_icon}", "♡ "],
    ["{$basket_icon}", "+ "],
    ["{$option_preview_icon}", ""],
    ["{$product_custom}", sample.custom],
    ["{$product_price}", sample.price],
    ["{$product_name_title}", "상품명"],
    ["{$product_name}", sample.name],
    ["{$item_title}", "가격"],
    ["{$item_content}", sample.price],
    ["{$soldout_icon}", ""],
    ["{$stock_icon}", ""],
    ["{$recommend_icon}", "추천"],
    ["{$new_icon}", "NEW"],
    ["{$product_icons}", ""],
    ["{$today_arrival_icon}", ""],
    ["{$pickup_icon}", ""],
    ["{$benefit_icons}", ""],
    ["{$regular_delivery_icon}", ""],
  ];
  for (const [binding, value] of bindings) html = html.replaceAll(binding, value);
  if (/\{\$/.test(html)) throw new Error("ProductCardV1 Preview mock에 치환되지 않은 Cafe24 variable이 남아 있습니다.");
  return html;
}

/**
 * 반복 <li>에 클래스를 얹습니다. 슬라이드 진열의 swiper-slide처럼 Cafe24 원본이
 * <li>에만 추가하는 클래스를 위한 것으로, 카드 내부 DOM과 {$...} binding은 건드리지 않습니다.
 */
function withListItemClass(html: string, listItemClass?: string) {
  if (!listItemClass) return html;
  return html.replace(/^<li id="([^"]*)">/, `<li id="$1" class="${listItemClass}">`);
}

/** Cafe24 target은 언제나 원본 template을 그대로 돌려줍니다. mock은 Preview에서만 바인딩됩니다. */
export function renderProductCardV1(target: RenderTarget, sampleIndex = 0, options: ComponentRenderOptions = {}, listItemClass?: string) {
  if (target === "cafe24") return withListItemClass(PRODUCT_CARD_V1_CAFE24_HTML, listItemClass);
  return withListItemClass(bindPreviewProductCard(sampleIndex, previewProductAt(options.previewProducts, sampleIndex)), listItemClass);
}

export const productCardV1Definition: ComponentDefinition = {
  id: "ProductCardV1",
  version: 1,
  category: "product-card",
  internal: true,
  status: "verified",
  variants: ["commerce-standard"],
  canonical: {
    source: "tests/fixtures/product-card-v1-commerce-standard.html",
    cafe24HtmlSha256: "2859eda9162f6affec5a02eeccc76ac19691b4425e09cabef1497fddc48c3953",
    cssSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  },
  css: "",
  render(target, options) {
    return renderProductCardV1(target, 0, options);
  },
};
