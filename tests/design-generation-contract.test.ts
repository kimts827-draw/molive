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

const frameHtml = `<div data-moire-root="frame-test">
  <main>
    <section data-moire-id="hero" data-moire-type="hero"><h1>Brand</h1></section>
    <section data-moire-id="category" data-moire-type="section"><p>Collection</p></section>
    <section class="shopProducts" data-moire-id="products" data-moire-type="products">
      <div class="shopProducts__intro"><h2>신상품</h2><a class="shopProducts__more" href="/product/list.html">전체 보기</a></div>
      <div class="shopProducts__slot" data-cafe24-slot="product-list"></div>
    </section>
    <section data-moire-id="story" data-moire-type="section"><p>Story</p></section>
  </main>
</div>`;
const frameCodes = (css: string) =>
  validateGeneratedDesignContract({ html: frameHtml, css: `${css}\n@media(max-width:767px){[data-moire-root="frame-test"] section{padding:48px 20px}}` }).map((item) => item.code);

test("상품 슬롯을 굶기는 프레임(좁은 measure·다중 트랙 grid)은 생성 단계에서 되돌린다", () => {
  assert.ok(frameCodes('[data-moire-root="frame-test"] .shopProducts{max-width:420px;margin:0 auto}').includes("PRODUCT_FRAME_NARROW"));
  assert.ok(frameCodes('[data-moire-root="frame-test"] .shopProducts{width:min(100% - 64px, 520px)}').includes("PRODUCT_FRAME_NARROW"));
  assert.ok(frameCodes('[data-moire-root="frame-test"] .shopProducts__slot{max-width:26rem}').includes("PRODUCT_FRAME_NARROW"));
  assert.ok(frameCodes('[data-moire-root="frame-test"] .shopProducts{display:grid;grid-template-columns:repeat(4, 1fr);gap:24px}').includes("PRODUCT_FRAME_GRID_TRACK"));
  assert.ok(frameCodes('[data-moire-root="frame-test"] .shopProducts{display:grid;grid-template-columns:280px 1fr}').includes("PRODUCT_FRAME_GRID_TRACK"));
  assert.ok(frameCodes('[data-moire-root="frame-test"] .shopProducts{display:grid;grid-auto-flow:column}').includes("PRODUCT_FRAME_GRID_TRACK"));
  // class 대신 편집 ID로 지면을 잡아도 같은 계약입니다.
  assert.ok(frameCodes('[data-moire-root="frame-test"] [data-moire-id="products"]{max-width:480px}').includes("PRODUCT_FRAME_NARROW"));
});

test("정상 상품 프레임은 좁은 자식·모바일 override·단일 트랙 grid까지 통과시킨다", () => {
  // 위반 하나가 생성 1건을 통째로 재시도시키므로 오탐이 없어야 합니다.
  for (const css of [
    '[data-moire-root="frame-test"] .shopProducts{width:min(100% - 64px, 1200px);margin:0 auto}',
    '[data-moire-root="frame-test"] .shopProducts{width:calc(100% - 40px)}',
    '[data-moire-root="frame-test"] .shopProducts{display:grid;grid-template-columns:repeat(1, 1fr);row-gap:40px}',
    '[data-moire-root="frame-test"] .shopProducts{display:grid;grid-template-columns:1fr}',
    // 좁은 것은 슬롯이 아니라 그 옆 카피·링크입니다.
    '[data-moire-root="frame-test"] .shopProducts__intro p{max-width:420px}',
    '[data-moire-root="frame-test"] .shopProducts__more{max-width:180px}',
    // 다중 트랙 grid지만 슬롯의 부모가 아니라 헤딩 줄입니다.
    '[data-moire-root="frame-test"] .shopProducts__intro{display:grid;grid-template-columns:1fr auto}',
    // 좁은 화면에서 좁아지는 것은 정상입니다.
    '[data-moire-root="frame-test"] .shopProducts{width:min(100% - 64px, 1200px)}\n@media(max-width:600px){[data-moire-root="frame-test"] .shopProducts{max-width:360px}}',
  ]) {
    const codes = frameCodes(css);
    assert.equal(codes.includes("PRODUCT_FRAME_NARROW"), false, css);
    assert.equal(codes.includes("PRODUCT_FRAME_GRID_TRACK"), false, css);
  }
});

test("AI CSS의 !important는 고정 Header/Product 격리를 우회할 수 없어 거부한다", () => {
  const codes = validateGeneratedDesignContract({ html: validHtml, css: `${validCss}\n[data-moire-root="quality-test"] img{width:1px!important}` }).map((item) => item.code);
  assert.ok(codes.includes("CSS_IMPORTANT_FORBIDDEN"));
});
