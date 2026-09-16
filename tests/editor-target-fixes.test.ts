import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveEditorIntent, type EditorIntent } from "../lib/editor/style-intent.ts";
import { HEADER_NODE_ID, normalizeThumbRatio, renderHeaderV1, verifiedProductLayoutCss } from "../lib/commerce/fixed-components.ts";
import { structuralFingerprint } from "../lib/component-library/fingerprint.ts";

const section = { tagName: "section", type: "products" };
const image = { tagName: "img", type: "image" };
const metrics = { width: 1920, height: 780, fontSize: 40 };

function thumbOf(intent: EditorIntent) {
  assert.equal(intent.kind, "product-thumbnail", JSON.stringify(intent));
  return intent as Extract<EditorIntent, { kind: "product-thumbnail" }>;
}
function styleOf(intent: EditorIntent) {
  assert.equal(intent.kind, "style", JSON.stringify(intent));
  return intent as Extract<EditorIntent, { kind: "style" }>;
}

test("이미지와 텍스트 Y 위치 슬라이더는 우측으로 갈수록 요소가 위로 올라간다", async () => {
  const source = await readFile(new URL("../components/editor/editor-shell.tsx", import.meta.url), "utf8");
  // 저장된 translate 의미는 유지하되 Inspector의 양수 값을 음수 Y로 바꿉니다.
  assert.ok(source.includes('const nextY = axis === "y" ? Math.round(value) : translateY;'));
  assert.ok(source.includes('setTranslate("y", -Math.round(value), preview)'));
  assert.ok(source.includes('label="이미지 상하 위치" value={-translateY}'));
  assert.ok(source.includes('label="텍스트 상하 위치" value={-translateY}'));
  // object-position Y도 우측 증가값을 그대로 적용해 사진 내용이 위로 이동합니다.
  assert.equal(source.includes("imageFocusDown"), false);
  assert.ok(source.includes('onPreviewStyle("object-position", `${imageX}% ${value}%`)'));
  assert.ok(source.includes('updateImagePosition("y", String(value))'));
});

test("Header는 Preview에서 선택 가능하지만 Cafe24 DOM은 그대로다", async () => {
  const preview = renderHeaderV1("preview", "centered-brand", "APEX");
  const cafe24 = renderHeaderV1("cafe24", "centered-brand", "APEX");
  // 편집 메타데이터를 마크업에 넣지 않아 Preview/Cafe24 구조가 계속 같습니다.
  assert.equal(structuralFingerprint(preview), structuralFingerprint(cafe24));
  assert.equal(preview.includes("data-moire-id"), false);
  assert.ok(cafe24.includes('module="Layout_LogoTop"') && cafe24.includes("{$link_product_list}"));

  const canvas = await readFile(new URL("../components/editor/editor-canvas.tsx", import.meta.url), "utf8");
  assert.ok(canvas.includes('document.querySelector<HTMLElement>("header#header.pocHeader")'), "Canvas가 iframe에서 헤더에 선택 속성을 붙여야 합니다.");
  assert.ok(canvas.includes("headerElement.dataset.moireId = HEADER_NODE_ID"));

  const shell = await readFile(new URL("../components/editor/editor-shell.tsx", import.meta.url), "utf8");
  assert.ok(shell.includes("if (selection.id === HEADER_NODE_ID) return headerSnapshot(selection)"), "Header 선택은 가상 스냅샷으로 Inspector에 전달돼야 합니다.");
  assert.ok(shell.includes("node.isHeader"), "Inspector는 Header 전용 화면을 보여야 합니다.");
});

test("Header를 선택하면 헤더라는 말 없이도 헤더 요청으로 해석한다", () => {
  const intent = resolveEditorIntent({ prompt: "두 줄로 바꿔줘", node: { tagName: "header", type: "header", isHeader: true } });
  assert.equal(intent.kind, "header-variant");
  assert.equal((intent as Extract<EditorIntent, { kind: "header-variant" }>).variant, "centered-brand");
  assert.equal(HEADER_NODE_ID, "moire-header");
});

test("상품 썸네일 세로폭 요청은 섹션 높이가 아니라 썸네일 비율을 바꾼다", () => {
  const intent = thumbOf(resolveEditorIntent({ prompt: "상품 썸네일 세로폭 늘려줘", node: section, metrics }));
  assert.equal(intent.thumbRatio, "4/5");
  assert.match(intent.summary, /섹션 높이와 상품 데이터는 직접 바꾸지 않았고/);

  // 같은 문장이 section 높이로 새지 않아야 합니다.
  assert.equal(resolveEditorIntent({ prompt: "상품 썸네일 세로폭 늘려줘", node: section, metrics }).kind, "product-thumbnail");
  assert.equal(resolveEditorIntent({ prompt: "상품 이미지 크게", node: section, metrics }).kind, "product-thumbnail");
});

test("썸네일 비율은 현재 값에서 한 칸씩 움직이고 직접 지정도 된다", () => {
  assert.equal(thumbOf(resolveEditorIntent({ prompt: "상품 썸네일 더 길게", node: { ...section, thumbRatio: "4/5" } })).thumbRatio, "3/4");
  assert.equal(thumbOf(resolveEditorIntent({ prompt: "상품 썸네일 짧게", node: { ...section, thumbRatio: "3/4" } })).thumbRatio, "4/5");
  assert.equal(thumbOf(resolveEditorIntent({ prompt: "상품 썸네일 비율 3:4로", node: section })).thumbRatio, "3/4");
  assert.equal(thumbOf(resolveEditorIntent({ prompt: "상품 사진을 정사각형으로", node: section })).thumbRatio, "1/1");
});

test("섹션 높이 요청은 그대로 section 높이로 간다", () => {
  assert.deepEqual(styleOf(resolveEditorIntent({ prompt: "레이아웃 세로폭 1.5배", node: section, metrics })).declarations, { height: "1170px", "min-height": "1170px" });
  assert.deepEqual(styleOf(resolveEditorIntent({ prompt: "이 섹션 높이 900px로", node: section, metrics })).declarations, { height: "900px", "min-height": "900px" });
  // 썸네일과 섹션을 함께 말하면 섹션 높이로 봅니다.
  assert.equal(resolveEditorIntent({ prompt: "상품 썸네일이 있는 섹션 높이를 줄여줘", node: section, metrics }).kind, "style");
});

test("이미지 크기와 텍스트 크기는 각각 선택 노드로 간다", () => {
  assert.deepEqual(styleOf(resolveEditorIntent({ prompt: "이미지를 80%로 축소", node: image })).declarations, { scale: "0.8" });
  assert.deepEqual(styleOf(resolveEditorIntent({ prompt: "글씨 크기 72px로", node: section, metrics })).declarations, { "font-size": "72px" });
});

test("썸네일 비율 override는 값이 있을 때만 상품 CSS에 더해진다", () => {
  const base = verifiedProductLayoutCss("grid-four");
  assert.equal(verifiedProductLayoutCss("grid-four", undefined), base);
  assert.equal(verifiedProductLayoutCss("grid-four", "이상한값"), base, "해석 못 하는 값은 무시합니다.");

  const overridden = verifiedProductLayoutCss("grid-four", "3:4");
  assert.ok(overridden.startsWith(base), "기존 검증 CSS 뒤에 덧붙습니다.");
  assert.match(overridden, /aspect-ratio:3\/4/);
  // Cafe24 상품 binding과 카드 DOM은 CSS로만 다루고 마크업은 건드리지 않습니다.
  assert.equal(overridden.includes("{$image_medium}"), false);
  // 덧붙는 비율 layer는 순수 재선언입니다. base의 슬롯 geometry 계약만 !important를 씁니다.
  assert.equal(overridden.slice(base.length).includes("!important"), false);
  assert.ok(overridden.includes('[data-cafe24-slot] .moireProductSection'), "검증된 상품 영역 안에만 적용됩니다.");
});

test("비율 표기를 정규화하고 잘못된 값은 버린다", () => {
  assert.equal(normalizeThumbRatio("4:5"), "4/5");
  assert.equal(normalizeThumbRatio(" 16 / 9 "), "16/9");
  assert.equal(normalizeThumbRatio("0/3"), null);
  assert.equal(normalizeThumbRatio("세로로"), null);
  assert.equal(normalizeThumbRatio(undefined), null);
});
