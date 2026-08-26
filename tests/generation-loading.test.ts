import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const composer = await readFile(new URL("../components/landing/prompt-composer.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("생성 로딩 화면은 가짜 진행률 없이 여덟 제작 단계를 순환한다", () => {
  for (const message of [
    "브랜드의 분위기를 분석하고 있어요",
    "쇼핑몰의 전체 구조를 설계하고 있어요",
    "상품이 돋보이는 레이아웃을 만들고 있어요",
    "브랜드에 어울리는 비주얼을 준비하고 있어요",
    "섹션별 디자인을 세밀하게 다듬고 있어요",
    "PC와 모바일 화면의 균형을 맞추고 있어요",
    "마지막 디테일을 정리하고 있어요",
    "MOLIVE가 쇼핑몰을 완성하고 있어요",
  ]) assert.match(composer, new RegExp(message));
  assert.match(composer, /setInterval[\s\S]*4_800/);
  assert.match(composer, /role="progressbar"/);
  assert.doesNotMatch(composer, /aria-valuenow|generationProgress|progressPercent/);
});

test("생성 로딩 화면은 도움말과 모바일·저동작 환경 스타일을 제공한다", () => {
  assert.match(composer, /AI 디자인 생성에는 몇 분 정도 걸릴 수 있어요\. 창을 닫지 말아주세요\./);
  assert.match(composer, /생성 후 Editor에서 글자와 색상을 직접 수정할 수 있어요/);
  assert.match(composer, /마음에 들지 않는 부분은 AI에게 다시 수정 요청할 수 있어요/);
  assert.match(composer, /완성된 디자인은 ZIP으로 내려받아 Cafe24에 적용할 수 있어요/);
  assert.match(styles, /\.generation-loading/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*\.generation-loading/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
