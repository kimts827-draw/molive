import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { structuralFingerprint } from "../lib/component-library/fingerprint.ts";
import { PRODUCT_SECTION_V1_CSS, renderProductSectionV1 } from "../lib/component-library/components/product-section-v1.ts";
import { buildBridgeCss } from "../lib/cafe24/theme-bridge.ts";
import { CAFE24_FOOTER_HTML, extractFooterShell, FOOTER_SHELL_CSS, renderFooterShell, replaceFooterShell } from "../lib/commerce/footer-shell.ts";
import { commerceCss, headerContentColorCss, headerPresentationCss, renderHeaderV1, renderProjectHeaderV1 } from "../lib/commerce/fixed-components.ts";

test("Header Preview는 Cafe24 template의 variable 값만 mock하고 DOM/class를 공유한다", () => {
  const preview = renderHeaderV1("preview", "centered-brand", "MAISON DEUX");
  const cafe24 = renderHeaderV1("cafe24", "centered-brand", "MAISON DEUX");
  assert.equal(structuralFingerprint(preview), structuralFingerprint(cafe24));
  assert.ok(preview.includes('<span class="pocHeader__logoText">MAISON DEUX</span>'));
  assert.ok(cafe24.includes('<span class="pocHeader__logoText">MAISON DEUX</span>'));
  assert.equal(preview.includes("{$logo}"), false);
  assert.equal(cafe24.includes("{$logo}"), false);
  assert.equal(preview.includes("SampleMall"), false);
  assert.equal(cafe24.includes("SampleMall"), false);
  assert.equal(preview.includes('href="#"'), false);
  assert.ok(preview.includes('module="Layout_LogoTop"'));
  assert.ok(preview.includes('module="Layout_category"'));
  assert.match(commerceCss({}, "centered-brand"), /#header\.pocHeader\{[^}]*height:auto;[^}]*padding:0/);
});

test("Fashion 브랜드명은 Preview와 Theme ZIP Header의 동일한 텍스트 로고가 된다", () => {
  const fashion = {
    brandName: "MAISON DEUX",
    name: "MAISON DEUX — Quiet Form",
    architecture: { header: "centered-brand", productPresentation: "large-grid" },
  };
  const previewHeader = renderProjectHeaderV1("preview", fashion);
  const zipHeader = renderProjectHeaderV1("cafe24", fashion);

  assert.equal(structuralFingerprint(previewHeader), structuralFingerprint(zipHeader));
  assert.match(previewHeader, /<span class="pocHeader__logoText">MAISON DEUX<\/span>/);
  assert.match(zipHeader, /<span class="pocHeader__logoText">MAISON DEUX<\/span>/);
  assert.doesNotMatch(zipHeader, /\{\$logo\}|SampleMall/);
  assert.doesNotMatch(zipHeader, /Quiet Form/);
});

test("편집한 이미지 로고와 띠배너는 Preview와 Cafe24 ZIP Header에서 같은 구조로 렌더된다", () => {
  const project = {
    brandName: "MAISON DEUX",
    name: "Campaign",
    architecture: { header: "overlay-minimal", productPresentation: "grid-four" },
    headerPresentation: {
      logo: { mode: "image" as const, imageUrl: "https://assets.example/logo.webp", imageHeight: 56, text: "MAISON DEUX", textSize: 30 },
      announcement: { visible: true, text: "오늘만 무료 배송", href: "/event.html", backgroundColor: "#112233", textColor: "#ffffff", height: 42 },
    },
  };
  const preview = renderProjectHeaderV1("preview", project);
  const cafe24 = renderProjectHeaderV1("cafe24", project);
  assert.equal(structuralFingerprint(preview), structuralFingerprint(cafe24));
  assert.match(preview, /<aside class="moireAnnouncementBar"/);
  assert.match(preview, /<img class="pocHeader__logoImage" src="https:\/\/assets\.example\/logo\.webp"/);
  assert.match(cafe24, /module="Layout_LogoTop"/);
  assert.match(cafe24, /class="[^"]*pocHeader__cart"/);
  const css = headerPresentationCss(project.headerPresentation);
  assert.match(css, /height:56px/);
  assert.match(css, /top:42px/);
  assert.match(css, /max-width:767px/);
});

test("텍스트 로고 typography는 Preview와 Cafe24 ZIP의 공통 CSS로 렌더된다", () => {
  const presentation = {
    logo: { mode: "text" as const, text: "TYPE QA", textSize: 42, imageHeight: 38, fontFamily: "Georgia, serif", lineHeight: 1.25, letterSpacing: 4.5, fontWeight: 600, textColor: "#334455" },
    announcement: { visible: false, text: "", href: "", backgroundColor: "#171713", textColor: "#ffffff", height: 36 },
  };
  const project = { name: "TYPE QA", architecture: { header: "centered-brand", productPresentation: "grid-four" }, headerPresentation: presentation };
  assert.equal(structuralFingerprint(renderProjectHeaderV1("preview", project)), structuralFingerprint(renderProjectHeaderV1("cafe24", project)));
  assert.match(renderProjectHeaderV1("cafe24", project), /<span class="pocHeader__logoText">TYPE QA<\/span>/);
  const css = headerPresentationCss(presentation);
  for (const declaration of ["font-family:Georgia, serif", "font-size:42px", "font-weight:600", "line-height:1.25", "letter-spacing:4.5px", "color:#334455"]) {
    assert.ok(css.includes(declaration), declaration);
  }
});

test("Header 글자·아이콘 색상은 로고와 DOM·레이아웃을 바꾸지 않고 검정·흰색만 지원한다", () => {
  const dark = {
    logo: { mode: "text" as const, text: "COLOR QA", textColor: "#334455" },
    announcement: { visible: false, text: "", backgroundColor: "#171713", textColor: "#ffffff", height: 36 },
  };

  for (const variant of ["split-utility", "centered-brand", "overlay-minimal"] as const) {
    assert.equal(structuralFingerprint(renderHeaderV1("preview", variant, "COLOR QA", dark)), structuralFingerprint(renderHeaderV1("cafe24", variant, "COLOR QA", dark)));
  }
  assert.match(headerContentColorCss("dark"), /> :not\(\.pocHeader__logo\)\{color:#171713\}/);
  assert.match(headerContentColorCss("light"), /> :not\(\.pocHeader__logo\)\{color:#ffffff\}/);
  assert.match(headerContentColorCss("light"), /> :not\(\.pocHeader__logo\) svg\{color:inherit\}/);
  assert.doesNotMatch(headerContentColorCss("light"), /logoText|position|grid|flex|margin|padding|width|height/);
  assert.match(headerPresentationCss(dark), /\.pocHeader__logoText\{[^}]*color:#334455\}/);
});

test("Product Preview는 Cafe24 card template을 4개 mock 반복하고 Guide 이미지 selector를 쓴다", () => {
  const preview = renderProductSectionV1("preview");
  const cafe24 = renderProductSectionV1("cafe24");
  assert.equal((preview.match(/<li id="anchorBoxId_/g) ?? []).length, 4);
  assert.equal((cafe24.match(/<li id="anchorBoxId_/g) ?? []).length, 2);
  assert.equal(preview.includes("COMMERCE STANDARD"), false);
  assert.equal(preview.includes('href="#'), false);
  assert.ok(preview.includes('module="product_ListItem"'));
  assert.ok(PRODUCT_SECTION_V1_CSS.includes(".thumbnail a img { width: 100%"));
  assert.equal(PRODUCT_SECTION_V1_CSS.includes(".thumbnail > a > img"), false);
  assert.equal(buildBridgeCss("").includes("[data-cafe24-slot] .prdList"), false);
});

test("Preview와 ZIP은 Guide Cafe24 Footer shell을 같은 source로 사용한다", async () => {
  const guideFile = await readFile("Guide/skin4/layout/basic/footer.html", "utf8");
  const guideShell = extractFooterShell(guideFile).replace(/\r\n/g, "\n");
  assert.equal(guideShell, CAFE24_FOOTER_HTML);
  assert.equal(extractFooterShell(replaceFooterShell(guideFile)).replace(/\r\n/g, "\n"), CAFE24_FOOTER_HTML);
  const preview = renderFooterShell("preview")
    .replace(' class="xans-element- xans-layout xans-layout-footer"', "")
    .replace(' class="xans-element- xans-layout xans-layout-info info__customer"', ' class="info__customer"');
  assert.equal(structuralFingerprint(preview), structuralFingerprint(CAFE24_FOOTER_HTML));
  assert.ok(FOOTER_SHELL_CSS.includes("#footer .inner"));
  assert.ok(FOOTER_SHELL_CSS.includes(".xans-layout-footer .info"));
});
