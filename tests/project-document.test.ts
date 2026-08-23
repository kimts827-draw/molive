import assert from "node:assert/strict";
import test from "node:test";
import {
  deserializeProjectDocument,
  isProjectDocument,
  isProjectSpecV1,
  parseProjectDocument,
  projectSpecV1JsonSchema,
  projectSpecV1Schema,
  safeParseProjectDocument,
  serializeProjectDocument,
  type ProjectSpecV1,
} from "../lib/project-document.ts";
import { isProjectSource, type ProjectSource } from "../lib/project-source.ts";

const component = (instanceId: string, name: string) => ({
  instanceId,
  component: name,
  variant: "minimal",
  settings: [],
});

const projectSpec: ProjectSpecV1 = {
  kind: "component-spec",
  schemaVersion: 1,
  libraryVersion: "2026.08",
  id: "project-spec-1",
  name: "Component Shop",
  theme: {
    palette: { ink: "#171713", muted: "#8c877e", surface: "#ffffff", accent: "#b5321f", border: "#e5e2db" },
    typography: { heading: "system-sans", body: "system-sans" },
    spacing: "balanced",
    imageRatio: "1:1",
  },
  header: component("header", "HeaderV1"),
  sections: [{
    ...component("best-products", "ProductGridV1"),
    settings: [
      { scope: "content", key: "title", value: "BEST PRODUCTS" },
      { scope: "data", key: "count", value: 8 },
      { scope: "style", key: "imageFit", value: "contain" },
    ],
  }],
  footer: component("footer", "FooterV1"),
  updatedAt: "2026-08-22T12:00:00.000Z",
};

const legacySource: ProjectSource = {
  id: "legacy-source",
  name: "Legacy HTML project",
  html: '<div data-moire-root="legacy"><main><section data-cafe24-slot="product-list"></section></main></div>',
  css: '[data-moire-root="legacy"]{display:block}',
  commerce: { variant: "minimal", columns: 4 },
  architecture: {
    header: "legacy header",
    hero: "legacy hero",
    sections: ["legacy products", "legacy story"],
    productPresentation: "legacy grid",
    typography: "legacy type",
    footer: "legacy footer",
  },
  updatedAt: "2026-08-22T12:00:00.000Z",
};

test("ProjectSpecV1을 Zod 단일 schema로 parse한다", () => {
  const parsed = projectSpecV1Schema.parse(projectSpec);
  assert.deepEqual(parsed, projectSpec);
  assert.equal(isProjectSpecV1(parsed), true);
  assert.equal(isProjectDocument(parsed), true);
});

test("ProjectSpecV1의 discriminator를 엄격하게 검증한다", () => {
  assert.equal(projectSpecV1Schema.safeParse({ ...projectSpec, kind: "project-source" }).success, false);
  assert.equal(projectSpecV1Schema.safeParse({ ...projectSpec, schemaVersion: 2 }).success, false);
});

test("ProjectSpecV1은 top-level과 모든 nested object의 미정의 property를 거부한다", () => {
  const cases = [
    { ...projectSpec, unexpected: true },
    { ...projectSpec, theme: { ...projectSpec.theme, unexpected: true } },
    { ...projectSpec, theme: { ...projectSpec.theme, palette: { ...projectSpec.theme.palette, unexpected: "#000000" } } },
    { ...projectSpec, header: { ...projectSpec.header, unexpected: true } },
    { ...projectSpec, sections: [{ ...projectSpec.sections[0], settings: [{ scope: "content", key: "title", value: "BEST", unexpected: true }] }] },
  ];
  for (const value of cases) assert.equal(projectSpecV1Schema.safeParse(value).success, false);
});

test("component instanceId와 setting key 중복을 거부한다", () => {
  assert.equal(projectSpecV1Schema.safeParse({ ...projectSpec, footer: { ...projectSpec.footer, instanceId: "header" } }).success, false);
  const duplicatedSetting = { ...projectSpec, sections: [{ ...projectSpec.sections[0], settings: [
    { scope: "content", key: "title", value: "A" },
    { scope: "content", key: "title", value: "B" },
  ] }] };
  assert.equal(projectSpecV1Schema.safeParse(duplicatedSetting).success, false);
});

test("ProjectSpecV1 serialization은 parse 검증을 거친 round-trip이다", () => {
  const serialized = serializeProjectDocument(projectSpec);
  assert.deepEqual(deserializeProjectDocument(serialized), projectSpec);
  assert.throws(() => serializeProjectDocument({ ...projectSpec, unknown: true }));
  assert.throws(() => deserializeProjectDocument("{not-json"));
});

test("Zod에서 파생한 JSON Schema도 object additionalProperties를 금지한다", () => {
  const schema = projectSpecV1JsonSchema as Record<string, any>;
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.theme.additionalProperties, false);
  assert.equal(schema.properties.theme.properties.palette.additionalProperties, false);
  assert.equal(schema.properties.theme.properties.typography.additionalProperties, false);
  assert.equal(schema.properties.header.additionalProperties, false);
  assert.equal(schema.properties.sections.items.additionalProperties, false);
  assert.equal(schema.properties.sections.items.properties.settings.items.additionalProperties, false);
  const footerObject = schema.properties.footer.anyOf.find((item: Record<string, unknown>) => item.type === "object");
  assert.equal(footerObject.additionalProperties, false);
});

test("기존 ProjectSource를 ProjectDocument로 그대로 parse하고 자동 변환하지 않는다", () => {
  assert.equal(isProjectSource(legacySource), true);
  const parsed = parseProjectDocument(legacySource);
  assert.deepEqual(parsed, legacySource);
  assert.equal("kind" in parsed, false);
  assert.equal("schemaVersion" in parsed, false);
  assert.equal("html" in parsed, true);
  assert.equal(isProjectSpecV1(parsed), false);
});

test("기존 ProjectSource serialization은 html/css/commerce/architecture를 손실 없이 보존한다", () => {
  const restored = deserializeProjectDocument(serializeProjectDocument(legacySource));
  assert.deepEqual(restored, legacySource);
  assert.equal(isProjectSource(restored), true);
});

test("ProjectDocument는 ProjectSpecV1 또는 기존 ProjectSource만 허용한다", () => {
  assert.equal(safeParseProjectDocument(projectSpec).success, true);
  assert.equal(safeParseProjectDocument(legacySource).success, true);
  assert.equal(safeParseProjectDocument({ kind: "component-spec", schemaVersion: 1 }).success, false);
  assert.equal(isProjectDocument({ html: "<main></main>" }), false);
});
