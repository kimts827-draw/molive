import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  composeProductDisplayId,
  DEFAULT_PRODUCT_DISPLAY,
  PRODUCT_DISPLAY_IDS,
  productDisplayCss,
  productDisplayOf,
  resolveProductDisplay,
} from "../lib/commerce/product-display.ts";
import { PRODUCT_SECTION_V1_CSS, renderProductSectionV1 } from "../lib/component-library/components/product-section-v1.ts";
import { renderComponent } from "../lib/component-library/index.ts";
import { composeCommerce, verifiedProductLayoutCss } from "../lib/commerce/fixed-components.ts";
import { PRODUCT_SLIDE_SCRIPT, PRODUCT_SLIDE_SCRIPT_PATH } from "../lib/cafe24/product-slide-script.ts";
import { buildMoireLayout } from "../lib/cafe24/theme-template.ts";
import { productThumbnailGuidance } from "../lib/editor/product-thumbnail-guidance.ts";
import { isProjectSource, type ProjectSource } from "../lib/project-source.ts";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const guideLayout = await read("Guide/skin4/layout/basic/main.html");
const body = '<div data-moire-root="display"><main><section data-cafe24-slot="product-list"></section></main></div>';

/** reference/cafe24-product-grid, cafe24-product-slide 12종 index.html에서 실제로 확인한 토큰입니다. */
const REFERENCE_TOKENS = [
  "grid3", "grid4", "grid5",
  "grid3 list_gallery", "grid4 list_gallery", "grid5 list_gallery",
  "grid3_slide", "grid4_slide", "grid5_slide",
  "grid3_slide list_gallery", "grid4_slide list_gallery", "grid5_slide list_gallery",
];

test("12종 전시 토큰이 Cafe24 reference index.html의 클래스 토큰과 같다", () => {
  assert.deepEqual([...PRODUCT_DISPLAY_IDS], REFERENCE_TOKENS);
  assert.equal(DEFAULT_PRODUCT_DISPLAY, "grid4");
  for (const id of PRODUCT_DISPLAY_IDS) {
    const display = productDisplayOf(id);
    assert.equal(composeProductDisplayId(display.mode, display.style, display.columns), id);
    assert.equal(display.module, display.mode === "slide" ? "product-list-slide/2" : "product-list-category/2");
  }
  // 모르는 값과 legacy variant는 기존 진열로 되돌립니다.
  assert.equal(resolveProductDisplay("grid-four"), "grid4");
  assert.equal(resolveProductDisplay(undefined), "grid4");
});

test("전시를 지정하지 않으면 지금까지 export되던 grid4 진열을 그대로 낸다", async () => {
  const golden = (await read("tests/fixtures/product-section-v1-grid-four.html")).replace(/\r?\n$/, "");
  assert.equal(renderProductSectionV1("cafe24"), golden);
  assert.equal(renderComponent({ component: "ProductSectionV1", variant: "grid-four" }, "cafe24").html, golden);
  assert.equal(renderComponent({ component: "ProductSectionV1", variant: "grid4" }, "cafe24").html, golden);
});

test("12종 모두 Preview와 Cafe24가 같은 <ul> 클래스 토큰을 쓴다", () => {
  for (const id of PRODUCT_DISPLAY_IDS) {
    const preview = renderComponent({ component: "ProductSectionV1", variant: id }, "preview").html;
    const cafe24 = renderComponent({ component: "ProductSectionV1", variant: id }, "cafe24").html;
    const slide = id.includes("_slide");
    const expected = slide ? `<ul class="swiper-wrapper prdList ${id}"` : `<ul class="prdList ${id}"`;
    assert.ok(preview.includes(expected), `preview ${id}`);
    assert.ok(cafe24.includes(expected), `cafe24 ${id}`);
    assert.equal((cafe24.match(/<ul class="/g) ?? []).length, 1, id);
  }
});

test("슬라이드는 Cafe24 reference와 같은 Swiper DOM을 갖고 그리드는 갖지 않는다", () => {
  for (const id of PRODUCT_DISPLAY_IDS) {
    const html = renderComponent({ component: "ProductSectionV1", variant: id }, "cafe24").html;
    if (productDisplayOf(id).mode === "slide") {
      assert.ok(html.startsWith('<div class="moireProductSlide">'), id);
      assert.ok(html.includes('class="ec-base-product moireProductSection swiper-container special_slide"'), id);
      assert.ok(html.includes('<div class="swiper-scrollbar"></div>'), id);
      assert.ok(html.includes('<div class="swiper-button-prev swiper-prev-special"></div>'), id);
      assert.ok(html.includes('<div class="swiper-button-next swiper-next-special"></div>'), id);
      assert.equal((html.match(/class="swiper-slide"/g) ?? []).length, 2, id);
    } else {
      assert.ok(!/swiper/.test(html), id);
      assert.ok(html.startsWith('<div module="product_listmain_1" class="ec-base-product moireProductSection">'), id);
    }
  }
});

test("12종 어디에서도 Cafe24 상품 module과 binding이 달라지지 않는다", () => {
  const variables = ["{$product_no}", "{$link_product_detail}", "{$image_medium}", "{$image_medium_id}", "{$seo_alt_tag}", "{$product_name}", "{$item_content}"];
  for (const id of PRODUCT_DISPLAY_IDS) {
    const cafe24 = renderComponent({ component: "ProductSectionV1", variant: id }, "cafe24").html;
    const preview = renderComponent({ component: "ProductSectionV1", variant: id }, "preview").html;
    assert.equal((cafe24.match(/module="product_listmain_1"/g) ?? []).length, 1, id);
    assert.equal((cafe24.match(/module="product_Imagestyle"/g) ?? []).length, 2, id);
    assert.equal((cafe24.match(/module="product_ListItem"/g) ?? []).length, 2, id);
    assert.ok(cafe24.includes("$count = 8"), id);
    for (const variable of variables) assert.ok(cafe24.includes(variable), `${id} / ${variable}`);
    assert.ok(!/\{\$/.test(preview), id);
  }
});

test("12종 전시 CSS는 이미지 크롭을 넣지 않는다", () => {
  for (const id of PRODUCT_DISPLAY_IDS) {
    const css = productDisplayCss(id);
    assert.ok(!/aspect-ratio/.test(css), id);
    assert.ok(!/object-fit/.test(css), id);
  }
  // 전시 토큰이 정해지면 legacy presentation의 크롭도, 썸네일 비율 override도 얹지 않습니다.
  const withDisplay = verifiedProductLayoutCss("featured-grid", "3:4", { productDisplay: "grid3", target: "cafe24" });
  assert.ok(!/aspect-ratio/.test(withDisplay));
  assert.ok(!/li:first-child\{width:50%\}/.test(withDisplay));
});

test("그리드 열 수는 Cafe24 reference 값을 그대로 쓴다", () => {
  const expected = [
    { id: "grid3", pc: "33.3333%", under1024: "50%" },
    { id: "grid4", pc: "25%", under1024: "50%" },
    { id: "grid5", pc: "20%", under1024: "33.3333%" },
  ] as const;
  for (const row of expected) {
    for (const id of [row.id, `${row.id} list_gallery`]) {
      const css = productDisplayCss(id);
      assert.ok(css.includes(`.prdList > li{width:${row.pc}}`), id);
      assert.ok(css.includes(`@media all and (max-width:1024px){[data-moire-root] [data-cafe24-slot] .moireProductSection.ec-base-product .prdList > li{width:${row.under1024}}}`), id);
    }
  }
});

const QUICK_ACTION_HIDDEN = ".prdList .icon__box{position:absolute;top:45%;right:0;left:0;z-index:3;display:flex;flex-direction:row;align-items:center;justify-content:center;gap:0;opacity:0;pointer-events:none;transition:all 0.3s}";
const QUICK_ACTION_HOVER = ".prdList > li:hover .icon__box{opacity:1;pointer-events:auto}";
const QUICK_ACTION_MOBILE = "@media all and (max-width:1024px){[data-moire-root] [data-cafe24-slot] .moireProductSection.ec-base-product .prdList .icon__box{display:none}}";

function assertQuickAction(css: string, label: string) {
  assert.ok(css.includes(QUICK_ACTION_HIDDEN), `${label} / 평상시 숨김`);
  assert.ok(css.includes(QUICK_ACTION_HOVER), `${label} / hover 노출`);
  assert.ok(css.includes("min-width:72px"), `${label} / pill`);
  assert.ok(css.includes(QUICK_ACTION_MOBILE), `${label} / 1024 이하 숨김`);
  assert.ok(css.includes(".prdList .thumbnail .badge{display:none}"), `${label} / badge`);
}

test("퀵액션은 전시 선택과 무관한 카드 공통 동작으로 실린다", () => {
  // 전시를 고르지 않은 기존/default 프로젝트
  assertQuickAction(verifiedProductLayoutCss(), "default");
  assertQuickAction(verifiedProductLayoutCss("grid-four"), "grid-four");
  for (const layout of ["large-grid", "editorial-two", "featured-grid", "compact-five"] as const) {
    assertQuickAction(verifiedProductLayoutCss(layout), layout);
  }
  // 전시를 고른 12종
  for (const id of PRODUCT_DISPLAY_IDS) {
    for (const target of ["preview", "cafe24"] as const) {
      assertQuickAction(verifiedProductLayoutCss("grid-four", undefined, { productDisplay: id, target }), `${id}/${target}`);
    }
  }
});

test("퀵액션 CSS는 어느 경로에서도 한 번만 실린다", () => {
  const paths = [
    verifiedProductLayoutCss(),
    verifiedProductLayoutCss("featured-grid"),
    ...PRODUCT_DISPLAY_IDS.map((id) => verifiedProductLayoutCss("grid-four", undefined, { productDisplay: id, target: "cafe24" })),
  ];
  for (const css of paths) {
    assert.equal(css.split(QUICK_ACTION_HIDDEN).length - 1, 1);
    assert.equal(css.split(QUICK_ACTION_HOVER).length - 1, 1);
  }
  // variant layer는 더 이상 퀵액션을 갖지 않습니다.
  for (const id of PRODUCT_DISPLAY_IDS) {
    assert.ok(!productDisplayCss(id).includes(QUICK_ACTION_HIDDEN), id);
  }
});

test("퀵액션 규칙이 canonical의 우측 상단 세로 배치를 실제로 덮는다", () => {
  // canonical은 top:12px / right:12px / flex-direction:column / gap:12px 입니다.
  assert.match(PRODUCT_SECTION_V1_CSS, /\.icon__box \{ position: absolute; top: 12px; right: 12px; display: flex; flex-direction: column; gap: 12px; \}/);
  const css = verifiedProductLayoutCss();
  const canonicalAt = css.indexOf("top: 12px; right: 12px");
  const overrideAt = css.indexOf(QUICK_ACTION_HIDDEN);
  assert.ok(canonicalAt >= 0 && overrideAt > canonicalAt, "override는 canonical 뒤에 와야 합니다.");
  for (const property of ["top:45%", "right:0", "left:0", "flex-direction:row", "gap:0"]) {
    assert.ok(css.includes(property), property);
  }
});

test("이미지강조형은 퀵바를 감추고 일반형은 유지한다", () => {
  for (const id of PRODUCT_DISPLAY_IDS) {
    const css = verifiedProductLayoutCss("grid-four", undefined, { productDisplay: id, target: "cafe24" });
    const hideAt = css.lastIndexOf(".prdList .icon__box{display:none}");
    const showAt = css.lastIndexOf(QUICK_ACTION_HOVER);
    if (productDisplayOf(id).style === "gallery") {
      assert.ok(hideAt > showAt, `${id} / 강조형은 퀵바를 감춥니다.`);
    } else {
      // 일반형에서 남는 display:none은 1024 이하 media 안의 선언뿐입니다.
      assert.ok(!productDisplayCss(id).includes(".prdList .icon__box{display:none}"), `${id} / 일반형은 PC에서 퀵바를 유지합니다.`);
    }
  }
});

test("이미지강조형은 정보를 오버레이로 올리고 1024 이하에서 오버레이를 해제한다", () => {
  for (const id of PRODUCT_DISPLAY_IDS.filter((token) => token.includes("list_gallery"))) {
    const css = productDisplayCss(id);
    assert.ok(css.includes(".prdList .description{position:absolute"), id);
    assert.ok(css.includes("bottom:-20%"), id);
    assert.ok(css.includes("background-color:rgba(255,255,255,0.8)"), id);
    assert.ok(css.includes(".prdList > li:hover .description{bottom:0;opacity:1}"), id);
    assert.ok(css.includes(".prdList .icon__box{display:none}"), id);
    assert.ok(css.includes(".prdList .description{position:static"), `${id} / 1024 이하 오버레이 해제`);
  }
  for (const id of PRODUCT_DISPLAY_IDS.filter((token) => !token.includes("list_gallery"))) {
    assert.ok(!productDisplayCss(id).includes("bottom:-20%"), id);
  }
});

test("슬라이드 PC는 gap 20px 기준으로 정확히 N열이 되는 폭을 쓴다", () => {
  // reference는 컨테이너 1680px 기준 540/405/320px 고정폭이며 같은 산식의 값입니다.
  const expected = { grid3_slide: "calc((100% - 40px) / 3)", grid4_slide: "calc((100% - 60px) / 4)", grid5_slide: "calc((100% - 80px) / 5)" };
  for (const [base, width] of Object.entries(expected)) {
    for (const id of [base, `${base} list_gallery`]) {
      const css = productDisplayCss(id);
      assert.ok(css.includes(`.prdList > li.swiper-slide{flex-shrink:0;display:block;width:${width};`), id);
      assert.ok(css.includes("margin:0 20px 0 0"), id);
    }
  }
});

test("슬라이드 768~1024는 상품 2개 이상과 다음 상품 일부가 보이도록 보강한다", () => {
  const tablet = { grid3_slide: 42, grid4_slide: 42, grid5_slide: 30 };
  for (const [base, percent] of Object.entries(tablet)) {
    const css = productDisplayCss(base);
    assert.ok(
      css.includes(`@media all and (min-width:768px) and (max-width:1024px){[data-moire-root] [data-cafe24-slot] .moireProductSection.ec-base-product .prdList > li.swiper-slide{width:calc(${percent}% - 10px)}}`),
      base,
    );
    // 태블릿 최대폭(1024px 화면, 컨테이너 = 100% - 48px = 976px)에서 최소 2개가 온전히 보이고 다음 상품이 걸쳐 보여야 합니다.
    const container = 976;
    const card = container * (percent / 100) - 10;
    const gap = 20;
    const visible = Math.floor((container + gap) / (card + gap));
    assert.ok(visible >= 2, `${base} 최소 2개: ${visible}`);
    const consumed = visible * card + visible * gap;
    assert.ok(container - consumed > 24, `${base} 다음 상품 노출폭: ${container - consumed}`);
  }
});

test("슬라이드도 상품 영역의 폭 계약을 그대로 지키고 화살표가 가로 스크롤을 만들지 않는다", () => {
  const css = productDisplayCss("grid3_slide", { target: "cafe24" });
  const contract = verifiedProductLayoutCss("grid-four", undefined, { productDisplay: "grid3_slide", target: "cafe24" });
  // .swiper-container 선언이 width/margin을 다시 잡으면 상품 영역의 좌우 여백이 사라집니다.
  assert.ok(css.includes(".moireProductSection.ec-base-product.swiper-container{position:relative;z-index:1;overflow:hidden}"));
  assert.ok(!/\.swiper-container\{[^}]*width:100%/.test(css));
  assert.ok(contract.includes("width:calc(100% - 64px);max-width:1280px"));
  // 화살표는 상품 영역 바깥 여백 안에서만 움직이고 여백이 모자라면 0으로 잡힙니다.
  assert.ok(css.includes(".swiper-prev-special{left:max(0px, max(32px, 50% - 640px) - 70px)}"));
  assert.ok(css.includes(".swiper-next-special{right:max(0px, max(32px, 50% - 640px) - 70px)}"));
  assert.ok(!/(left|right):-\d+px/.test(css));
});

test("슬라이드 767 이하는 Cafe24 reference 값을 그대로 유지한다", () => {
  for (const id of ["grid3_slide", "grid4_slide", "grid3_slide list_gallery", "grid4_slide list_gallery"]) {
    assert.ok(productDisplayCss(id).includes("{width:calc(40% - 10px);margin-right:10px}"), id);
  }
  for (const id of ["grid5_slide", "grid5_slide list_gallery"]) {
    assert.ok(productDisplayCss(id).includes("{width:calc(29% - 10px);margin-right:10px}"), id);
  }
});

test("Preview는 같은 DOM에 가로 스크롤만 얹고 Cafe24 CSS에는 넣지 않는다", () => {
  for (const id of PRODUCT_DISPLAY_IDS) {
    const preview = productDisplayCss(id, { target: "preview" });
    const cafe24 = productDisplayCss(id, { target: "cafe24" });
    if (productDisplayOf(id).mode === "slide") {
      assert.ok(preview.startsWith(cafe24), `${id} / Preview는 Cafe24 CSS를 그대로 포함해야 합니다.`);
      assert.ok(preview.includes(".prdList.swiper-wrapper{overflow-x:auto"), id);
      assert.ok(!cafe24.includes("overflow-x:auto"), id);
    } else {
      assert.equal(preview, cafe24, id);
    }
  }
});

test("Preview와 Cafe24 export가 같은 전시 토큰으로 상품 슬롯을 채운다", () => {
  for (const id of PRODUCT_DISPLAY_IDS) {
    const preview = composeCommerce(body, "preview", { productDisplay: id }, undefined, { includeHeader: false }).html;
    const cafe24 = composeCommerce(body, "cafe24", { productDisplay: id }, undefined, { includeHeader: false }).html;
    const slide = productDisplayOf(id).mode === "slide";
    const token = slide ? `<ul class="swiper-wrapper prdList ${id}"` : `<ul class="prdList ${id}"`;
    assert.ok(preview.includes(token), `preview ${id}`);
    assert.ok(cafe24.includes(token), `cafe24 ${id}`);
    assert.equal(preview.includes('class="moireProductSlide"'), slide, id);
    assert.equal(cafe24.includes('class="moireProductSlide"'), slide, id);
  }
});

test("슬라이드 export만 Swiper init을 싣고 설정은 Cafe24 reference와 같다", () => {
  const withSlide = buildMoireLayout(guideLayout, { rootValue: "x", hasMoireHeader: true, productSlide: true });
  const withoutSlide = buildMoireLayout(guideLayout, { rootValue: "x", hasMoireHeader: true });
  assert.ok(withSlide.includes(`<!--@js(/${PRODUCT_SLIDE_SCRIPT_PATH})-->`));
  assert.ok(!withoutSlide.includes(PRODUCT_SLIDE_SCRIPT_PATH));
  // Swiper 본체는 기준 스킨이 이미 싣고 있어 새로 배포하지 않습니다.
  assert.ok(withSlide.includes("<!--@js(/js/swiper-bundle.js)-->"));
  assert.ok(withSlide.indexOf("<!--@js(/js/swiper-bundle.js)-->") < withSlide.indexOf(PRODUCT_SLIDE_SCRIPT_PATH));
  for (const option of ['slidesPerView: "auto"', "spaceBetween: 20", "speed: 700", 'el: ".swiper-scrollbar"', 'nextEl: ".swiper-next-special"', 'prevEl: ".swiper-prev-special"', "delay: 5000", "768: {", "spaceBetween: 10"]) {
    assert.ok(PRODUCT_SLIDE_SCRIPT.includes(option), option);
  }
  assert.ok(PRODUCT_SLIDE_SCRIPT.includes(".moireProductSlide .special_slide"));
});

test("theme-package는 슬라이드일 때만 init script를 ZIP에 넣는다", async () => {
  // theme-package는 @/lib alias를 써서 test 러너가 직접 import할 수 없으므로 조합 계약을 소스로 검증합니다.
  const source = await read("lib/cafe24/theme-package.ts");
  assert.match(source, /const productSlide = productDisplayOf\(source\.commerce\?\.productDisplay\)\.mode === "slide"/);
  assert.match(source, /buildMoireLayout\(baseLayout\.toString\("utf8"\), \{ rootValue, hasMoireHeader: true, productSlide \}\)/);
  assert.match(source, /if \(productSlide\) files\.set\(PRODUCT_SLIDE_SCRIPT_PATH, Buffer\.from\(PRODUCT_SLIDE_SCRIPT, "utf8"\)\)/);
  assert.match(source, /verifiedProductLayoutCss\(composition\.productLayout, source\.commerce\?\.thumbRatioOverride, \{ productDisplay: source\.commerce\?\.productDisplay, target: "cafe24" \}\)/);
});

test("Editor Preview 문서도 같은 전시 토큰과 Preview 레이어를 쓴다", async () => {
  const source = await read("lib/editor/preview-document.ts");
  assert.match(source, /verifiedProductLayoutCss\(composition\.productLayout, document\.commerce\?\.thumbRatioOverride, \{ productDisplay: document\.commerce\?\.productDisplay, target: "preview" \}\)/);
});

test("Editor는 전시 방식·스타일·단 수 세 축을 그대로 노출하고 commerce에 저장한다", async () => {
  const source = await read("components/editor/editor-shell.tsx");
  assert.match(source, /function applyProductDisplay\(display: ProductDisplayId\)/);
  assert.match(source, /commerce: \{ \.\.\.current\.commerce, productDisplay: display \}/);
  assert.match(source, /productDisplay=\{source\.commerce\?\.productDisplay\}/);
  assert.match(source, /node\.isProductSection \? <ProductDisplayFields/);
  for (const label of ["그리드", "슬라이드", "일반형", "이미지강조형", "3단", "4단", "5단"]) {
    assert.ok(source.includes(`label: "${label}"`), label);
  }
  // commit 비교가 commerce 전체를 보므로 전시 변경이 저장·undo에서 사라지지 않습니다.
  assert.match(source, /JSON\.stringify\(next\.commerce\) === JSON\.stringify\(current\.commerce\)/);
});

test("전시 토큰은 저장·복구 왕복에서 유지된다", () => {
  const stored: ProjectSource = {
    id: "display-roundtrip",
    name: "진열 저장 검증",
    html: body,
    css: "",
    commerce: { productDisplay: "grid5_slide list_gallery" },
    architecture: { header: "split-utility", hero: "full-bleed", sections: ["featuredProducts/heading-more — 진열"], productPresentation: "grid-four", typography: "sans", footer: "light" },
    updatedAt: new Date().toISOString(),
  };
  const restored = JSON.parse(JSON.stringify(stored)) as ProjectSource;
  assert.ok(isProjectSource(restored));
  assert.equal(restored.commerce?.productDisplay, "grid5_slide list_gallery");
  const before = composeCommerce(stored.html, "cafe24", stored.commerce, undefined, { includeHeader: false }).html;
  const after = composeCommerce(restored.html, "cafe24", restored.commerce, undefined, { includeHeader: false }).html;
  assert.equal(before, after);
  assert.ok(after.includes('<ul class="swiper-wrapper prdList grid5_slide list_gallery"'));
});

test("Editor 썸네일 안내는 12종에서 원본 비율을 안내한다", () => {
  for (const id of PRODUCT_DISPLAY_IDS) {
    const guidance = productThumbnailGuidance("featured-grid", "3:4", id);
    assert.equal(guidance.ratio, "원본 비율");
    assert.ok(guidance.note?.includes("원본 비율 그대로"), id);
  }
  // 전시 토큰이 없는 기존 프로젝트는 legacy 안내를 그대로 씁니다.
  assert.deepEqual(productThumbnailGuidance("grid-four"), { label: "4열 그리드", ratio: "1:1", size: "1000 × 1000px" });
});
