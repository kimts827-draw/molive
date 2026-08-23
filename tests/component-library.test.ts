import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createComponentRegistry,
  renderComponent,
  renderComponents,
  structuralFingerprint,
  verifiedComponentRegistry,
  type ComponentDefinition,
} from "../lib/component-library/index.ts";
import { POC_CSS } from "../lib/cafe24/poc/theme-poc.ts";

const fixtureUrl = (name: string) => new URL(`./fixtures/${name}`, import.meta.url);
const canonicalHeader = await readFile(fixtureUrl("cafe24-poc-header-v1.html"), "utf8");
const canonicalProductGrid = await readFile(fixtureUrl("cafe24-poc-product-grid-v1.html"), "utf8");
const canonicalCss = await readFile(fixtureUrl("cafe24-poc-v1.css"), "utf8");
const sha256 = (source: string) => createHash("sha256").update(source, "utf8").digest("hex");

const headerRequest = { component: "HeaderV1", variant: "canonical" };
const productRequest = { component: "ProductGridV1", variant: "canonical" };

test("Component Registry는 canonical POC와 verified Product v1을 등록한다", () => {
  assert.deepEqual(verifiedComponentRegistry.list().map((definition) => ({
    id: definition.id,
    version: definition.version,
    status: definition.status,
    variants: definition.variants,
  })), [
    { id: "HeaderV1", version: 1, status: "verified", variants: ["canonical"] },
    { id: "ProductGridV1", version: 1, status: "verified", variants: ["canonical"] },
    { id: "ProductCardV1", version: 1, status: "verified", variants: ["commerce-standard"] },
    { id: "ProductSectionV1", version: 1, status: "verified", variants: ["grid-four"] },
  ]);
});

test("Cafe24 HeaderV1 render는 canonical golden HTML과 byte-for-byte 같다", () => {
  const rendered = renderComponent(headerRequest, "cafe24");
  assert.equal(rendered.html, canonicalHeader);
  assert.equal(sha256(rendered.html), "18293749de97980d3903ccd830bb21ebb619579aa1d01fb1d17705dd0b81dc08");
});

test("Cafe24 ProductGridV1 render는 canonical golden HTML과 byte-for-byte 같다", () => {
  const rendered = renderComponent(productRequest, "cafe24");
  assert.equal(rendered.html, canonicalProductGrid);
  assert.equal(sha256(rendered.html), "dd941c8cefd0ab8fde4e4f82d68dffd9564b218099c1df4f5f6c6322e302561c");
});

test("component CSS는 분해하지 않고 canonical POC_CSS를 그대로 쓴다", () => {
  assert.equal(renderComponent(headerRequest, "preview").css, canonicalCss);
  assert.equal(renderComponent(productRequest, "cafe24").css, canonicalCss);
  assert.equal(POC_CSS, canonicalCss);
  assert.equal(sha256(canonicalCss), "4ef264e5427c5646ad0f79c10408d5dac67bd95a3ca90253c6d9efc560c3624f");
});

test("Preview는 canonical DOM/class를 유지하고 Cafe24 binding만 sample data로 바꾼다", () => {
  const header = renderComponent(headerRequest, "preview");
  const product = renderComponent(productRequest, "preview");
  for (const html of [header.html, product.html]) {
    assert.ok(!/\bmodule=/.test(html), "Preview에 Cafe24 module attribute가 남았습니다.");
    assert.ok(!/\{\$/.test(html), "Preview에 Cafe24 variable이 남았습니다.");
  }
  assert.ok(header.html.includes("SAMPLE SHOP"));
  assert.ok(product.html.includes("SAMPLE PRODUCT"));
  assert.ok(product.html.includes("24,900원"));
});

test("HeaderV1 Preview/Cafe24의 structural fingerprint가 동일하다", () => {
  const preview = renderComponent(headerRequest, "preview");
  const cafe24 = renderComponent(headerRequest, "cafe24");
  assert.equal(preview.structuralFingerprint, cafe24.structuralFingerprint);
  assert.equal(preview.structuralFingerprint, structuralFingerprint(preview.html));
});

test("ProductGridV1 Preview/Cafe24의 structural fingerprint가 동일하다", () => {
  const preview = renderComponent(productRequest, "preview");
  const cafe24 = renderComponent(productRequest, "cafe24");
  assert.equal(preview.structuralFingerprint, cafe24.structuralFingerprint);
  assert.equal(preview.structuralFingerprint, structuralFingerprint(preview.html));
});

test("ProductGridV1에 fixed-components의 미검증 link/title 변경을 합치지 않는다", () => {
  const html = renderComponent(productRequest, "cafe24").html;
  assert.ok(html.includes('data-poc-grid="v1"'));
  assert.ok(html.includes('<h2 class="pocGrid__title">PRODUCT GRID V1</h2>'));
  assert.ok(!html.includes("{$link_product_detail}"));
  assert.equal((html.match(/<a\b/g) ?? []).length, 0);
});

test("등록되지 않은 component/variant는 fallback 없이 throw한다", () => {
  assert.throws(() => renderComponent({ component: "HeroV1", variant: "canonical" }, "preview"), /등록되지 않은 component/);
  assert.throws(() => renderComponent({ component: "HeaderV1", variant: "minimal" }, "preview"), /등록되지 않은 component variant/);
  assert.throws(() => renderComponent({ component: "ProductGridV1", variant: "editorial" }, "cafe24"), /등록되지 않은 component variant/);
});

test("unverified component는 Preview는 가능하지만 Cafe24 render는 금지한다", () => {
  const unverified: ComponentDefinition = {
    id: "HeroV1",
    version: 1,
    category: "hero",
    status: "unverified",
    variants: ["canonical"],
    canonical: { source: "test-only", cafe24HtmlSha256: "", cssSha256: "" },
    css: ".hero{}",
    render: () => '<section class="hero">SAMPLE</section>',
  };
  const registry = createComponentRegistry([unverified]);
  assert.equal(renderComponent({ component: "HeroV1", variant: "canonical" }, "preview", registry).html, '<section class="hero">SAMPLE</section>');
  assert.throws(() => renderComponent({ component: "HeroV1", variant: "canonical" }, "cafe24", registry), /verified component만/);
});

test("공통 renderer는 요청 순서를 유지하고 canonical CSS를 한 번만 포함한다", () => {
  const preview = renderComponents([headerRequest, productRequest], "preview");
  const cafe24 = renderComponents([headerRequest, productRequest], "cafe24");
  assert.equal(preview.components.length, 2);
  assert.equal(cafe24.components.length, 2);
  assert.equal(preview.components[0].component, "HeaderV1");
  assert.equal(preview.components[1].component, "ProductGridV1");
  assert.equal(preview.css, canonicalCss);
  assert.equal(cafe24.css, canonicalCss);
  assert.ok(preview.html.indexOf("pocHeader") < preview.html.indexOf("pocGrid"));
  assert.ok(cafe24.html.indexOf("pocHeader") < cafe24.html.indexOf("pocGrid"));
});

test("중복 component ID 등록도 조용히 덮어쓰지 않고 throw한다", () => {
  const definition = verifiedComponentRegistry.list()[0];
  assert.throws(() => createComponentRegistry([definition, definition]), /중복된 component/);
});
