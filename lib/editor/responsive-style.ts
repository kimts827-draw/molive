/**
 * Editor 편집값을 viewport별 CSS 블록으로 씁니다.
 *
 * 인라인 style은 미디어 쿼리보다 항상 이기기 때문에, PC에서 조절한 px가 태블릿·모바일까지
 * 그대로 고정됩니다. 크기·간격·위치처럼 화면폭에 따라 달라져야 하는 속성은 인라인 대신
 * 현재 viewport의 미디어 쿼리 안에 넣어, 다른 화면폭은 기존 responsive CSS를 그대로 씁니다.
 *
 * 블록은 프로젝트 CSS 끝에 붙고 노드+viewport마다 하나만 유지됩니다. 같은 특이도에서는
 * 뒤에 오는 규칙이 이기므로 편집값이 원본 CSS를 덮고, 미디어가 맞지 않는 화면폭에서는
 * 원본 CSS가 그대로 살아납니다.
 */

export type EditorViewport = "desktop" | "tablet" | "mobile";

export const EDITOR_VIEWPORTS: readonly EditorViewport[] = ["desktop", "tablet", "mobile"];

/** Preview 프리셋 폭(1920 / 1024 / 390)이 각각 하나의 구간에만 들어가도록 나눕니다. */
export const VIEWPORT_MEDIA: Record<EditorViewport, string> = {
  desktop: "(min-width: 1025px)",
  tablet: "(min-width: 768px) and (max-width: 1024px)",
  mobile: "(max-width: 767px)",
};

/**
 * 화면폭에 따라 달라져야 하는 속성입니다. 이 속성만 viewport 블록으로 갑니다.
 * 색상·굵기·정렬처럼 화면폭과 무관한 속성은 인라인 style로 남겨 기존 동작을 유지합니다.
 */
const RESPONSIVE_PROPERTIES = new Set([
  "font-size",
  "line-height",
  "letter-spacing",
  "width",
  "height",
  "min-height",
  "max-width",
  "aspect-ratio",
  "scale",
  "translate",
  "object-position",
  "margin-top",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "padding-top",
  "padding-bottom",
  "padding-left",
  "padding-right",
]);

export function isResponsiveProperty(property: string) {
  return RESPONSIVE_PROPERTIES.has(property.trim().toLowerCase());
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function blockMarkers(nodeId: string, viewport: EditorViewport) {
  return {
    start: `/* MOIRE:EDIT:${nodeId}:${viewport}:START */`,
    end: `/* MOIRE:EDIT:${nodeId}:${viewport}:END */`,
  };
}

function blockPattern(nodeId: string, viewport: EditorViewport) {
  const { start, end } = blockMarkers(nodeId, viewport);
  return new RegExp(`\\n?${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`, "g");
}

/**
 * 편집 규칙이 원본 CSS를 확실히 이기도록 노드 속성을 반복해 특이도를 올립니다.
 * Preview는 모든 선택자에 [data-moire-static]을 덧붙이므로 `.hero h1` 같은 평범한 선택자도
 * (0,3,1)이 되어 단일 속성 선택자보다 높아집니다. !important는 Inspector의 다음 편집과
 * 미디어 쿼리 계층을 함께 망가뜨리므로 쓰지 않고 특이도로만 해결합니다.
 */
export function editorStyleSelector(rootValue: string, nodeId: string) {
  const node = `[data-moire-id="${nodeId}"]`;
  return `[data-moire-root="${rootValue}"] ${node}${node}${node}`;
}

function serializeDeclarations(declarations: Record<string, string>) {
  return Object.entries(declarations)
    .filter(([, value]) => value.trim())
    .map(([property, value]) => `${property.trim()}:${value.trim()}`)
    .join(";");
}

function parseDeclarations(body: string): Record<string, string> {
  const declarations: Record<string, string> = {};
  for (const part of body.split(";")) {
    const index = part.indexOf(":");
    if (index < 0) continue;
    const property = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (property && value) declarations[property] = value;
  }
  return declarations;
}

/** 노드+viewport에 저장된 편집 선언을 읽습니다. Inspector가 현재 값을 보여줄 때 씁니다. */
export function readEditorDeclarations(css: string, input: { nodeId: string; viewport: EditorViewport }): Record<string, string> {
  const { start, end } = blockMarkers(input.nodeId, input.viewport);
  const block = css.match(new RegExp(`${escapeRegExp(start)}([\\s\\S]*?)${escapeRegExp(end)}`))?.[1];
  if (!block) return {};
  const body = block.match(/\{([^{}]*)\}\s*\}/)?.[1] ?? block.match(/\{([^{}]*)\}/)?.[1];
  return body ? parseDeclarations(body) : {};
}

/**
 * 노드+viewport 편집 블록을 통째로 다시 씁니다.
 * 선언이 비면 블록을 지워 원본 CSS가 다시 살아나게 합니다.
 */
export function writeEditorDeclarations(css: string, input: {
  rootValue: string;
  nodeId: string;
  viewport: EditorViewport;
  declarations: Record<string, string>;
}) {
  const cleaned = css.replace(blockPattern(input.nodeId, input.viewport), "").trimEnd();
  const body = serializeDeclarations(input.declarations);
  if (!body) return cleaned;
  const { start, end } = blockMarkers(input.nodeId, input.viewport);
  const rule = `@media ${VIEWPORT_MEDIA[input.viewport]}{${editorStyleSelector(input.rootValue, input.nodeId)}{${body}}}`;
  return `${cleaned}\n${start}\n${rule}\n${end}`;
}

/** 한 속성만 바꿔 다시 씁니다. 값이 비면 그 속성만 지웁니다. */
export function setEditorDeclaration(css: string, input: {
  rootValue: string;
  nodeId: string;
  viewport: EditorViewport;
  property: string;
  value: string;
}) {
  const declarations = { ...readEditorDeclarations(css, input) };
  if (input.value.trim()) declarations[input.property] = input.value.trim();
  else delete declarations[input.property];
  return writeEditorDeclarations(css, { ...input, declarations });
}

export function setEditorDeclarations(css: string, input: {
  rootValue: string;
  nodeId: string;
  viewport: EditorViewport;
  declarations: Record<string, string>;
}) {
  const next = { ...readEditorDeclarations(css, input) };
  for (const [property, value] of Object.entries(input.declarations)) {
    if (value.trim()) next[property] = value.trim();
    else delete next[property];
  }
  return writeEditorDeclarations(css, { ...input, declarations: next });
}

/** 노드가 사라질 때 남은 편집 블록을 모두 정리합니다. */
export function removeEditorBlocks(css: string, nodeId: string) {
  return EDITOR_VIEWPORTS.reduce((current, viewport) => current.replace(blockPattern(nodeId, viewport), ""), css).trimEnd();
}

/**
 * 오른쪽/아래로 옮긴 요소가 문서 폭을 늘려 흰 공간을 만들지 않도록 잘라 냅니다.
 * clip은 hidden과 달리 스크롤 컨테이너를 만들지 않아 Preview 비율과 폭이 그대로 유지됩니다.
 */
export const OVERFLOW_CLIP_CSS = `html,body{overflow-x:clip;max-width:100%}
[data-moire-root]{overflow-x:clip;max-width:100%}
[data-moire-root] img{max-width:100%}`;
