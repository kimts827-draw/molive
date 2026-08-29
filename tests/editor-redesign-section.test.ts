import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { dedupeNodePatchIds, demoteForbiddenChrome, validateNodePatch, validateNodePatchStructure, validateProjectSource } from "../lib/cafe24/protection.ts";
import { HEADER_NODE_ID } from "../lib/commerce/fixed-components.ts";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const ROOT = "moire-redesign";
const SECTION = "story-1";
const before = `<section data-moire-id="${SECTION}" data-moire-type="section" data-moire-plan="${SECTION}" data-moire-tone="tinted" data-moire-container="boxed" data-moire-surface="flat"><h2 data-moire-id="story-title" data-moire-type="text">우리가 만드는 방식</h2><p data-moire-id="story-body" data-moire-type="text">10년 동안 같은 공방에서 만듭니다.</p><img data-moire-id="story-photo" data-moire-type="image" src="https://images.unsplash.com/photo-a?w=1600" alt="공방"></section>`;

function rebuilt(inner: string, attributes = 'data-moire-plan="story-1" data-moire-tone="tinted" data-moire-container="boxed" data-moire-surface="flat"') {
  return `<section data-moire-id="${SECTION}" data-moire-type="section" ${attributes}>${inner}</section>`;
}

test("재디자인 patch는 섹션 루트·plan 축·상품 슬롯·header 계약을 그대로 받는다", () => {
  const after = rebuilt('<figure data-moire-id="story-1-media" data-moire-type="image"><img data-moire-id="story-1-photo" data-moire-type="image" src="https://images.unsplash.com/photo-a?w=1600" alt="공방"></figure><div data-moire-id="story-1-copy" data-moire-type="section"><h2 data-moire-id="story-1-title" data-moire-type="text">우리가 만드는 방식</h2><p data-moire-id="story-1-body" data-moire-type="text">10년 동안 같은 공방에서 만듭니다.</p></div>');
  assert.deepEqual(validateNodePatchStructure({ operation: "redesign-section", before, after }).violations, []);

  const cases: Array<[string, string]> = [
    ["PLAN_ATTRIBUTES_LOST", rebuilt("<p data-moire-id=\"x\" data-moire-type=\"text\">a</p>", 'data-moire-plan="story-1" data-moire-tone="dark" data-moire-container="boxed" data-moire-surface="flat"')],
    ["SECTION_ROOT_TAG_CHANGED", after.replace("<section ", "<div ").replace("</section>", "</div>")],
    ["PRODUCT_SLOT_CREATED", after.replace("</section>", '<div data-cafe24-slot="product-list"></div></section>')],
    ["HEADER_ELEMENT_CREATED", after.replace("</section>", "<header>로고</header></section>")],
  ];
  for (const [code, broken] of cases) {
    const report = validateNodePatchStructure({ operation: "redesign-section", before, after: broken });
    assert.equal(report.safe, false, code);
    assert.ok(report.violations.some((violation) => violation.code === code), `${code}: ${report.violations.map((item) => item.code).join(", ")}`);
  }

  // 노드 CSS 계약은 기존 검사가 그대로 담당합니다.
  const nodeCss = `[data-moire-root="${ROOT}"] [data-moire-id="${SECTION}"]{display:grid;gap:32px}`;
  assert.equal(validateNodePatch({ nodeId: SECTION, rootValue: ROOT, nodeHtml: after, nodeCss }).safe, true);
});

test("다른 섹션이 쓰는 편집 ID는 재시도 없이 코드가 이름을 바꾼다", () => {
  const reservedIds = ["hero-1", "hero-title", "products-1", "story-title"];
  const nodeHtml = rebuilt('<h2 data-moire-id="story-title" data-moire-type="text">제목</h2><p data-moire-id="hero-title" data-moire-type="text">본문</p><p data-moire-id="story-1-safe" data-moire-type="text">안전</p>');
  const nodeCss = `[data-moire-root="${ROOT}"] [data-moire-id="${SECTION}"] [data-moire-id="hero-title"]{color:red}`;
  const result = dedupeNodePatchIds({ rootId: SECTION, reservedIds, nodeHtml, nodeCss });

  // 루트 ID는 patch 계약의 기준이라 절대 바뀌지 않습니다.
  assert.ok(result.nodeHtml.startsWith(`<section data-moire-id="${SECTION}"`));
  // 다른 섹션과 겹친 ID만 바뀌고, 겹치지 않은 ID는 그대로입니다.
  assert.equal(result.nodeHtml.includes('data-moire-id="story-title"'), false);
  assert.equal(result.nodeHtml.includes('data-moire-id="hero-title"'), false);
  assert.ok(result.nodeHtml.includes('data-moire-id="story-1-safe"'));
  assert.deepEqual(result.renamed.map((item) => item.from).sort(), ["hero-title", "story-title"]);
  // 이름을 바꾼 ID는 CSS 선택자에서도 함께 바뀌어 스타일이 끊기지 않습니다.
  const renamedHero = result.renamed.find((item) => item.from === "hero-title")?.to as string;
  assert.ok(result.nodeCss.includes(`[data-moire-id="${renamedHero}"]`));
  assert.equal(result.nodeCss.includes('[data-moire-id="hero-title"]'), false);
  // 새 이름도 예약 ID와 겹치지 않습니다.
  const finalIds = [...result.nodeHtml.matchAll(/data-moire-id="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(finalIds.filter((id) => reservedIds.includes(id)).length, 0);
  assert.equal(new Set(finalIds).size, finalIds.length);
  // 정리 뒤에는 구조 검사의 ID 충돌도 남지 않습니다.
  assert.deepEqual(validateNodePatchStructure({ operation: "redesign-section", before, after: result.nodeHtml, reservedIds }).violations, []);
  // 정리 전이라면 충돌로 잡힙니다.
  assert.ok(validateNodePatchStructure({ operation: "redesign-section", before, after: nodeHtml, reservedIds }).violations.some((item) => item.code === "NODE_ID_COLLISION"));
});

test("섹션 제목을 header로 감싼 마크업은 실패시키지 않고 div로 낮춘다", () => {
  const withHeader = rebuilt('<header data-moire-id="story-1-head" data-moire-type="text"><h2 data-moire-id="story-1-title" data-moire-type="text">제목</h2></header><p data-moire-id="story-1-body" data-moire-type="text">본문</p>');
  // 그대로 두면 Export의 FIXED_HEADER_ONLY에서 문서 전체가 거절됩니다.
  assert.ok(validateNodePatchStructure({ operation: "redesign-section", before, after: withHeader }).violations.some((item) => item.code === "HEADER_ELEMENT_CREATED"));

  const demoted = demoteForbiddenChrome(withHeader);
  assert.equal(demoted.changed, true);
  assert.equal(/<header/i.test(demoted.html), false);
  // 내용과 편집 ID는 그대로 남습니다.
  assert.ok(demoted.html.includes('data-moire-id="story-1-head"'));
  assert.ok(demoted.html.includes("제목") && demoted.html.includes("본문"));
  assert.deepEqual(validateNodePatchStructure({ operation: "redesign-section", before, after: demoted.html }).violations, []);
  assert.equal(demoteForbiddenChrome(demoted.html).changed, false);
});

test("patch 안에서 중복된 ID도 하나만 남기고 갈라 준다", () => {
  const nodeHtml = rebuilt('<p data-moire-id="dup" data-moire-type="text">1</p><p data-moire-id="dup" data-moire-type="text">2</p>');
  const result = dedupeNodePatchIds({ rootId: SECTION, reservedIds: [], nodeHtml, nodeCss: "" });
  const ids = [...result.nodeHtml.matchAll(/data-moire-id="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(result.duplicated, ["dup"]);
});

test("상품 섹션·Header·section이 아닌 선택은 Credit 예약 전에 거절된다", async () => {
  const route = await read("app/api/ai/edit/route.ts");
  assert.match(route, /if \(parsedInput\.data\.operation === "redesign-section"\)/);
  assert.match(route, /nodeId === HEADER_NODE_ID/);
  assert.match(route, /data-cafe24-slot\/i\.test\(nodeHtml\)/);
  assert.match(route, /\^\\s\*<section\[\\s>\]\/i\.test\(nodeHtml\)/);
  // 가드가 예약보다 먼저 있어야 거절된 요청이 Credit을 잡지 않습니다.
  assert.ok(route.indexOf('operation === "redesign-section"') < route.indexOf("await reserveAiCredits("));
  assert.equal(HEADER_NODE_ID.length > 0, true);
});

test("재디자인은 structure mode로 고정되고 원본의 목적·사실·사진을 지킨다", async () => {
  const generator = await read("lib/openai/site-generator.ts");
  // style-only 분류를 타지 않습니다. 타면 HTML이 그대로 돌아와 아무것도 바뀌지 않습니다.
  assert.match(generator, /const sectionOperation = operation !== "node-edit"/);
  assert.match(generator, /const editIntent = sectionOperation \? "general" : classifyAiEditIntent/);
  assert.match(generator, /\$\{operation === "redesign-section" \? redesignSystemPrompt : ""\}/);
  assert.match(generator, /operation === "redesign-section"\s*\?\s*`\$\{planContext/);
  for (const rule of [
    "keep what the section is for",
    "never drop information the merchant already published",
    "Keep the photos that are already in this section by copying their src verbatim",
    "This is a structural redesign, not a restyle",
    "Never output data-cafe24-slot",
    "Prefix new ids with the section root id",
  ]) assert.ok(generator.includes(rule), rule);
  // 구조가 그대로면 성공으로 보고하지 않습니다. nodeCss만 갈아 끼우면 이전 재디자인 CSS가 지워집니다.
  assert.ok(generator.includes('operation === "redesign-section" && patch.nodeHtml.replace('));
  assert.ok(generator.includes('=== input.nodeHtml.replace('));
  assert.match(generator, /섹션 구조를 실제로 바꾸지 않았습니다/);
  // 섹션 단위 작업은 잘림 여유를 더 받습니다.
  assert.match(generator, /max_output_tokens: sectionOperation \? 24000 : 16000/);
  // header 태그는 요청을 실패시키는 대신 코드가 낮춥니다.
  assert.match(generator, /const chrome = demoteForbiddenChrome\(patch\.nodeHtml\)/);
  assert.ok(generator.includes("Do not use a <header> element at all"));
});

test("Editor는 텍스트 선택을 섹션 루트로 올리고 실패 시 원본을 그대로 둔다", async () => {
  const shell = await read("components/editor/editor-shell.tsx");
  // 텍스트를 골라도 sectionNodeId()가 섹션 루트를 돌려주고 그 값으로 요청합니다.
  assert.match(shell, /async function redesignSection\(brief: string\) \{/);
  assert.match(shell, /const id = sectionNodeId\(\);/);
  assert.match(shell, /const target = \{ id, type: "section", tagName: "section" \};/);
  // 상품 진열과 Header는 요청 자체를 만들지 않습니다.
  assert.match(shell, /if \(node\?\.isHeader\) \{ setToast/);
  // 상품 섹션 안의 문단을 골라도 승격될 섹션 루트를 기준으로 잠급니다.
  assert.match(shell, /function sectionOwnsProductSlot\(source: ProjectSource, sectionId: string \| null\)/);
  assert.match(shell, /const activeSectionOwnsProducts = useMemo\(/);
  assert.match(shell, /node\.isProductSection \|\| node\.insideProductSlot \|\| activeSectionOwnsProducts/);
  assert.match(shell, /disabled=\{activeSectionOwnsProducts\}/);
  // 서버에 넘길 예약 ID는 선택 섹션 밖 ID만 모읍니다.
  assert.match(shell, /function reservedNodeIds\(source: ProjectSource, sectionId: string\)/);
  assert.match(shell, /reservedNodeIds: reservedNodeIds\(baseSource, id\)/);
  assert.match(shell, /operation: "redesign-section"/);
  // 실패 경로는 requestAiPatch가 원본을 되돌리고 Credit도 discarded로 정산합니다.
  assert.match(shell, /원래 섹션은 그대로 두었습니다/);
  assert.match(shell, /discardUnappliedChange\(before, previousFuture\)/);
});

test("재디자인 결과도 문서 전체 보호검사를 통과해야 저장·Export된다", () => {
  const rebuiltSection = rebuilt('<div data-moire-id="story-1-copy" data-moire-type="section"><h2 data-moire-id="story-1-title" data-moire-type="text">우리가 만드는 방식</h2></div>');
  const source = {
    html: `<div data-moire-root="${ROOT}"><main><section data-moire-id="products-1" data-moire-type="products"><div data-cafe24-slot="product-list"></div></section>${rebuiltSection}</main></div>`,
    css: `[data-moire-root="${ROOT}"] [data-moire-id="${SECTION}"]{padding-block:96px}`,
  };
  assert.deepEqual(validateProjectSource(source).violations, []);
});
