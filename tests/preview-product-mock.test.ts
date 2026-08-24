import assert from "node:assert/strict";
import test from "node:test";
import { buildEditorPreviewDocument } from "../lib/editor/preview-document.ts";
import { composeCommerce } from "../lib/commerce/fixed-components.ts";
import { renderProductCardV1 } from "../lib/component-library/components/product-card-v1.ts";
import { renderProductSectionV1 } from "../lib/component-library/components/product-section-v1.ts";
import { productGridV1Definition } from "../lib/component-library/components/product-grid-v1.ts";
import { neutralProductName, resolvePreviewProducts, type PreviewProductMock } from "../lib/component-library/preview-mock.ts";
import { buildAssetSessionPath } from "../lib/assets/asset-policy.ts";
import type { ProjectSource } from "../lib/project-source.ts";

const OWNER = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
const sessionAssetUrl = `https://demo.supabase.co/storage/v1/object/public/project-assets/${buildAssetSessionPath(OWNER, SESSION, "image", "a1")}`;

const autoCareProducts: PreviewProductMock[] = [
  { name: "고광택 디테일링 왁스", image: sessionAssetUrl },
  { name: "무광 휠 클리너", image: "data:image/svg+xml;utf8,%3Csvg%2F%3E" },
  { name: "실내 세정 폼", image: "data:image/svg+xml;utf8,%3Csvg%2F%3E" },
  { name: "차량용 방향 디퓨저", image: "data:image/svg+xml;utf8,%3Csvg%2F%3E" },
];

function autoCareSource(): ProjectSource {
  return {
    id: "auto-care-preview",
    name: "자동차용품 Preview",
    html: '<main data-moire-id="main" data-moire-type="section"><h1>디테일링</h1><section data-cafe24-slot="product-list"></section></main>',
    css: "main{color:#101318}",
    architecture: { header: "split-utility", hero: "full-bleed", sections: ["products"], productPresentation: "grid-four", typography: "sans", footer: "minimal" },
    previewProducts: autoCareProducts,
    updatedAt: "2026-08-24T00:00:00.000Z",
  };
}

test("Preview 상품 카드는 이번 생성의 업종 상품명과 세션 이미지를 바인딩한다", () => {
  const html = renderProductSectionV1("preview", { previewProducts: autoCareProducts });
  for (const product of autoCareProducts) assert.ok(html.includes(product.name), product.name);
  assert.ok(html.includes(sessionAssetUrl));
  assert.ok(!/unsplash/i.test(html));
  // 실제 상품 값은 지어내지 않습니다.
  assert.ok(html.includes("Cafe24 상품 가격"));
});

test("Editor Preview 전체 경로가 상품 영역에 이번 생성 mock을 넣는다", () => {
  const preview = buildEditorPreviewDocument(autoCareSource());
  assert.equal(preview.kind, "legacy");
  assert.ok(preview.srcDoc.includes("고광택 디테일링 왁스"));
  assert.ok(preview.srcDoc.includes("차량용 방향 디퓨저"));
  assert.ok(!/unsplash|재킷|니트|스커트|코트/i.test(preview.srcDoc));
});

test("previewProducts가 없는 기존 프로젝트는 중립 자리표시자로 되돌아간다", () => {
  const source = autoCareSource();
  delete source.previewProducts;
  const preview = buildEditorPreviewDocument(source);
  assert.ok(preview.srcDoc.includes(neutralProductName(0)));
  for (const match of preview.srcDoc.matchAll(/<img\b[^>]*\ssrc\s*=\s*"([^"]*)"/gi)) {
    assert.match(match[1], /^data:image\/svg\+xml/);
  }
});

test("Cafe24 export는 previewProducts를 무시하고 실제 상품 binding을 유지한다", () => {
  const cafe24Card = renderProductCardV1("cafe24", 0, { previewProducts: autoCareProducts });
  assert.ok(cafe24Card.includes("{$image_medium}"));
  assert.ok(cafe24Card.includes("{$product_name}"));
  assert.ok(!cafe24Card.includes("고광택 디테일링 왁스"));

  const exported = composeCommerce(autoCareSource().html, "cafe24", {}, { headerVariant: "split-utility", productLayout: "grid-four" }, { includeHeader: false, previewProducts: autoCareProducts });
  assert.ok(exported.html.includes('module="product_listmain_1"'));
  assert.ok(exported.html.includes("{$image_medium}"));
  assert.ok(!/고광택 디테일링 왁스|디테일링 왁스|data:image\/svg/.test(exported.html));

  assert.ok(productGridV1Definition.render("cafe24", { previewProducts: autoCareProducts }).includes("{$image_medium}"));
});

test("mock 이미지는 이번 요청 첨부만 해석하고 외부·범위 밖 주소는 버린다", () => {
  const resolved = resolvePreviewProducts({
    drafts: [
      { name: "카본 코팅 스프레이", imageRef: "asset://0" },
      { name: "휠 브러시 세트", imageRef: "asset://7" },
      { name: "발수 코팅제", imageRef: "https://images.unsplash.com/photo-1" },
      { name: "차량용 청소기", imageRef: "" },
    ],
    assetUrls: [sessionAssetUrl],
    palette: { background: "#101318", accent: "#f04e23", ink: "#f5f5f5" },
  });
  assert.equal(resolved[0].image, sessionAssetUrl);
  for (const product of resolved.slice(1)) assert.match(product.image, /^data:image\/svg\+xml/);
  assert.ok(!resolved.some((product) => /unsplash/i.test(product.image)));
  // 생성한 타일은 프로젝트 팔레트와 이번 생성의 상품명을 그대로 씁니다.
  const tile = decodeURIComponent(resolved[3].image.replace("data:image/svg+xml;utf8,", ""));
  assert.ok(tile.includes("#101318") && tile.includes("#f04e23") && tile.includes("차량용 청소기"));
});

test("상품명이 비면 이전 mock을 물려받지 않고 중립 이름으로 채운다", () => {
  const resolved = resolvePreviewProducts({ drafts: [{ name: "  ", imageRef: "" }], assetUrls: [] });
  assert.equal(resolved.length, 4);
  assert.equal(resolved[0].name, neutralProductName(0));
  assert.equal(resolved[3].name, neutralProductName(3));
});
