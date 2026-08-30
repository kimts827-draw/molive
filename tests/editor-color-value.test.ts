import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { compositeEditorBackground, editorColorPickerHex, effectiveEditorColor, normalizeEditorColor } from "../lib/editor/color-value.ts";
import { buildEditorPreviewDocument } from "../lib/editor/preview-document.ts";
import { prepareProjectPatch } from "../lib/cafe24/protection.ts";
import type { ProjectSource } from "../lib/project-source.ts";

const editorSource = readFileSync(new URL("../components/editor/editor-shell.tsx", import.meta.url), "utf8");

test("서로 다른 초기 배경색 3종을 computed/effective 값에서 color input용 hex로 정규화한다", () => {
  const cases = [
    ["rgb(227, 24, 37)", "#e31825"],
    ["#222", "#222222"],
    ["rgba(12, 34, 56, 1)", "#0c2238"],
  ] as const;
  for (const [computed, expected] of cases) {
    const effective = effectiveEditorColor("", computed);
    assert.equal(effective, expected);
    assert.equal(editorColorPickerHex(effective), expected);
  }
});

test("서로 다른 초기 글자색 3종과 CSS variable의 resolved 값이 최초 표시값이 된다", () => {
  const cases = [
    ["", "rgb(17, 17, 17)", "#111111"],
    ["var(--theme-ink)", "rgb(52 73 94)", "#34495e"],
    ["currentColor", "rgba(255, 255, 255, 1)", "#ffffff"],
  ] as const;
  for (const [declared, computed, expected] of cases) {
    assert.equal(effectiveEditorColor(declared, computed), expected);
  }
});

test("사용자 override가 있으면 이전 computed 값보다 우선하고 재선택·저장 후에도 유지된다", () => {
  assert.equal(effectiveEditorColor("#222222", "rgb(227, 24, 37)"), "#222222");
  assert.equal(effectiveEditorColor("#fff", "rgb(17, 17, 17)"), "#ffffff");
  const saved = JSON.parse(JSON.stringify({ backgroundColor: "#222222", color: "#FFFFFF" })) as Record<string, string>;
  assert.equal(effectiveEditorColor(saved.backgroundColor, "rgb(227, 24, 37)"), "#222222");
  assert.equal(effectiveEditorColor(saved.color, "rgb(17, 17, 17)"), "#ffffff");
});

test("transparent와 alpha 및 상속 의미를 흰색/검정 fallback으로 파괴하지 않는다", () => {
  assert.equal(normalizeEditorColor("transparent"), "transparent");
  assert.equal(normalizeEditorColor("rgba(1, 2, 3, 0)"), "transparent");
  assert.equal(normalizeEditorColor("#11223380"), "rgba(17, 34, 51, 0.502)");
  assert.equal(editorColorPickerHex("transparent"), null);
  assert.equal(editorColorPickerHex("rgba(17, 34, 51, 0.5)"), "#112233");
  assert.equal(effectiveEditorColor("inherit", "rgb(10, 20, 30)"), "#0a141e");
  assert.equal(effectiveEditorColor("currentColor", ""), "currentColor");
  assert.equal(effectiveEditorColor("var(--missing)", ""), "var(--missing)");
});

test("transparent 상품 레이아웃은 의미값을 한 번만 표시하고 native picker에 넣지 않는다", () => {
  assert.equal(effectiveEditorColor("", "rgba(0, 0, 0, 0)"), "transparent");
  assert.equal(editorColorPickerHex("transparent"), null);
  assert.ok(editorSource.includes('className="color-semantic-swatch" aria-hidden="true"'));
  assert.equal(editorSource.includes('className="color-semantic-value"'), false);
  assert.equal(editorSource.includes('value={draft}'), true, "코드 입력에만 transparent 의미값을 표시합니다.");
});

test("transparent에서 입력한 hex는 즉시 picker 가능한 override가 되고 저장 왕복된다", () => {
  assert.equal(editorColorPickerHex("transparent"), null);
  assert.equal(normalizeEditorColor("#E31825"), "#e31825");
  assert.equal(editorColorPickerHex("#E31825"), "#e31825");
  const saved = JSON.parse(JSON.stringify({ backgroundColor: "#E31825" })) as { backgroundColor: string };
  assert.equal(effectiveEditorColor(saved.backgroundColor, "rgba(0, 0, 0, 0)"), "#e31825");
});

test("transparent ProductSection은 조상의 effective background를 hex로 합성한다", () => {
  assert.equal(compositeEditorBackground(["transparent", "rgb(227, 24, 37)", "#ffffff"]), "#e31825");
  assert.equal(compositeEditorBackground(["rgba(255, 255, 255, 0.5)", "rgb(0, 0, 0)"]), "#808080");
  assert.equal(compositeEditorBackground(["rgba(0, 0, 0, 0)", "transparent"]), "transparent");
  assert.ok(editorSource.includes('node.isProductSection && normalizeEditorColor(ownBackgroundColor) === "transparent"'));
  assert.ok(editorSource.includes('effectiveEditorColor("", renderMetrics?.ancestorBackgroundColor)'));
});

test("ProductSection 부모 표시색은 선택만으로 저장하지 않고 변경 시 선택 노드에만 override한다", () => {
  assert.ok(editorSource.includes("const ownBackgroundColor = effectiveEditorColor(node.style.backgroundColor, renderMetrics?.backgroundColor)"));
  assert.ok(editorSource.includes("if (trimmed !== value) onChange(trimmed)"));
  assert.ok(editorSource.includes('onChange={(value) => onStyle("background-color", value)}'));
  assert.equal(editorSource.includes("applyHeaderPresentation({ backgroundColor"), false);
  assert.equal(editorSource.includes("applyFooterBackground"), false);
});

test("색상 override 저장본은 Preview와 Cafe24 ZIP patch에서 동일하다", () => {
  const source: ProjectSource = {
    id: "color-parity",
    name: "Color parity",
    updatedAt: new Date(0).toISOString(),
    architecture: { header: "split-utility", hero: "full-bleed", sections: ["products/grid"], productPresentation: "grid-four", typography: "sans", footer: "light" },
    html: '<div data-moire-root="color-parity"><main><section data-moire-id="hero" data-moire-type="section" style="background-color:#222222"><h1 data-moire-id="title" data-moire-type="text" style="color:#FFFFFF">한글 EN</h1><div data-cafe24-slot="product-list"></div></section></main></div>',
    css: '[data-moire-root="color-parity"]{--theme-bg:#e31825;--theme-ink:#111111;background:var(--theme-bg);color:var(--theme-ink)}',
  };
  const saved = JSON.parse(JSON.stringify(source)) as ProjectSource;
  const preview = buildEditorPreviewDocument(saved);
  const patch = prepareProjectPatch(saved);
  for (const declaration of ["background-color:#222222", "color:#FFFFFF"]) {
    assert.ok(preview.srcDoc.includes(declaration));
    assert.ok(patch.html.includes(declaration));
  }
  assert.equal(patch.css, saved.css, "기존 source.css와 theme token은 덮어쓰지 않습니다.");
});

test("기존 프로젝트의 source.css/PagePlan 값은 computed metrics 경로로 읽고 빈 fallback을 저장하지 않는다", () => {
  assert.ok(editorSource.includes("const actualTextColor = effectiveEditorColor(node.style.color, renderMetrics?.color)"));
  assert.ok(editorSource.includes("const ownBackgroundColor = effectiveEditorColor(node.style.backgroundColor, renderMetrics?.backgroundColor)"));
  assert.ok(editorSource.includes("if (trimmed !== value) onChange(trimmed)"));
  assert.ok(editorSource.includes('className="color-semantic-swatch"'), "해석 불가 의미값은 별도 swatch로 구분합니다.");
});
