import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const landing = await readFile(new URL("../components/landing/landing-page.tsx", import.meta.url), "utf8");
const composer = await readFile(new URL("../components/landing/prompt-composer.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../components/landing/landing-sales.module.css", import.meta.url), "utf8");

test("초보자용 판매 랜딩은 요청된 핵심 흐름을 짧은 섹션으로 제공한다", () => {
  for (const copy of [
    "10분 만에, 내 브랜드에 맞는",
    "AI라서 다 비슷할 것 같나요?",
    "보기만 하는 디자인이 아닙니다.",
    "꼭 큰 비용부터 써야 할까요?",
    "첫 번째 디자인이 정답일 필요는 없습니다.",
    "HTML이나 CSS를 몰라도 됩니다.",
    "상품을 다시 등록할",
    "결제하기 전에",
    "디자인을 사는 대신, 만들어보세요.",
    "자주 묻는 질문",
    "내 쇼핑몰이라면",
  ]) assert.match(landing, new RegExp(copy));
  assert.match(landing, /\["AI 생성", "Editor", "Download", "Installer", "Cafe24"\]/);
  assert.match(landing, /CREDIT_PLANS\.map/);
  assert.match(landing, /CREDIT_COSTS\.designGeneration/);
});

test("프롬프트 생성 기능은 유지하고 기본 버튼 문구는 생성하기로 표시한다", () => {
  assert.match(landing, /<PromptComposer/);
  assert.match(composer, /<>생성하기 <ArrowRight/);
  assert.match(composer, /fetch\("\/api\/ai\/generate"/);
  assert.match(landing, /가입 즉시 15 Credit · 디자인 1회 \+ AI 수정 5회 · 카드 등록 없음/);
});

test("실제 이미지가 없는 업종별 결과 자리와 모바일 레이아웃을 제공한다", () => {
  for (const category of ["자동차용품", "패션", "뷰티", "라이프스타일"]) assert.match(landing, new RegExp(category));
  assert.match(landing, /실제 결과 이미지 자리/);
  assert.match(styles, /@media \(max-width: 680px\)/);
  assert.match(styles, /\.resultGrid/);
  assert.match(styles, /\.resultCard/);
});
