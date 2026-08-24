import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderProject } from "../lib/component-library/index.ts";
import { commerceCss, composeCommerce, isolateAiDesignCss, renderProjectHeaderV1, resolveLegacyComposition, verifiedProductLayoutCss } from "../lib/commerce/fixed-components.ts";
import { FOOTER_SHELL_CSS, renderFooterShell } from "../lib/commerce/footer-shell.ts";
import { buildBridgeCss, buildFooterThemeCss } from "../lib/cafe24/theme-bridge.ts";
import { buildEditorPreviewDocument } from "../lib/editor/preview-document.ts";
import { projectSpecV1Schema, type ProjectSpecV1 } from "../lib/project-document.ts";
import type { ProjectSource } from "../lib/project-source.ts";

const fixtureUrl = (name: string) => new URL(`./fixtures/${name}`, import.meta.url);
const spec = projectSpecV1Schema.parse(JSON.parse(await readFile(fixtureUrl("project-spec-v1-renderer.json"), "utf8")) as unknown);
const editorCanvasSource = await readFile(new URL("../components/editor/editor-canvas.tsx", import.meta.url), "utf8");

function expectedDocument(body: string, css: string) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;min-height:100%}${css}</style></head><body>${body}</body></html>`;
}

const legacySource: ProjectSource = {
  id: "legacy-preview",
  name: "Legacy Preview",
  html: '<main data-moire-id="main" data-moire-type="section"><h1>Legacy</h1><section data-cafe24-slot="product-list"><p>교체 대상</p></section></main>',
  css: "main{color:#123456}",
  architecture: {
    header: "legacy header",
    hero: "legacy hero",
    sections: ["legacy products"],
    productPresentation: "legacy product slot",
    typography: "legacy typography",
    footer: "legacy footer",
  },
  updatedAt: "2026-08-23T00:00:00.000Z",
};

test("component-spec Preview는 renderProject(spec, preview) RenderBundle을 그대로 사용한다", () => {
  const bundle = renderProject(spec, "preview");
  const preview = buildEditorPreviewDocument(spec);

  assert.equal(preview.kind, "component-spec");
  assert.deepEqual(preview.bundle, bundle);
  assert.equal(preview.srcDoc, expectedDocument(bundle.documentHtml, bundle.css));
});

test("Editor Preview는 표시 영역과 무관하게 preset별 실제 browser layout viewport를 유지한다", () => {
  for (const contract of [
    "desktop: { width: 1920, height: 1080 }",
    "tablet: { width: 1024, height: 768 }",
    "mobile: { width: 390, height: 844 }",
    "width={previewViewport.width}",
    "height={previewViewport.height}",
    "transform: `scale(${previewScale})`",
  ]) {
    assert.ok(editorCanvasSource.includes(contract), contract);
  }
  assert.ok(editorCanvasSource.includes("container.clientWidth / PREVIEW_VIEWPORTS[viewport].width"));
});

test("Editor Preview panel resize는 iframe viewport가 아니라 visual scale과 wrapper 크기만 변경한다", () => {
  assert.ok(editorCanvasSource.includes("Math.min(1, container.clientWidth / PREVIEW_VIEWPORTS[viewport].width)"));
  assert.ok(editorCanvasSource.includes("height: previewViewport.height * previewScale"));
  assert.equal(editorCanvasSource.includes("zoom:"), false);
});

test("Editor selection과 overlay는 scaled wrapper 외부 좌표가 아닌 iframe document 내부에서 처리한다", () => {
  assert.ok(editorCanvasSource.includes('iframeRef.current?.contentDocument'));
  assert.ok(editorCanvasSource.includes('document.addEventListener("click"'));
  assert.ok(editorCanvasSource.includes('document.head.appendChild(overlay)'));
  assert.ok(editorCanvasSource.includes("iframe.getBoundingClientRect().width / iframe.offsetWidth"));
  assert.ok(editorCanvasSource.includes("document.elementFromPoint(event.clientX / frameScale, event.clientY / frameScale)"));
  assert.ok(editorCanvasSource.includes('correctedTarget.closest<HTMLElement>("[data-moire-id]")'));
});

test("component-spec render 실패 시 Legacy fallback 없이 명확한 오류 문서를 표시한다", () => {
  const invalid = {
    ...spec,
    header: { ...spec.header, variant: "not-verified" },
  } as ProjectSpecV1;
  const preview = buildEditorPreviewDocument(invalid);

  assert.equal(preview.kind, "component-spec");
  assert.equal(preview.bundle, undefined);
  assert.match(preview.error ?? "", /variant|등록되지 않은/i);
  assert.match(preview.srcDoc, /data-component-preview-error="true"/);
  assert.equal(preview.srcDoc.includes(legacySource.html), false);
});

test("Legacy ProjectSource Preview 출력은 기존 HTML/CSS 직접 렌더링을 유지한다", () => {
  const sourceBefore = structuredClone(legacySource);
  const preview = buildEditorPreviewDocument(legacySource);
  const composition = resolveLegacyComposition(legacySource.architecture);
  const legacyCommerce = composeCommerce(legacySource.html, "preview", legacySource.commerce, composition, { includeHeader: false });
  const verifiedProductCss = verifiedProductLayoutCss(composition.productLayout);
  const rootValue = "moire-legacy-preview";
  const shell = `<div id="wrap" data-moire-root="${rootValue}">${renderProjectHeaderV1("preview", legacySource)}<div id="container"><main id="contents" role="main" data-moire-full="true">${legacyCommerce.html}</main></div>${renderFooterShell("preview")}</div>`;
  const css = `${buildBridgeCss(legacySource.css)}\n${isolateAiDesignCss(legacySource.css)}\n${commerceCss(legacySource.commerce, composition.headerVariant)}[module="Layout_stateLogon"]{display:none}\n${verifiedProductCss}\n${FOOTER_SHELL_CSS}\n${buildFooterThemeCss(legacySource.css)}`;

  assert.equal(preview.kind, "legacy");
  assert.equal(preview.bundle, undefined);
  assert.equal(preview.error, undefined);
  assert.equal(preview.srcDoc, expectedDocument(shell, css));
  assert.equal((preview.srcDoc.match(/class="ec-base-product moireProductSection"/g) ?? []).length, 1);
  assert.equal((preview.srcDoc.match(/<header\b/g) ?? []).length, 1);
  assert.equal((preview.srcDoc.match(/<footer id="footer">/g) ?? []).length, 1);
  assert.equal(preview.srcDoc.includes("pocGrid"), false);
  assert.deepEqual(legacySource, sourceBefore, "Legacy Editor source를 변경하지 않는다");
});
