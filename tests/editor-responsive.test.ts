import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  EDITOR_VIEWPORTS,
  OVERFLOW_CLIP_CSS,
  VIEWPORT_MEDIA,
  isResponsiveProperty,
  readEditorDeclarations,
  removeEditorBlocks,
  setEditorDeclaration,
  setEditorDeclarations,
} from "../lib/editor/responsive-style.ts";

const ROOT = "moire-abc";
const NODE = "hero-title";
const projectCss = `[data-moire-root="${ROOT}"] .hero__title{font-size:64px}
@media (max-width:767px){[data-moire-root="${ROOT}"] .hero__title{font-size:32px}}`;

test("크기·간격·위치만 viewport CSS로 가고 색상 같은 속성은 인라인에 남는다", () => {
  for (const property of ["font-size", "width", "height", "translate", "scale", "padding-top", "object-position"]) {
    assert.ok(isResponsiveProperty(property), property);
  }
  for (const property of ["color", "background-color", "font-weight", "text-align", "font-family", "text-decoration-line"]) {
    assert.equal(isResponsiveProperty(property), false, property);
  }
});

test("PC 편집값은 desktop 미디어 쿼리에만 들어가 태블릿·모바일을 덮지 않는다", () => {
  const css = setEditorDeclaration(projectCss, { rootValue: ROOT, nodeId: NODE, viewport: "desktop", property: "font-size", value: "120px" });
  const node = `[data-moire-id="${NODE}"]`;
  assert.ok(css.includes(`@media ${VIEWPORT_MEDIA.desktop}{[data-moire-root="${ROOT}"] ${node}${node}${node}{font-size:120px}}`));
  // 기존 모바일 규칙은 그대로 살아 있고, 편집값은 모바일 구간을 건드리지 않습니다.
  assert.ok(css.includes(`@media (max-width:767px){[data-moire-root="${ROOT}"] .hero__title{font-size:32px}}`));
  assert.equal(css.includes(`${VIEWPORT_MEDIA.mobile}{[data-moire-root="${ROOT}"] ${node}`), false);
  // 같은 특이도에서는 뒤에 오는 규칙이 이기도록 편집 블록이 항상 마지막입니다.
  assert.ok(css.trimEnd().endsWith(`/* MOIRE:EDIT:${NODE}:desktop:END */`));
});

test("viewport마다 편집값이 따로 저장되고 서로 섞이지 않는다", () => {
  let css = setEditorDeclaration(projectCss, { rootValue: ROOT, nodeId: NODE, viewport: "desktop", property: "font-size", value: "120px" });
  css = setEditorDeclaration(css, { rootValue: ROOT, nodeId: NODE, viewport: "mobile", property: "font-size", value: "28px" });
  assert.deepEqual(readEditorDeclarations(css, { nodeId: NODE, viewport: "desktop" }), { "font-size": "120px" });
  assert.deepEqual(readEditorDeclarations(css, { nodeId: NODE, viewport: "mobile" }), { "font-size": "28px" });
  assert.deepEqual(readEditorDeclarations(css, { nodeId: NODE, viewport: "tablet" }), {});
});

test("여러 선언을 합쳐 쓰고 빈 값은 그 속성만 지운다", () => {
  let css = setEditorDeclarations(projectCss, { rootValue: ROOT, nodeId: NODE, viewport: "desktop", declarations: { height: "600px", "min-height": "600px" } });
  css = setEditorDeclarations(css, { rootValue: ROOT, nodeId: NODE, viewport: "desktop", declarations: { translate: "0px 20px" } });
  assert.deepEqual(readEditorDeclarations(css, { nodeId: NODE, viewport: "desktop" }), { height: "600px", "min-height": "600px", translate: "0px 20px" });
  css = setEditorDeclaration(css, { rootValue: ROOT, nodeId: NODE, viewport: "desktop", property: "translate", value: "" });
  assert.deepEqual(readEditorDeclarations(css, { nodeId: NODE, viewport: "desktop" }), { height: "600px", "min-height": "600px" });
});

test("선언이 모두 비면 블록이 사라져 원본 CSS가 그대로 돌아온다", () => {
  const css = setEditorDeclaration(projectCss, { rootValue: ROOT, nodeId: NODE, viewport: "desktop", property: "font-size", value: "120px" });
  const cleared = setEditorDeclaration(css, { rootValue: ROOT, nodeId: NODE, viewport: "desktop", property: "font-size", value: "" });
  assert.equal(cleared, projectCss);
  assert.equal(cleared.includes("MOIRE:EDIT"), false);
});

test("노드를 지우면 모든 viewport 편집 블록이 함께 정리된다", () => {
  let css = projectCss;
  for (const viewport of EDITOR_VIEWPORTS) {
    css = setEditorDeclaration(css, { rootValue: ROOT, nodeId: NODE, viewport, property: "height", value: "400px" });
  }
  assert.equal(removeEditorBlocks(css, NODE), projectCss);
});

test("편집 규칙은 원본 CSS보다 특이도가 높아 실제로 적용된다", () => {
  const css = setEditorDeclaration(projectCss, { rootValue: ROOT, nodeId: NODE, viewport: "desktop", property: "font-size", value: "120px" });
  // Preview가 모든 선택자에 붙이는 [data-moire-static] 때문에 `.hero h1`이 (0,3,1)이 됩니다.
  const occurrences = css.split(`[data-moire-id="${NODE}"]`).length - 1;
  assert.ok(occurrences >= 3, `노드 속성 반복이 부족합니다: ${occurrences}`);
  assert.equal(css.includes("!important"), false, "특이도로 해결하고 !important는 쓰지 않습니다.");
});

test("편집 CSS 선택자는 프로젝트 root 안에 스코프된다", () => {
  const css = setEditorDeclaration(projectCss, { rootValue: ROOT, nodeId: NODE, viewport: "tablet", property: "width", value: "480px" });
  for (const line of css.split("\n")) {
    if (!line.includes("MOIRE:EDIT") && line.includes("[data-moire-id=")) {
      assert.ok(line.includes(`[data-moire-root="${ROOT}"]`), line);
    }
  }
});

test("오른쪽으로 옮긴 요소가 문서 폭을 늘리지 않도록 잘라 낸다", () => {
  assert.match(OVERFLOW_CLIP_CSS, /overflow-x:clip/);
  // hidden은 스크롤 컨테이너를 만들어 Preview 비율이 흔들리므로 쓰지 않습니다.
  assert.equal(OVERFLOW_CLIP_CSS.includes("overflow-x:hidden"), false);
  assert.match(OVERFLOW_CLIP_CSS, /img\{max-width:100%\}/);
});

test("Editor는 반응형 속성을 인라인이 아니라 viewport CSS로 쓴다", async () => {
  const source = await readFile(new URL("../components/editor/editor-shell.tsx", import.meta.url), "utf8");
  assert.ok(source.includes("isResponsiveProperty(property)"), "속성 성격에 따라 갈라 써야 합니다.");
  assert.ok(source.includes("setEditorDeclarations(current.css"), "반응형 속성은 CSS 블록으로 가야 합니다.");
  // 인라인이 미디어 쿼리를 이기지 않도록 옮긴 속성의 인라인 값을 지웁니다.
  assert.match(source, /node\.style\.removeProperty\(property\);\s*continue;/);
  assert.ok(source.includes("readNode(source, selection, viewport)"), "Inspector는 현재 viewport 값을 읽어야 합니다.");
});
