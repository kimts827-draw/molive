import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyThemePath,
  ensureEditingMetadata,
  injectManagedPresentation,
  inlinePresentationStyles,
  prepareProjectPatch,
  sanitizePresentationCss,
  validateNodePatch,
  validateProjectSource,
  validateThemeMutation,
} from "../lib/cafe24/protection.ts";
import type { ProjectSource } from "../lib/project-source.ts";

const original = `<!--@layout(/layout/basic/main.html)-->
<div module="product_listmain_1">
  <form id="product-action" action="{$basket_result}">
    <input id="quantity" name="quantity" value="{$product_no}">
    <span>{$product_name}</span>
  </form>
</div>`;

const arbitrarySource: ProjectSource = {
  id: "test-source", name: "Independent architecture", updatedAt: new Date(0).toISOString(),
  architecture: { header: "vertical edge rail", hero: "full bleed overlay", sections: ["cover", "catalog index"], productPresentation: "horizontal numbered index", typography: "display serif and mono", footer: "oversized signature" },
  html: `<div data-moire-root="independent"><main><section data-moire-id="cover" data-moire-type="hero"><h1 data-moire-id="title" data-moire-type="text">Cover</h1><img src="https://example.com/a.jpg" alt="Object" data-moire-id="cover-image" data-moire-type="image"></section><section data-moire-id="catalog" data-moire-type="products"><p data-moire-id="catalog-copy" data-moire-type="text">Selected products</p><div data-cafe24-slot="product-list"></div></section></main><footer data-moire-id="footer-signature" data-moire-type="footer"><p data-moire-id="footer-copy" data-moire-type="text">Seoul</p></footer></div>`,
  css: `[data-moire-root="independent"]{display:block;background:#fff}[data-moire-root="independent"] .cover{min-height:90vh}[data-moire-root="independent"] [data-cafe24-slot="product-list"] .prdList{display:grid}[data-moire-root="independent"] [data-cafe24-slot="product-list"] .prdList__item{display:block}[data-moire-root="independent"] [data-cafe24-slot="product-list"] .thumbnail{overflow:hidden}[data-moire-root="independent"] [data-cafe24-slot="product-list"] .description{display:grid}@media(max-width:700px){[data-moire-root="independent"] h1{font-size:52px}}`,
};

test("classifies Cafe24 protected and presentation paths", () => {
  assert.equal(classifyThemePath("order/ec_orderform/payment.html"), "protected");
  assert.equal(classifyThemePath("product/detail.html"), "restricted");
  assert.equal(classifyThemePath("index.html"), "presentation");
});

test("keeps all Cafe24 fingerprints outside an injected managed region", () => {
  const next = injectManagedPresentation(original, "<!-- C24AI:START --><section>Brand story</section><!-- C24AI:END -->");
  assert.equal(validateThemeMutation("index.html", original, next).safe, true);
  assert.equal(validateThemeMutation("index.html", original, original.replace("{$product_name}", "상품명")).safe, false);
  assert.equal(validateThemeMutation("order/ec_orderform/payment.html", "a", "b").safe, false);
});

test("accepts arbitrary architecture as direct scoped HTML and CSS", () => {
  const report = validateProjectSource(arbitrarySource);
  assert.equal(report.safe, true, JSON.stringify(report.violations));
  assert.equal(report.stats.sections, 2);
  assert.equal(report.stats.commerceSlots, 1);
});

test("publisher returns the exact Project Source inside only deployment markers", () => {
  const patch = prepareProjectPatch(arbitrarySource);
  assert.ok(patch.html.includes(arbitrarySource.html));
  assert.equal(patch.css, arbitrarySource.css);
  assert.match(patch.html, /C24AI:START/);
  const themed = inlinePresentationStyles(patch.html, patch.css);
  assert.ok(themed.includes(arbitrarySource.css));
});

test("automatically adds stable editing metadata without changing layout markup", () => {
  const html = ensureEditingMetadata(`<div data-moire-root="x"><header>H</header><main><section><h1>Title</h1><img src="x"></section></main><footer>F</footer></div>`, "test");
  assert.match(html, /data-moire-id="test-header-1"/);
  assert.match(html, /data-moire-type="text"/);
  assert.match(html, /data-moire-type="image"/);
});

test("blocks protected syntax, executable HTML, unscoped CSS, and missing product mounts", () => {
  const unsafeHtml = { ...arbitrarySource, html: arbitrarySource.html.replace("<main>", `<main><script>alert(1)</script><div module="product_listmain_1">{$product_name}</div>`) };
  const htmlReport = validateProjectSource(unsafeHtml);
  assert.equal(htmlReport.safe, false);
  assert.ok(htmlReport.violations.some((item) => item.code === "UNSAFE_HTML_TAG"));
  assert.ok(htmlReport.violations.some((item) => item.code === "CAFE24_MODULE_IN_SOURCE"));
  assert.ok(htmlReport.violations.some((item) => item.code === "CAFE24_VARIABLE_IN_SOURCE"));
  assert.equal(validateProjectSource({ ...arbitrarySource, css: "body{color:red}" }).safe, false);
  assert.equal(validateProjectSource({ ...arbitrarySource, html: arbitrarySource.html.replace(' data-cafe24-slot="product-list"', "") }).safe, false);
});

test("selected-node patches must keep node ID and both node/root CSS scopes", () => {
  const valid = validateNodePatch({ nodeId: "cover", rootValue: "independent", nodeHtml: `<section data-moire-id="cover" data-moire-type="hero"><h1 data-moire-id="new-title" data-moire-type="text">New</h1></section>`, nodeCss: `[data-moire-root="independent"] [data-moire-id="cover"]{min-height:100vh}` });
  assert.equal(valid.safe, true, JSON.stringify(valid.violations));
  assert.equal(validateNodePatch({ nodeId: "cover", rootValue: "independent", nodeHtml: `<section data-moire-id="other"></section>`, nodeCss: `.cover{color:red}` }).safe, false);
});

test("rejects script-capable CSS", () => {
  assert.throws(() => sanitizePresentationCss("@import url('https://bad.example/a.css');"));
  assert.throws(() => sanitizePresentationCss("a{background:url(javascript:alert(1))}"));
});
