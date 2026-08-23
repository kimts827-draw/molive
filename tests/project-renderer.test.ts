import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderProject, structuralFingerprint, type RenderTarget } from "../lib/component-library/index.ts";
import { projectSpecV1Schema, type ProjectSpecV1 } from "../lib/project-document.ts";

const fixtureUrl = (name: string) => new URL(`./fixtures/${name}`, import.meta.url);
const spec = projectSpecV1Schema.parse(JSON.parse(await readFile(fixtureUrl("project-spec-v1-renderer.json"), "utf8")) as unknown);
const canonicalHeader = await readFile(fixtureUrl("cafe24-poc-header-v1.html"), "utf8");
const canonicalProductGrid = await readFile(fixtureUrl("cafe24-poc-product-grid-v1.html"), "utf8");
const canonicalCss = await readFile(fixtureUrl("cafe24-poc-v1.css"), "utf8");

function withSpec(patch: Partial<ProjectSpecV1>): ProjectSpecV1 {
  return { ...spec, ...patch };
}

test("ProjectSpecV1 fixture로 preview RenderBundle을 만든다", () => {
  const bundle = renderProject(spec, "preview");
  assert.equal(bundle.target, "preview");
  assert.ok(bundle.documentHtml.startsWith(bundle.headerHtml));
  assert.equal(bundle.css, canonicalCss);
  assert.deepEqual(bundle.components.map(({ instanceId, placement, order, component, status }) => ({ instanceId, placement, order, component, status })), [
    { instanceId: "header-primary", placement: "header", order: 0, component: "HeaderV1", status: "verified" },
    { instanceId: "products-featured", placement: "section", order: 0, component: "ProductGridV1", status: "verified" },
    { instanceId: "products-new", placement: "section", order: 1, component: "ProductGridV1", status: "verified" },
  ]);
  assert.ok(!/\bmodule=/.test(bundle.documentHtml));
  assert.ok(!/\{\$/.test(bundle.documentHtml));
});

test("ProjectSpecV1 fixture로 cafe24 RenderBundle을 canonical HTML/CSS로 만든다", () => {
  const bundle = renderProject(spec, "cafe24");
  assert.equal(bundle.target, "cafe24");
  assert.equal(bundle.headerHtml, canonicalHeader);
  assert.equal(bundle.documentHtml, [canonicalHeader, canonicalProductGrid, canonicalProductGrid].join("\n"));
  assert.equal(bundle.css, canonicalCss);
  assert.equal((bundle.documentHtml.match(/module="product_listmain_1"/g) ?? []).length, 2);
  assert.equal((bundle.documentHtml.match(/data-poc-grid="v1"/g) ?? []).length, 2);
});

test("ProjectSpecV1.sections 순서가 RenderBundle component 순서로 그대로 유지된다", () => {
  const reversed = withSpec({ sections: [...spec.sections].reverse() });
  const bundle = renderProject(reversed, "preview");
  assert.deepEqual(bundle.components.filter((component) => component.placement === "section").map((component) => component.instanceId), [
    "products-new",
    "products-featured",
  ]);
});

test("project-level Preview/Cafe24 structural fingerprint가 동일하다", () => {
  const preview = renderProject(spec, "preview");
  const cafe24 = renderProject(spec, "cafe24");
  assert.equal(preview.structuralFingerprint, cafe24.structuralFingerprint);
  assert.equal(preview.structuralFingerprint, structuralFingerprint(preview.documentHtml));
  assert.deepEqual(preview.components.map((component) => component.structuralFingerprint), cafe24.components.map((component) => component.structuralFingerprint));
});

test("unknown component는 project renderer에서 fallback 없이 throw한다", () => {
  const unknownHeader = withSpec({ header: { ...spec.header, component: "HeroV1" } });
  assert.throws(() => renderProject(unknownHeader, "preview"), /등록되지 않은 component/);

  const unknownSection = withSpec({ sections: [...spec.sections, { ...spec.sections[0], instanceId: "unknown-section", component: "HeroV1" }] });
  assert.throws(() => renderProject(unknownSection, "cafe24"), /등록되지 않은 component/);
});

test("잘못된 variant는 project renderer에서 fallback 없이 throw한다", () => {
  assert.throws(() => renderProject(withSpec({ header: { ...spec.header, variant: "minimal" } }), "preview"), /등록되지 않은 component variant/);
  assert.throws(() => renderProject(withSpec({ sections: [{ ...spec.sections[0], variant: "editorial" }] }), "cafe24"), /등록되지 않은 component variant/);
});

test("필수 HeaderV1/ProductGridV1 누락을 fallback 없이 거부한다", () => {
  assert.throws(() => renderProject(withSpec({ header: { ...spec.header, component: "ProductGridV1" } }), "preview"), /필수 header component는 HeaderV1/);
  assert.throws(() => renderProject(withSpec({ sections: [{ ...spec.sections[0], component: "HeaderV1" }] }), "preview"), /필수 component ProductGridV1이 누락/);
});

test("verified Footer가 없는 2B에서 footer component를 조용히 무시하지 않는다", () => {
  const footer = { ...spec.header, instanceId: "footer-primary" };
  assert.throws(() => renderProject(withSpec({ footer }), "preview"), /verified Footer component가 등록되지 않아/);
  assert.throws(() => renderProject(withSpec({ footer: { ...footer, component: "FooterV1" } }), "cafe24"), /등록되지 않은 component/);
});

test("canonical component settings는 2B에서 임의 적용하지 않고 throw한다", () => {
  const section = { ...spec.sections[0], settings: [{ scope: "content" as const, key: "title", value: "NEW TITLE" }] };
  assert.throws(() => renderProject(withSpec({ sections: [section] }), "preview"), /canonical component는 settings를 아직 허용하지 않습니다/);
});

test("지원하지 않는 target도 fallback 없이 throw한다", () => {
  assert.throws(() => renderProject(spec, "email" as RenderTarget), /지원하지 않는 render target/);
});
