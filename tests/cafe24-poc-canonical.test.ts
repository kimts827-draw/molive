import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { HEADER_V1, POC_CSS, productGridV1 } from "../lib/cafe24/poc/theme-poc.ts";

type ArtifactManifest = {
  fixture: string;
  sha256: string;
  bytes: number;
  modules?: string[];
  variables?: string[];
  classes: string[];
};

type CanonicalManifest = {
  baseline: string;
  source: string;
  parameters: { productGridV1: { moduleIndex: number; count: number } };
  artifacts: {
    headerV1: ArtifactManifest;
    productGridV1: ArtifactManifest;
    css: ArtifactManifest;
  };
};

const fixtureUrl = (name: string) => new URL(`./fixtures/${name}`, import.meta.url);
const manifest = JSON.parse(await readFile(fixtureUrl("cafe24-poc-canonical-v1.json"), "utf8")) as CanonicalManifest;
const headerFixture = await readFile(fixtureUrl(manifest.artifacts.headerV1.fixture), "utf8");
const gridFixture = await readFile(fixtureUrl(manifest.artifacts.productGridV1.fixture), "utf8");
const cssFixture = await readFile(fixtureUrl(manifest.artifacts.css.fixture), "utf8");

const sha256 = (source: string) => createHash("sha256").update(source, "utf8").digest("hex");
const uniqueSorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

function htmlInventory(source: string) {
  return {
    modules: [...source.matchAll(/\bmodule="([^"]+)"/g)].map((match) => match[1]),
    variables: [...source.matchAll(/\{\$[^}]+\}/g)].map((match) => match[0]),
    classes: uniqueSorted([...source.matchAll(/\bclass="([^"]+)"/g)].flatMap((match) => match[1].split(/\s+/).filter(Boolean))),
  };
}

function cssClasses(source: string) {
  return uniqueSorted([...source.matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*)/g)].map((match) => match[1]));
}

test("canonical manifest는 실몰 검증 deterministic POC 출력만 가리킨다", () => {
  assert.equal(manifest.baseline, "cafe24-live-verified-deterministic-poc-v1");
  assert.equal(manifest.source, "lib/cafe24/poc/theme-poc.ts");
  assert.deepEqual(manifest.parameters.productGridV1, { moduleIndex: 1, count: 8 });
});

test("HeaderV1 HTML은 canonical golden fixture와 byte-for-byte 같다", () => {
  assert.equal(HEADER_V1, headerFixture);
});

test("ProductGridV1 HTML은 canonical golden fixture와 byte-for-byte 같다", () => {
  const { moduleIndex, count } = manifest.parameters.productGridV1;
  assert.equal(productGridV1(moduleIndex, count), gridFixture);
});

test("POC CSS는 canonical golden fixture와 byte-for-byte 같다", () => {
  assert.equal(POC_CSS, cssFixture);
});

test("canonical HTML/CSS SHA-256와 byte 크기가 고정된다", () => {
  for (const [artifact, source] of [
    [manifest.artifacts.headerV1, HEADER_V1],
    [manifest.artifacts.productGridV1, productGridV1(manifest.parameters.productGridV1.moduleIndex, manifest.parameters.productGridV1.count)],
    [manifest.artifacts.css, POC_CSS],
  ] as const) {
    assert.equal(sha256(source), artifact.sha256);
    assert.equal(Buffer.byteLength(source, "utf8"), artifact.bytes);
  }
});

test("HeaderV1의 Cafe24 module/variable/class inventory가 고정된다", () => {
  const inventory = htmlInventory(HEADER_V1);
  assert.deepEqual(inventory.modules, manifest.artifacts.headerV1.modules);
  assert.deepEqual(inventory.variables, manifest.artifacts.headerV1.variables);
  assert.deepEqual(inventory.classes, manifest.artifacts.headerV1.classes);
});

test("ProductGridV1의 Cafe24 module/variable/class inventory가 고정된다", () => {
  const { moduleIndex, count } = manifest.parameters.productGridV1;
  const inventory = htmlInventory(productGridV1(moduleIndex, count));
  assert.deepEqual(inventory.modules, manifest.artifacts.productGridV1.modules);
  assert.deepEqual(inventory.variables, manifest.artifacts.productGridV1.variables);
  assert.deepEqual(inventory.classes, manifest.artifacts.productGridV1.classes);
});

test("POC CSS class selector inventory가 고정된다", () => {
  assert.deepEqual(cssClasses(POC_CSS), manifest.artifacts.css.classes);
});
