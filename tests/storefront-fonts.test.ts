import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { inflateRawSync } from "node:zlib";
import { buildEditorPreviewDocument } from "../lib/editor/preview-document.ts";
import { deserializeProjectDocument, serializeProjectDocument } from "../lib/project-document.ts";
import type { ProjectSource } from "../lib/project-source.ts";
import { collectStorefrontFontAssets } from "../lib/fonts/storefront-font-assets.ts";
import { buildStorefrontFontFaceCss, STOREFRONT_FONTS } from "../lib/fonts/storefront-fonts.ts";
import { createZip } from "../lib/zip.ts";

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

const selected = STOREFRONT_FONTS.find((font) => font.id === "hahmlet")!;
const source: ProjectSource = {
  id: "storefront-font-parity",
  brandName: "MOLIVE FONT QA",
  name: "Font QA",
  html: '<div data-moire-root="font-qa"><main data-moire-id="main" data-moire-type="section"><h1 data-moire-id="title" data-moire-type="text">한글 English</h1><section data-moire-id="products" data-moire-type="products"><div data-cafe24-slot="product-list"></div></section></main></div>',
  css: `[data-moire-root="font-qa"]{font-family:${selected.stack}}`,
  commerce: { fontFamily: selected.stack },
  headerPresentation: {
    logo: { mode: "text", text: "한글 EN", fontFamily: selected.stack, fontWeight: 700 },
    announcement: { visible: false, text: "", backgroundColor: "#171713", textColor: "#ffffff", height: 36 },
  },
  architecture: { header: "split-utility", hero: "full-bleed", sections: ["products"], productPresentation: "grid-four", typography: selected.label, footer: "quiet" },
  updatedAt: "2026-08-30T00:00:00.000Z",
};

test("상업·웹·재배포가 확인된 서로 다른 역할의 폰트 9종만 레지스트리에 둔다", async () => {
  assert.equal(STOREFRONT_FONTS.length, 9);
  assert.equal(new Set(STOREFRONT_FONTS.map((font) => font.family)).size, 9);
  assert.deepEqual(new Set(STOREFRONT_FONTS.map((font) => font.category)), new Set(["gothic", "rounded", "display", "serif"]));
  for (const font of STOREFRONT_FONTS) {
    assert.equal(font.license, "SIL Open Font License 1.1");
    assert.match(font.officialSource, /^https:\/\/(?:github\.com\/|github\.com$)/);
    assert.ok(font.moods.length >= 2, font.id);
    assert.ok(font.usage.length >= 10, font.id);
  }

  const assets = await collectStorefrontFontAssets();
  for (const font of STOREFRONT_FONTS) {
    const license = assets.get(`fonts/storefront/${font.id}/OFL.txt`);
    assert.ok(license?.toString("utf8").includes("SIL OPEN FONT LICENSE"), `${font.id} OFL`);
    for (const file of font.files) {
      const data = assets.get(`fonts/storefront/${font.id}/${file.fileName}`);
      assert.equal(data?.subarray(0, 4).toString("ascii"), "wOF2", `${font.id}/${file.fileName}`);
    }
  }
});

test("Preview → 저장/새로고침에서 선택 폰트와 self-hosted URL이 유지된다", () => {
  const restored = deserializeProjectDocument(serializeProjectDocument(source));
  assert.equal("commerce" in restored ? restored.commerce?.fontFamily : null, selected.stack);
  assert.equal("headerPresentation" in restored ? restored.headerPresentation?.logo.fontFamily : null, selected.stack);
  const preview = buildEditorPreviewDocument(restored);
  assert.ok(preview.srcDoc.includes(`font-family:${selected.stack}`));
  assert.ok(preview.srcDoc.includes(`/fonts/storefront/${selected.id}/${selected.files[0].fileName}`));
  assert.ok(preview.srcDoc.includes(`font-family:${JSON.stringify(selected.family)}`));
});

test("Preview public 파일과 Cafe24 ZIP 폰트 파일은 byte-for-byte 동일하다", async () => {
  const assets = await collectStorefrontFontAssets();
  const zip = createZip([...assets].map(([path, data]) => ({ path, data })));
  const files = unzip(zip);
  for (const [path, publicBytes] of assets) {
    assert.deepEqual(files.get(path), publicBytes, path);
  }

  const previewCss = buildStorefrontFontFaceCss("preview");
  const cafe24Css = buildStorefrontFontFaceCss("cafe24");
  for (const font of STOREFRONT_FONTS) for (const file of font.files) {
    assert.ok(previewCss.includes(`/fonts/storefront/${font.id}/${file.fileName}`));
    assert.ok(cafe24Css.includes(`../fonts/storefront/${font.id}/${file.fileName}`));
  }
});

test("Editor, AI 최초 생성, Preview와 Cafe24 export가 단일 레지스트리를 소비한다", async () => {
  const [editor, generator, preview, themePackage, componentPackage] = await Promise.all([
    readFile("components/editor/editor-shell.tsx", "utf8"),
    readFile("lib/openai/site-generator.ts", "utf8"),
    readFile("lib/editor/preview-document.ts", "utf8"),
    readFile("lib/cafe24/theme-package.ts", "utf8"),
    readFile("lib/cafe24/component-spec-theme-package.ts", "utf8"),
  ]);
  assert.ok(editor.includes("STOREFRONT_FONTS.map"));
  assert.ok(generator.includes("z.enum(STOREFRONT_FONT_FAMILY_VALUES)"));
  assert.ok(generator.includes("storefrontFontPrompt()"));
  assert.ok(preview.includes('buildStorefrontFontFaceCss("preview")'));
  assert.ok(themePackage.includes("collectStorefrontFontAssets()"));
  assert.ok(themePackage.includes('buildStorefrontFontFaceCss("cafe24")'));
  assert.ok(componentPackage.includes('buildStorefrontFontFaceCss("cafe24")'));
});
