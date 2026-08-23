import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { structuralFingerprint } from "../lib/component-library/fingerprint.ts";
import { PRODUCT_SECTION_V1_CSS, renderProductSectionV1 } from "../lib/component-library/components/product-section-v1.ts";
import { buildBridgeCss } from "../lib/cafe24/theme-bridge.ts";
import { CAFE24_FOOTER_HTML, extractFooterShell, FOOTER_SHELL_CSS, renderFooterShell, replaceFooterShell } from "../lib/commerce/footer-shell.ts";
import { commerceCss, renderHeaderV1 } from "../lib/commerce/fixed-components.ts";

test("Header Preview는 Cafe24 template의 variable 값만 mock하고 DOM/class를 공유한다", () => {
  const preview = renderHeaderV1("preview", "centered-brand");
  const cafe24 = renderHeaderV1("cafe24", "centered-brand");
  assert.equal(structuralFingerprint(preview), structuralFingerprint(cafe24));
  assert.equal(preview.includes("<span class=\"pocHeader__logoText\">SHOP</span>"), false);
  assert.equal(preview.includes('href="#"'), false);
  assert.ok(preview.includes('module="Layout_LogoTop"'));
  assert.ok(preview.includes('module="Layout_category"'));
  assert.match(commerceCss({}, "centered-brand"), /#header\.pocHeader\{[^}]*height:auto;[^}]*padding:0/);
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
