import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  renderComponent,
  structuralFingerprint,
  verifiedComponentRegistry,
} from "../lib/component-library/index.ts";
import {
  PRODUCT_CARD_V1_CAFE24_HTML,
  productCardV1Definition,
} from "../lib/component-library/components/product-card-v1.ts";
import {
  PRODUCT_SECTION_V1_CSS,
  productSectionV1Definition,
  renderProductSectionV1,
} from "../lib/component-library/components/product-section-v1.ts";

const cardRequest = { component: "ProductCardV1", variant: "commerce-standard" };
const sectionRequest = { component: "ProductSectionV1", variant: "grid-four" };
const fixtureUrl = (name: string) => new URL(`./fixtures/${name}`, import.meta.url);
const readGoldenText = async (name: string) => (await readFile(fixtureUrl(name), "utf8")).replace(/\r?\n$/, "");
const canonicalManifest = JSON.parse(await readFile(fixtureUrl("product-library-v1-canonical.json"), "utf8")) as {
  baseline: string;
  artifacts: {
    productCardV1: { fixture: string; sha256: string; bytes: number };
    productSectionV1: { fixture: string; sha256: string; bytes: number };
    css: { fixture: string; sha256: string; bytes: number };
  };
};
const canonicalCard = await readGoldenText(canonicalManifest.artifacts.productCardV1.fixture);
const canonicalSection = await readGoldenText(canonicalManifest.artifacts.productSectionV1.fixture);
const canonicalCss = await readGoldenText(canonicalManifest.artifacts.css.fixture);
const sha256 = (source: string) => createHash("sha256").update(source, "utf8").digest("hex");

const requiredProductVariables = [
  "{$product_no}",
  "{$link_product_detail}",
  "{$image_medium}",
  "{$image_medium_id}",
  "{$seo_alt_tag}",
  "{$product_name}",
  "{$item_display|display}",
  "{$item_title_display|display}",
  "{$item_title}",
  "{$item_content}",
  "{$new_icon}",
  "{$recommend_icon}",
  "{$soldout_icon}",
  "{$product_icons}",
  "{$stock_icon}",
  "{$today_arrival_icon}",
  "{$pickup_icon}",
  "{$benefit_icons}",
  "{$regular_delivery_icon}",
  "{$list_wish_icon}",
  "{$basket_icon}",
  "{$option_preview_icon}",
] as const;

test("ProductCardV1은 ProjectSpec section이 아닌 internal verified component다", () => {
  assert.equal(productCardV1Definition.internal, true);
  assert.equal(productCardV1Definition.status, "verified");
  assert.equal(productCardV1Definition.category, "product-card");
  assert.deepEqual(productCardV1Definition.variants, ["commerce-standard"]);
});

test("실몰 검증된 ProductCardV1/ProductSectionV1 HTML과 CSS를 golden fixture/hash로 동결한다", () => {
  assert.equal(canonicalManifest.baseline, "cafe24-live-verified-product-library-v1");
  assert.equal(PRODUCT_CARD_V1_CAFE24_HTML, canonicalCard);
  assert.equal(renderProductSectionV1("cafe24"), canonicalSection);
  assert.equal(PRODUCT_SECTION_V1_CSS, canonicalCss);
  for (const [artifact, source] of [
    [canonicalManifest.artifacts.productCardV1, PRODUCT_CARD_V1_CAFE24_HTML],
    [canonicalManifest.artifacts.productSectionV1, renderProductSectionV1("cafe24")],
    [canonicalManifest.artifacts.css, PRODUCT_SECTION_V1_CSS],
  ] as const) {
    assert.equal(sha256(source), artifact.sha256);
    assert.equal(Buffer.byteLength(source, "utf8"), artifact.bytes);
  }
  assert.equal(productCardV1Definition.canonical.cafe24HtmlSha256, canonicalManifest.artifacts.productCardV1.sha256);
  assert.equal(productSectionV1Definition.canonical.cafe24HtmlSha256, canonicalManifest.artifacts.productSectionV1.sha256);
  assert.equal(productSectionV1Definition.canonical.cssSha256, canonicalManifest.artifacts.css.sha256);
});

test("ProductSectionV1은 product_listmain module과 두 개의 Guide 반복 card를 소유한다", () => {
  const html = renderProductSectionV1("cafe24");
  assert.match(html, /module="product_listmain_1"/);
  assert.match(html, /\$count = 8/);
  assert.equal((html.match(/<li id="anchorBoxId_\{\$product_no\}">/g) ?? []).length, 2);
  assert.equal((html.match(/module="product_Imagestyle"/g) ?? []).length, 2);
  assert.equal((html.match(/module="product_ListItem"/g) ?? []).length, 2);
  assert.equal((html.match(/<ul class="prdList grid4"/g) ?? []).length, 1);
});

test("ProductCardV1은 Guide에서 확인된 상품 module/variable 계약만 보존한다", () => {
  assert.match(PRODUCT_CARD_V1_CAFE24_HTML, /module="product_Imagestyle"/);
  assert.match(PRODUCT_CARD_V1_CAFE24_HTML, /module="product_ListItem"/);
  for (const variable of requiredProductVariables) {
    assert.ok(PRODUCT_CARD_V1_CAFE24_HTML.includes(variable), `필수 Guide variable이 누락되었습니다: ${variable}`);
  }
  assert.ok(!/best_icon|review_count|rating|point_count/i.test(PRODUCT_CARD_V1_CAFE24_HTML));
});

test("상품 이미지와 상품명은 모두 실제 상세페이지 링크를 사용한다", () => {
  assert.equal((PRODUCT_CARD_V1_CAFE24_HTML.match(/href="\{\$link_product_detail\}"/g) ?? []).length, 2);
  assert.match(PRODUCT_CARD_V1_CAFE24_HTML, /<img src="\{\$image_medium\}" id="\{\$image_medium_id\}" alt="\{\$seo_alt_tag\}"/);
  assert.match(PRODUCT_CARD_V1_CAFE24_HTML, /> \{\$product_name\}<\/a>/);
});

test("product_ListItem 가격행과 Guide icon/action node를 변경하지 않는다", () => {
  assert.equal((PRODUCT_CARD_V1_CAFE24_HTML.match(/class="\{\$item_display\|display\}"/g) ?? []).length, 2);
  assert.equal((PRODUCT_CARD_V1_CAFE24_HTML.match(/\{\$item_content\}/g) ?? []).length, 2);
  assert.match(PRODUCT_CARD_V1_CAFE24_HTML, /<span class="wish">\{\$list_wish_icon\}WISH<\/span>/);
  assert.match(PRODUCT_CARD_V1_CAFE24_HTML, /<span class="cart">\{\$basket_icon\}ADD<\/span>/);
  assert.match(PRODUCT_CARD_V1_CAFE24_HTML, /<span class="option">\{\$option_preview_icon\}OPTION<\/span>/);
  assert.match(PRODUCT_CARD_V1_CAFE24_HTML, /\{\$soldout_icon\} \{\$stock_icon\} \{\$recommend_icon\} \{\$new_icon\} \{\$product_icons\} \{\$today_arrival_icon\} \{\$pickup_icon\} \{\$benefit_icons\} \{\$regular_delivery_icon\}/);
});

test("Preview Product는 Cafe24 card source를 mock binding하고 실제 4개 반복을 재현한다", () => {
  const previewCard = productCardV1Definition.render("preview");
  const cafe24Card = productCardV1Definition.render("cafe24");
  const previewSection = productSectionV1Definition.render("preview");
  const cafe24Section = productSectionV1Definition.render("cafe24");
  assert.equal(structuralFingerprint(previewCard), structuralFingerprint(cafe24Card));
  assert.equal((previewSection.match(/<li id="anchorBoxId_/g) ?? []).length, 4);
  assert.equal((cafe24Section.match(/<li id="anchorBoxId_/g) ?? []).length, 2);
  assert.ok(previewSection.includes('module="product_listmain_1"'));
  assert.ok(previewSection.includes('module="product_ListItem"'));
  assert.ok(!/\{\$/.test(previewCard));
  assert.ok(!/\{\$/.test(previewSection));
  assert.equal(previewSection.includes("COMMERCE STANDARD"), false);
  assert.equal(previewSection.includes('href="#'), false);
});

test("grid-four CSS는 PC 4열, Tablet 3열, Mobile 2열을 고정한다", () => {
  assert.match(PRODUCT_SECTION_V1_CSS, /\.prdList > li \{[^}]*width: 25%/s);
  assert.match(PRODUCT_SECTION_V1_CSS, /@media all and \(min-width: 768px\) and \(max-width: 1024px\)[\s\S]*?\.prdList > li \{ width: 33\.3333%; \}/);
  assert.match(PRODUCT_SECTION_V1_CSS, /@media all and \(max-width: 767px\)[\s\S]*?\.prdList > li \{ width: 50%; \}/);
  assert.match(PRODUCT_SECTION_V1_CSS, /font-size: 0; line-height: 0/);
  assert.match(PRODUCT_SECTION_V1_CSS, /display: inline-block/);
  assert.match(PRODUCT_SECTION_V1_CSS, /\.thumbnail a img \{ width: 100%/);
  assert.doesNotMatch(PRODUCT_SECTION_V1_CSS, /\.thumbnail > a > img/);
});

test("verified Product v1은 Preview와 Cafe24 export renderer를 모두 허용한다", () => {
  assert.equal(verifiedComponentRegistry.resolve("ProductCardV1", "commerce-standard", "preview"), productCardV1Definition);
  assert.equal(verifiedComponentRegistry.resolve("ProductSectionV1", "grid-four", "preview"), productSectionV1Definition);
  assert.doesNotThrow(() => renderComponent(cardRequest, "preview"));
  assert.doesNotThrow(() => renderComponent(sectionRequest, "preview"));
  assert.equal(renderComponent(cardRequest, "cafe24").html, canonicalCard);
  assert.equal(renderComponent(sectionRequest, "cafe24").html, canonicalSection);
  assert.equal(renderComponent(sectionRequest, "cafe24").css, canonicalCss);
});
