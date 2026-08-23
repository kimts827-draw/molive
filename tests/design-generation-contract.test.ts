import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildDesignGenerationUserPrompt, validateGeneratedDesignContract } from "../lib/openai/design-generation-contract.ts";

const briefs = [
  "미니멀하고 고급스러운 여성 패션몰",
  "따뜻하고 감성적인 수제 디저트 브랜드",
  "강하고 테크니컬한 자동차 용품 쇼핑몰",
] as const;

const validHtml = `<div data-moire-root="quality-test">
  <main>
    <section data-moire-id="hero" data-moire-type="hero"><h1 data-moire-id="hero-title" data-moire-type="text">Brand</h1></section>
    <section data-moire-id="category" data-moire-type="section"><p data-moire-id="category-copy" data-moire-type="text">Collection</p></section>
    <section data-moire-id="products" data-moire-type="products"><div data-cafe24-slot="product-list"></div></section>
    <section data-moire-id="story" data-moire-type="section"><p data-moire-id="story-copy" data-moire-type="text">Story</p></section>
  </main>
</div>`;
const validCss = `[data-moire-root="quality-test"]{color:#111;background:#fff}
[data-moire-root="quality-test"] section{padding:clamp(48px,8vw,120px)}
@media(max-width:767px){[data-moire-root="quality-test"] section{padding:48px 20px}}`;

test("세 판매 검증 brief는 동일 템플릿이 아니라 여섯 구조 축을 별도로 결정하도록 전달된다", () => {
  const prompts = briefs.map((prompt) => buildDesignGenerationUserPrompt({ prompt }));
  assert.equal(new Set(prompts).size, briefs.length);
  for (const [index, prompt] of prompts.entries()) {
    assert.ok(prompt.includes(`Creative brief: ${briefs[index]}`));
    for (const axis of ["headerVariant", "heroComposition", "productLayout", "section order and selection", "typography scale", "image treatment", "spacing/density", "content composition"]) {
      assert.ok(prompt.includes(axis), axis);
    }
    assert.match(prompt, /Do not merely recolor a generic storefront/);
  }
});

test("생성 system instruction은 38개 레퍼런스에서 압축한 디자인 문법과 선택 규칙을 명시한다", async () => {
  const source = await readFile(new URL("../lib/openai/site-generator.ts", import.meta.url), "utf8");
  for (const rule of [
    "full-bleed composition",
    "split-editorial composition",
    "commerce-forward and dense or editorial and spacious",
    "split-media or a strong editorial composition",
    "Do not include every type by default",
    "A materially different brief must produce visibly different decisions",
    "Every desktop composition must define a deliberate mobile stack/reflow",
  ]) assert.ok(source.includes(rule), rule);
  assert.match(source, /Never output a header element/);
  assert.match(source, /exactly one primary product area/);
});

test("새 AI draft는 완성형 쇼핑몰 최소 구성과 모바일 reflow를 통과한다", () => {
  assert.deepEqual(validateGeneratedDesignContract({ html: validHtml, css: validCss }), []);
});

test("Header·중복/비어있지 않은 상품 슬롯·verified 상품 CSS·얕은 페이지를 생성 단계에서 거부한다", () => {
  const invalidHtml = `<div data-moire-root="invalid"><header>AI Header</header><main><section data-moire-type="hero"></section><section><div data-cafe24-slot="product-list"><article>AI card</article></div><div data-cafe24-slot="product-list"></div></section></main></div>`;
  const invalidCss = `[data-moire-root="invalid"] .prdList{display:grid}`;
  const codes = validateGeneratedDesignContract({ html: invalidHtml, css: invalidCss }).map((item) => item.code);

  for (const code of ["PRODUCT_SLOT_COUNT", "PRODUCT_SLOT_NOT_EMPTY", "GENERATED_HEADER", "INSUFFICIENT_PAGE_COMPOSITION", "MISSING_MOBILE_REFLOW", "VERIFIED_PRODUCT_CSS"]) {
    assert.ok(codes.includes(code), code);
  }
});

test("AI CSS의 !important는 고정 Header/Product 격리를 우회할 수 없어 거부한다", () => {
  const codes = validateGeneratedDesignContract({ html: validHtml, css: `${validCss}\n[data-moire-root="quality-test"] img{width:1px!important}` }).map((item) => item.code);
  assert.ok(codes.includes("CSS_IMPORTANT_FORBIDDEN"));
});
