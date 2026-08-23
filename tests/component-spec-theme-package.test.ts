import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { buildComponentSpecThemeEntries } from "../lib/cafe24/component-spec-theme-package.ts";
import {
  INDEX_PATH,
  POC_CSS_PATH,
  POC_HEADER_PATH,
  POC_LAYOUT_PATH,
} from "../lib/cafe24/poc/theme-poc.ts";
import { THEME_ASSET_DIR } from "../lib/cafe24/theme-assets.ts";
import { renderProject, structuralFingerprint } from "../lib/component-library/index.ts";
import { projectSpecV1Schema, type ProjectSpecV1 } from "../lib/project-document.ts";
import { createZip } from "../lib/zip.ts";

const fixtureUrl = (name: string) => new URL(`./fixtures/${name}`, import.meta.url);
const spec = projectSpecV1Schema.parse(JSON.parse(await readFile(fixtureUrl("project-spec-v1-renderer.json"), "utf8")) as unknown);

async function collectGuideSkin() {
  const files = new Map<string, Buffer>();
  async function walk(relative: string) {
    const directory = join("Guide/skin4", relative);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files.set(path, await readFile(join("Guide/skin4", path)));
    }
  }
  await walk("");
  return files;
}

function unzip(buffer: Buffer) {
  const files = new Map<string, Buffer>();
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    files.set(name, method === 8 ? inflateRawSync(compressed) : Buffer.from(compressed));
    offset = dataStart + compressedSize;
  }
  return files;
}

function zipText(files: Map<string, Buffer>, path: string) {
  const value = files.get(path);
  assert.ok(value, `ZIP에 ${path}가 없습니다.`);
  return value.toString("utf8");
}

test("component-spec fixture로 실제 ZIP을 만들고 RenderBundle HTML/CSS를 그대로 패키징한다", async () => {
  const base = await collectGuideSkin();
  const assetPath = `${THEME_ASSET_DIR}/fixture-image.png`;
  const assets = {
    files: new Map([[assetPath, Buffer.from([0x89, 0x50, 0x4e, 0x47])]]),
    mapping: new Map<string, string>(),
  };
  const built = buildComponentSpecThemeEntries(base, spec, assets);
  const zip = createZip(built.entries);
  const files = unzip(zip);
  const cafe24 = renderProject(spec, "cafe24");

  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.equal(zipText(files, POC_HEADER_PATH), cafe24.headerHtml);
  assert.equal(zipText(files, POC_CSS_PATH), cafe24.css);
  const index = zipText(files, INDEX_PATH);
  const layoutDirective = `<!--@layout(/${POC_LAYOUT_PATH})-->\n`;
  assert.ok(index.startsWith(layoutDirective));
  const reconstructedDocument = `${zipText(files, POC_HEADER_PATH)}\n${index.slice(layoutDirective.length)}`;
  assert.equal(reconstructedDocument, cafe24.documentHtml);
  assert.ok(zipText(files, POC_LAYOUT_PATH).includes(`<!--@import(/${POC_HEADER_PATH})-->`));
  assert.deepEqual(files.get(assetPath), assets.files.get(assetPath));
  assert.equal([...files.keys()].some((path) => /^sitemap[^/]*[.]xml/i.test(path)), false);
});

test("Preview와 component-spec ZIP Cafe24 문서의 structural parity가 유지된다", async () => {
  const built = buildComponentSpecThemeEntries(await collectGuideSkin(), spec);
  const files = unzip(createZip(built.entries));
  const index = zipText(files, INDEX_PATH);
  const layoutDirective = `<!--@layout(/${POC_LAYOUT_PATH})-->\n`;
  const zipDocument = `${zipText(files, POC_HEADER_PATH)}\n${index.slice(layoutDirective.length)}`;
  const preview = renderProject(spec, "preview");

  assert.equal(structuralFingerprint(zipDocument), preview.structuralFingerprint);
  assert.equal(built.structuralFingerprint, preview.structuralFingerprint);
});

test("component-spec render 실패는 Legacy나 Guide fallback 없이 ZIP 생성을 중단한다", async () => {
  const invalid = {
    ...spec,
    sections: [...spec.sections, { ...spec.sections[0], instanceId: "unknown-section", component: "HeroV1" }],
  } as ProjectSpecV1;

  const base = await collectGuideSkin();
  assert.throws(() => buildComponentSpecThemeEntries(base, invalid), /등록되지 않은 component/);
  assert.throws(() => renderProject(invalid, "cafe24"), /등록되지 않은 component/);
});
