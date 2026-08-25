import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { structuralFingerprint } from "../lib/component-library/fingerprint.ts";
import { renderProductCardV1 } from "../lib/component-library/components/product-card-v1.ts";
import {
  commerceCss,
  composeCommerce,
  isolateAiDesignCss,
  renderHeaderV1,
  renderVerifiedProductSection,
  resolveLegacyComposition,
  verifiedProductLayoutCss,
} from "../lib/commerce/fixed-components.ts";

const fixtureUrl = (name: string) => new URL(`./fixtures/${name}`, import.meta.url);
const readGolden = async (name: string) => (await readFile(fixtureUrl(name), "utf8")).replace(/\r?\n$/, "");
const canonicalProductSection = await readGolden("product-section-v1-grid-four.html");
const canonicalProductCss = await readGolden("product-section-v1-grid-four.css");
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const body = '<div data-moire-root="brand"><main><section class="best"><h2>BEST</h2><div data-cafe24-slot="product-list"><p>교체 대상</p></div></section><section class="new"><div data-cafe24-slot="product-list"><p>중복 제거 대상</p></div></section></main></div>';

test("Legacy Preview와 Cafe24가 검증된 ProductSectionV1의 동일 DOM/class 구조를 쓴다", () => {
  const preview = composeCommerce(body, "preview");
  const cafe24 = composeCommerce(body, "cafe24");
  const previewProduct = renderVerifiedProductSection("preview");
  const cafe24Product = renderVerifiedProductSection("cafe24");

  assert.equal(preview.slots, 1);
  assert.equal(cafe24.slots, 1);
  assert.equal(structuralFingerprint(renderProductCardV1("preview")), structuralFingerprint(renderProductCardV1("cafe24")));
  assert.equal((previewProduct.html.match(/<li id="anchorBoxId_/g) ?? []).length, 4);
  assert.equal((cafe24Product.html.match(/<li id="anchorBoxId_/g) ?? []).length, 2);
  for (const shared of ["moireProductSection", "prdList grid4", "prdList__item", "thumbnail", "description", "spec", "icon__box"]) {
    assert.ok(preview.html.includes(shared) && cafe24.html.includes(shared), shared);
  }
});

test("기존 ProductGridV1은 제거되고 verified ProductSection이 정확히 1회 삽입된다", () => {
  for (const mode of ["preview", "cafe24"] as const) {
    const composed = composeCommerce(body, mode);
    assert.equal((composed.html.match(/class="ec-base-product moireProductSection"/g) ?? []).length, 1);
    assert.equal((composed.html.match(/data-component="ProductCardV1"/g) ?? []).length, 1);
    assert.equal(composed.html.includes("pocGrid"), false);
    assert.equal(composed.html.includes('data-moire-commerce="product-grid-v1"'), false);
    assert.equal(composed.html.includes("교체 대상"), false);
    assert.equal(composed.html.includes("중복 제거 대상"), false);
  }
});

test("Cafe24와 Preview가 같은 module 위치를 쓰고 Preview는 variable 값만 mock한다", () => {
  const cafe24 = composeCommerce(body, "cafe24").html;
  assert.equal((cafe24.match(/module="product_listmain_1"/g) ?? []).length, 1);
  assert.equal(cafe24.includes('module="product_listmain_2"'), false);
  assert.ok(cafe24.includes('module="product_ListItem"'));
  assert.ok(cafe24.includes('href="{$link_product_detail}"'));

  const preview = renderVerifiedProductSection("preview").html;
  assert.equal((preview.match(/module="product_listmain_1"/g) ?? []).length, 1);
  assert.ok(preview.includes('module="product_ListItem"'));
  assert.equal(/\{\$/.test(preview), false);
  assert.equal(preview.includes("COMMERCE STANDARD"), false);
  assert.equal(preview.includes('href="#'), false);
});

test("실몰 검증된 ProductSection HTML/CSS golden hash는 변경되지 않는다", () => {
  const rendered = renderVerifiedProductSection("cafe24");
  assert.equal(rendered.html, canonicalProductSection);
  assert.equal(rendered.css, canonicalProductCss);
  assert.equal(sha256(rendered.html), "8da1436a6fa9a17317a3b6ab7cc977437abe6e68faa33f88b3d014666b0170e5");
  assert.equal(sha256(rendered.css), "1b9f16e54bec65ff9aac4db8b15af3fd65adc7cb129a58f1ce162f05f165bd41");
});

test("AI가 만든 header는 버리고 기존 HeaderV1을 유지한다", () => {
  const withHeader = body.replace("<main>", '<header class="ai">AI HEADER 1</header><header class="ai">AI HEADER 2</header><main>');
  const composed = composeCommerce(withHeader, "preview");
  assert.ok(!composed.html.includes("AI HEADER"));
  assert.equal((composed.html.match(/<header /g) ?? []).length, 1);
  assert.ok(composed.html.startsWith(renderHeaderV1("preview")));
});

test("ZIP 본문용 조합은 Header를 넣지 않아 layout import와 중복되지 않는다", () => {
  const composed = composeCommerce(body, "cafe24", {}, { headerVariant: "centered-brand", productLayout: "grid-four" }, { includeHeader: false });
  assert.equal((composed.html.match(/<header\b/g) ?? []).length, 0);
  assert.equal((composed.html.match(/class="ec-base-product moireProductSection"/g) ?? []).length, 1);
});

test("HeaderV1 세 variant는 같은 Cafe24 기능 계약과 서로 다른 layout을 유지한다", () => {
  const variants = ["split-utility", "centered-brand", "overlay-minimal"] as const;
  for (const variant of variants) {
    const preview = renderHeaderV1("preview", variant);
    const cafe24 = renderHeaderV1("cafe24", variant);
    assert.ok(preview.includes(`data-header-variant="${variant}"`));
    assert.ok(cafe24.includes(`data-header-variant="${variant}"`));
    for (const contract of ["Layout_LogoTop", "Layout_category", "Layout_statelogoff", "Layout_stateLogon", "btnSearch eSearch", "/order/basket.html"]) {
      assert.ok(cafe24.includes(contract), `${variant}: ${contract}`);
    }
  }
  const css = commerceCss();
  assert.match(css, /pocHeader--split-utility[^}]*order:1/);
  assert.match(css, /pocHeader--centered-brand[^}]*grid-template-columns:1fr auto 1fr/);
  assert.match(css, /pocHeader--overlay-minimal\{position:absolute/);
  assert.match(css, /pocHeader__inner\{[^}]*width:calc\(100% - 64px\)[^}]*max-width:1280px/);
  assert.match(css, /max-width:1024px[^}]*width:calc\(100% - 48px\)/);
  assert.match(css, /max-width:767px[^}]*width:calc\(100% - 40px\)/);
});

test("기존 architecture 필드에서 Header와 Product layout을 선택하고 legacy 값은 안전한 기본값을 쓴다", () => {
  assert.deepEqual(resolveLegacyComposition({ header: "overlay-minimal", productPresentation: "large-grid" }), {
    headerVariant: "overlay-minimal",
    productLayout: "large-grid",
  });
  assert.deepEqual(resolveLegacyComposition({ header: "legacy", productPresentation: "legacy" }), {
    headerVariant: "split-utility",
    productLayout: "grid-four",
  });
});

test("large-grid는 golden DOM을 바꾸지 않고 PC 3열·Tablet/Mobile 2열만 적용한다", () => {
  const css = verifiedProductLayoutCss("large-grid");
  assert.match(css, /prdList > li\{width:33\.3333%\}/);
  assert.match(css, /min-width:768px[^}]+max-width:1024px[^}]+prdList > li\{width:50%\}/);
  assert.match(css, /max-width:767px[^}]+prdList > li\{width:50%\}/);
  assert.equal(renderVerifiedProductSection("cafe24").html, canonicalProductSection);
});

test("AI CSS는 unlayered static scope로 Guide보다 강하고 Product boundary에서 끊긴다", () => {
  const isolated = isolateAiDesignCss('[data-moire-root="x"] img{width:8px}[data-moire-root="x"] li{font-size:2px}[data-moire-root="x"] .description{transform:scale(.1)}');
  assert.ok(isolated.startsWith('[data-moire-static][data-moire-root="x"] img:where(:not([data-cafe24-slot], [data-cafe24-slot] *))'));
  assert.match(isolated, /\.description:where\(:not\(\[data-cafe24-slot\], \[data-cafe24-slot\] \*\)\)/);
  assert.equal(isolated.includes("@layer"), false);
  assert.equal(isolated.includes("@scope"), false);
  assert.equal(isolated.includes('data-moire-type="hero"'), false);
  const protectedCss = verifiedProductLayoutCss("grid-four");
  assert.match(protectedCss, /^\[data-moire-root\] \[data-cafe24-slot\] \.moireProductSection/m);
  assert.match(protectedCss, /moireProductSection\.ec-base-product\{[^}]*width:calc\(100% - 64px\)[^}]*max-width:1280px/);
  const responsive = isolateAiDesignCss('[data-moire-root="x"] .brand-hero{min-height:calc(100vh - 70px)}[data-moire-root="x"] .brand-hero h1{font-size:7vw;}');
  assert.equal(responsive.includes("calc(100vh - 70px)"), false);
  assert.ok(responsive.includes("min-height:100svh"));
  assert.ok(responsive.includes("font-size:clamp(48px,7vw,76px)"));
  assert.match(responsive, /max-width:767px[^}]+img\[data-moire-id\][^}]+max-width:100%/);
  assert.ok(responsive.includes("object-position:center center"));
  assert.ok(responsive.includes("transform-origin:center center"));
});

test("AI static root 표식은 Preview/Cafe24 공통 본문에만 추가된다", () => {
  const preview = composeCommerce(body, "preview", {}, undefined, { includeHeader: false }).html;
  const cafe24 = composeCommerce(body, "cafe24", {}, undefined, { includeHeader: false }).html;
  assert.equal((preview.match(/data-moire-static/g) ?? []).length, 1);
  assert.equal((cafe24.match(/data-moire-static/g) ?? []).length, 1);
  assert.match(preview, /^<div data-moire-static data-moire-root="brand">/);
  assert.match(cafe24, /^<div data-moire-static data-moire-root="brand">/);
});

test("상품 슬롯이 없으면 기존 ProductGrid fallback 없이 실패한다", () => {
  assert.throws(() => composeCommerce('<div data-moire-root="x"><main><p>no slot</p></main></div>', "cafe24"), /ProductSectionV1/);
});

test("Legacy commerce CSS는 HeaderV1만 담당하고 기존 ProductGrid 선택자를 남기지 않는다", () => {
  const css = commerceCss({ variant: "bold", ink: "#ffffff", fontFamily: "Test Sans" });
  assert.ok(css.includes(".pocHeader__inner"));
  assert.ok(css.includes("#ffffff"));
  assert.ok(css.includes("Test Sans"));
  assert.equal(css.includes(".pocGrid"), false);
  assert.equal(css.includes("undefined"), false);
});

test("editorial-two·featured-grid·compact-five presentation은 golden DOM을 바꾸지 않고 CSS 뒤층만 바꾼다", () => {
  const editorial = verifiedProductLayoutCss("editorial-two");
  assert.match(editorial, /\.ec-base-product\{max-width:1040px\}/);
  assert.match(editorial, /prdList > li\{width:50%;margin:0 0 76px\}/);
  assert.match(editorial, /aspect-ratio:3\/4/);
  assert.match(editorial, /prdList__item\{margin:0 auto;max-width:500px\}/);
  assert.match(editorial, /text-align:center/);
  assert.match(editorial, /max-width:767px[^{]*\{[^{]*prdList > li\{width:100%/);

  const featured = verifiedProductLayoutCss("featured-grid");
  assert.match(featured, /prdList > li:first-child\{width:50%\}/);
  assert.match(featured, /li:first-child \.prdList__item\{max-width:540px\}/);
  assert.match(featured, /li:first-child \.thumbnail a\{aspect-ratio:4\/5\}/);
  assert.match(featured, /thumbnail a\{display:block;overflow:hidden;aspect-ratio:1\/1\}/);

  const compact = verifiedProductLayoutCss("compact-five");
  assert.match(compact, /\.ec-base-product\{max-width:1440px\}/);
  assert.match(compact, /prdList > li\{width:20%;margin:0 0 20px\}/);
  assert.match(compact, /aspect-ratio:1\/1/);
  assert.match(compact, /description\{margin:12px 8px 0 0;font-size:11px/);
  assert.match(compact, /min-width:768px[^{]*\{[^{]*prdList > li\{width:25%\}/);

  // 어떤 presentation도 canonical 선언 재확정과 golden DOM을 유지한다.
  for (const css of [editorial, featured, compact]) {
    assert.match(css, /prdList > li \{ display: inline-block; width: 25%/);
  }
  assert.equal(renderVerifiedProductSection("cafe24").html, canonicalProductSection);
});

test("HeaderV1 3 variant는 정렬 차이가 아니라 행 구조·높이·로고 스케일이 다르다", () => {
  const css = commerceCss();
  assert.match(css, /pocHeader--split-utility \.pocHeader__inner\{padding:12px 0;gap:28px\}/);
  assert.match(css, /pocHeader--split-utility \.pocHeader__logo img\{height:22px\}/);
  assert.match(css, /pocHeader--centered-brand[^}]*grid-template-areas:"\. logo utility" "category category category"/);
  assert.match(css, /pocHeader--centered-brand \.pocHeader__logo img\{height:34px\}/);
  assert.match(css, /pocHeader--centered-brand \.pocHeader__category\{grid-area:category;justify-self:center\}/);
  assert.match(css, /pocHeader--overlay-minimal \.pocHeader__inner\{[^}]*padding:30px 0\}/);
  assert.match(css, /pocHeader--overlay-minimal \.pocHeader__logo img\{height:30px\}/);
  // 모바일에서 centered-brand는 한 행으로 접힌다.
  assert.match(css, /max-width:767px[\s\S]*?grid-template-areas:"logo utility"/);
});
