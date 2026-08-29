import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveEditorIntent, type EditorIntent } from "../lib/editor/style-intent.ts";

const section = { tagName: "section", type: "hero" };
const image = { tagName: "img", type: "image" };
const metrics = { width: 1920, height: 720, fontSize: 48 };

function styleOf(intent: EditorIntent) {
  assert.equal(intent.kind, "style", JSON.stringify(intent));
  return (intent as Extract<EditorIntent, { kind: "style" }>);
}

test("레이아웃 세로폭 1.5배는 모델 없이 현재 높이 기준으로 계산된다", () => {
  const intent = styleOf(resolveEditorIntent({ prompt: "레이아웃 세로폭 1.5배", node: section, metrics }));
  assert.deepEqual(intent.declarations, { height: "1080px", "min-height": "1080px" });
  assert.match(intent.summary, /1080px/);
  assert.match(intent.summary, /태블릿·모바일/);
});

test("높이를 px로 직접 지정할 수도 있다", () => {
  const intent = styleOf(resolveEditorIntent({ prompt: "이 섹션 높이 900px로 해줘", node: section, metrics }));
  assert.deepEqual(intent.declarations, { height: "900px", "min-height": "900px" });
});

test("숫자 없는 레이아웃 세로폭 증감도 Inspector와 같은 height/min-height로 처리한다", () => {
  assert.deepEqual(styleOf(resolveEditorIntent({ prompt: "레이아웃 세로폭 늘려줘", node: section, metrics })).declarations, { height: "864px", "min-height": "864px" });
  assert.deepEqual(styleOf(resolveEditorIntent({ prompt: "이 영역 높이를 줄여줘", node: section, metrics })).declarations, { height: "576px", "min-height": "576px" });
});

test("이미지를 아래로 20px 요청은 translate로 바뀌고 기존 값에 누적된다", () => {
  const intent = styleOf(resolveEditorIntent({ prompt: "이미지를 아래로 20px", node: image }));
  assert.deepEqual(intent.declarations, { translate: "0px 20px" });

  const again = styleOf(resolveEditorIntent({ prompt: "아래로 30px 더 내려줘", node: { ...image, translate: "0px 20px" } }));
  assert.deepEqual(again.declarations, { translate: "0px 50px" });

  const left = styleOf(resolveEditorIntent({ prompt: "왼쪽으로 40px 옮겨줘", node: { ...image, translate: "10px 0px" } }));
  assert.deepEqual(left.declarations, { translate: "-30px 0px" });
});

test("헤더 두 줄 요청은 Header variant 교체로 처리된다", () => {
  const intent = resolveEditorIntent({ prompt: "헤더를 두줄 형식으로", node: section });
  assert.equal(intent.kind, "header-variant");
  assert.equal((intent as Extract<EditorIntent, { kind: "header-variant" }>).variant, "centered-brand");

  assert.equal((resolveEditorIntent({ prompt: "헤더 한 줄로 바꿔", node: section }) as { variant?: string }).variant, "split-utility");
  assert.equal((resolveEditorIntent({ prompt: "헤더를 투명 오버레이로", node: section }) as { variant?: string }).variant, "overlay-minimal");
});

test("헤더에서 지원하지 않는 요청은 가능한 선택지를 알려 준다", () => {
  const intent = resolveEditorIntent({ prompt: "헤더에 검색창을 하나 더 넣어줘", node: section });
  assert.equal(intent.kind, "unsupported");
  assert.match((intent as Extract<EditorIntent, { kind: "unsupported" }>).message, /두 줄/);
});

test("상품 카드 안의 사진·값 요청은 보호 이유를 설명한다", () => {
  const intent = resolveEditorIntent({ prompt: "이 상품 이미지 다른 걸로 바꿔줘", node: { tagName: "img", type: "image", insideProductSlot: true } });
  assert.equal(intent.kind, "unsupported");
  assert.match((intent as Extract<EditorIntent, { kind: "unsupported" }>).message, /Cafe24 상품 데이터/);
});

test("글자 크기와 확대/축소도 결정적으로 처리된다", () => {
  assert.deepEqual(styleOf(resolveEditorIntent({ prompt: "글씨 크기 72px로", node: section, metrics })).declarations, { "font-size": "72px" });
  assert.deepEqual(styleOf(resolveEditorIntent({ prompt: "글씨를 2배로 키워줘", node: section, metrics })).declarations, { "font-size": "96px" });
  assert.deepEqual(styleOf(resolveEditorIntent({ prompt: "이미지를 80%로 축소", node: image })).declarations, { scale: "0.8" });
});

test("측정값이 없으면 실패 대신 무엇을 해야 하는지 알려 준다", () => {
  const intent = resolveEditorIntent({ prompt: "세로폭 1.5배", node: section });
  assert.equal(intent.kind, "unsupported");
  assert.match((intent as Extract<EditorIntent, { kind: "unsupported" }>).message, /선택/);
});

test("해석되지 않는 요청만 모델로 넘어간다", () => {
  for (const prompt of ["이 Hero를 더 고급스럽게", "구조를 완전히 새롭게", "카피를 다시 써줘"]) {
    assert.equal(resolveEditorIntent({ prompt, node: section, metrics }).kind, "model", prompt);
  }
});

test("결정적 일반 편집은 자유형 AI 입력이 아니라 Inspector에만 남는다", async () => {
  const source = await readFile(new URL("../components/editor/editor-shell.tsx", import.meta.url), "utf8");
  assert.equal(source.includes("submitAiEdit"), false);
  assert.equal(source.includes("resolveEditorIntent"), false);
  assert.ok(source.includes("onHeaderVariant"));
  assert.ok(source.includes("NumericSlider"));
  assert.ok(source.includes("색상, 여백, 글자 크기, 정렬, 상품 배열"));
  assert.ok(source.includes("if (next.html === before.html && next.css === before.css)"), "모델 편집도 실제 diff를 확인해야 합니다.");
  assert.ok(source.includes("verifyVisibleSelectionChange"), "문자열 diff 뒤 실제 computed 결과도 확인해야 합니다.");
  assert.ok(source.includes("discardUnappliedChange"), "화면 변화가 없는 변경은 성공 처리하지 않고 취소해야 합니다.");
});

test("편집 보호검사는 새로 들어온 이미지만 심판한다", async () => {
  const generator = await readFile(new URL("../lib/openai/site-generator.ts", import.meta.url), "utf8");
  assert.ok(generator.includes("const introduced = new Set(existingReferences.map"));
  assert.ok(generator.includes("!introduced.has(violation.token)"), "이미 있던 이미지로 CSS 수정을 막지 않습니다.");
});

test("모델의 빈 style patch는 성공 응답 전에 차단한다", async () => {
  const generator = await readFile(new URL("../lib/openai/site-generator.ts", import.meta.url), "utf8");
  assert.ok(generator.includes('editIntent === "style-only" && !parsed.nodeCss.trim()'));
  assert.match(generator, /실제로 적용할 스타일 값을 만들지 못했습니다/);
});
