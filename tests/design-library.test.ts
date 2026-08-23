import assert from "node:assert/strict";
import test from "node:test";
import { REFERENCE_PATTERNS, referencePatternById } from "../lib/design-library/reference-patterns.ts";
import { HEADER_STRUCTURES, HERO_VARIANT_IDS, HERO_VARIANTS, PRODUCT_PRESENTATIONS, SECTION_VARIANTS, FOOTER_MOODS } from "../lib/design-library/variants.ts";
import { composeDesignBlueprint, inferIndustry, renderBlueprintContract } from "../lib/design-library/blueprint.ts";
import { buildDesignGenerationUserPrompt, validateGeneratedDesignContract } from "../lib/openai/design-generation-contract.ts";

const fashionBrief = { prompt: "미니멀하고 고급스러운 여성 패션 의류 쇼핑몰. 시즌 컬렉션과 룩북 중심.", brandName: "MAISON" };
const dessertBrief = { prompt: "따뜻하고 감성적인 수제 디저트 브랜드. 선물하기 좋은 쿠키와 케이크.", brandName: "온담" };
const autoBrief = { prompt: "강하고 테크니컬한 자동차 튜닝 용품 쇼핑몰. 정밀한 장비와 신뢰.", brandName: "GARAGE" };

test("모든 variant는 실제 레퍼런스 패턴에 근거를 남긴다", () => {
  const variants = [...Object.values(HERO_VARIANTS), ...Object.values(SECTION_VARIANTS), ...Object.values(FOOTER_MOODS)];
  assert.ok(variants.length >= 20);
  for (const variant of variants) {
    assert.ok(variant.basedOn.length >= 1, variant.id);
    for (const ref of variant.basedOn) assert.ok(referencePatternById(ref), `${variant.id} → ${ref}`);
  }
  for (const pattern of REFERENCE_PATTERNS) assert.ok(pattern.observedIn.length >= 1, pattern.id);
});

test("hero variant 라이브러리는 기존 두 값을 호환 유지하며 여섯 가지로 확장된다", () => {
  assert.deepEqual(HERO_VARIANT_IDS.slice(0, 2), ["full-bleed", "split-editorial"]);
  assert.equal(HERO_VARIANT_IDS.length, 6);
  for (const id of HERO_VARIANT_IDS) assert.equal(HERO_VARIANTS[id].id, id);
});

test("업종 추론은 패션·디저트·자동차 brief를 서로 다른 업종으로 분류한다", () => {
  assert.equal(inferIndustry(fashionBrief.prompt), "fashion");
  assert.equal(inferIndustry(dessertBrief.prompt), "food-dessert");
  assert.equal(inferIndustry(autoBrief.prompt), "auto-tech");
  assert.equal(inferIndustry("아무 관련 없는 종합 스토어"), "general");
});

test("같은 시드는 같은 blueprint를, 시드 없이도 유효한 blueprint를 만든다", () => {
  const first = composeDesignBlueprint(fashionBrief, 7);
  const second = composeDesignBlueprint(fashionBrief, 7);
  assert.deepEqual(
    { flowId: first.flowId, hero: first.hero.id, sections: first.sections.map((section) => section.ref) },
    { flowId: second.flowId, hero: second.hero.id, sections: second.sections.map((section) => section.ref) },
  );
  const random = composeDesignBlueprint(fashionBrief);
  assert.ok(random.sections.filter((section) => section.ref.startsWith("products/")).length === 1);
});

test("패션·디저트·자동차의 어떤 flow 조합도 구조가 겹치지 않는다", () => {
  const sequences = new Map<string, string>();
  for (const brief of [fashionBrief, dessertBrief, autoBrief]) {
    // 시드를 넓게 돌려 업종의 모든 flow를 수집한다.
    for (let seed = 0; seed < 64; seed += 1) {
      const blueprint = composeDesignBlueprint(brief, seed);
      const sequence = [`header/${blueprint.header.id}`, `hero/${blueprint.hero.id}`, ...blueprint.sections.map((section) => section.ref), `presentation/${blueprint.productPresentation.id}`].join(" > ");
      const owner = sequences.get(sequence);
      assert.ok(!owner || owner === blueprint.industry, `구조 중복: ${sequence}`);
      sequences.set(sequence, blueprint.industry);
    }
  }
  // 세 업종이 실제로 서로 다른 구조 집합을 냈는지도 확인한다.
  const industries = new Set(sequences.values());
  assert.deepEqual([...industries].sort(), ["auto-tech", "fashion", "food-dessert"]);
  assert.ok(sequences.size >= 8, `수집된 구조가 너무 적습니다: ${sequences.size}`);
});

test("blueprint 계약 텍스트는 hero·섹션 spec과 architecture 기록 규칙을 담는다", () => {
  const blueprint = composeDesignBlueprint(autoBrief, 1);
  const contract = renderBlueprintContract(blueprint);
  assert.ok(contract.includes(`hero/${blueprint.hero.id}`));
  assert.ok(contract.includes(blueprint.hero.spec.slice(0, 20)));
  for (const section of blueprint.sections) assert.ok(contract.includes(section.ref), section.ref);
  assert.ok(contract.includes("architecture.hero"));
  assert.ok(contract.includes("architecture.header"));
  assert.ok(contract.includes("architecture.productPresentation"));
  assert.ok(contract.includes(`Header = ${blueprint.header.id}`));
  assert.ok(contract.includes(`Product presentation = ${blueprint.productPresentation.id}`));
  assert.ok(contract.includes("data-cafe24-slot=\"product-list\""));
});

test("세 업종의 product presentation과 header 조합이 서로 다른 사이트처럼 갈라진다", () => {
  const collect = (brief: { prompt: string; brandName?: string }) => {
    const presentations = new Set<string>();
    const headers = new Set<string>();
    for (let seed = 0; seed < 64; seed += 1) {
      const blueprint = composeDesignBlueprint(brief, seed);
      presentations.add(blueprint.productPresentation.id);
      headers.add(blueprint.header.id);
    }
    return { presentations, headers };
  };
  const fashion = collect(fashionBrief);
  const dessert = collect(dessertBrief);
  const auto = collect(autoBrief);
  // 업종 간 진열이 겹치지 않아야 "전부 4열 grid" 회귀가 원천 차단된다.
  for (const id of fashion.presentations) {
    assert.ok(!dessert.presentations.has(id) && !auto.presentations.has(id), `패션 진열 ${id}가 다른 업종과 겹칩니다`);
  }
  for (const id of dessert.presentations) assert.ok(!auto.presentations.has(id), `디저트 진열 ${id}가 자동차와 겹칩니다`);
  assert.deepEqual([...dessert.presentations], ["featured-grid"]);
  assert.deepEqual([...auto.presentations], ["compact-five"]);
  for (const set of [fashion.presentations, dessert.presentations, auto.presentations]) {
    assert.ok(![...set].every((id) => id === "grid-four"), "모든 결과가 standard 4-grid면 실패입니다");
  }
});

test("user prompt는 blueprint 계약을 포함하고 blueprint 없이도 기존 형태를 유지한다", () => {
  const blueprint = composeDesignBlueprint(dessertBrief, 2);
  const withBlueprint = buildDesignGenerationUserPrompt(dessertBrief, blueprint);
  assert.ok(withBlueprint.includes("DESIGN BLUEPRINT"));
  assert.ok(withBlueprint.includes(blueprint.hero.id));
  const without = buildDesignGenerationUserPrompt(dessertBrief);
  assert.ok(!without.includes("DESIGN BLUEPRINT"));
  assert.ok(without.includes("heroComposition (full-bleed | split-editorial | banner-stack | typographic-marquee | cinematic-still | product-forward)"));
});

test("blueprint 검증은 hero 미기록·섹션 누락을 거부하고 정확한 기록을 통과시킨다", () => {
  const blueprint = composeDesignBlueprint(fashionBrief, 3);
  const html = `<div data-moire-root="library-test"><main>
    <section data-moire-id="hero" data-moire-type="hero"><h1 data-moire-id="t" data-moire-type="text">B</h1></section>
    <section data-moire-id="a" data-moire-type="section"><p data-moire-id="p1" data-moire-type="text">a</p></section>
    <section data-moire-id="products" data-moire-type="products"><div data-cafe24-slot="product-list"></div></section>
  </main></div>`;
  const css = `[data-moire-root="library-test"]{color:#111}
@media(max-width:767px){[data-moire-root="library-test"] section{padding:40px 20px}}`;

  const mismatch = validateGeneratedDesignContract({ html, css, architecture: { hero: "full-bleed", header: "split-utility", productPresentation: "grid-four", sections: [] } }, { ...blueprint, hero: { ...blueprint.hero, id: "split-editorial" }, header: HEADER_STRUCTURES["centered-brand"], productPresentation: PRODUCT_PRESENTATIONS["editorial-two"] });
  const codes = mismatch.map((violation) => violation.code);
  assert.ok(codes.includes("BLUEPRINT_HERO_MISMATCH"));
  assert.ok(codes.includes("BLUEPRINT_HEADER_MISMATCH"));
  assert.ok(codes.includes("BLUEPRINT_PRODUCT_MISMATCH"));
  assert.ok(codes.includes("BLUEPRINT_SECTIONS_MISSING"));

  const exact = validateGeneratedDesignContract({
    html,
    css,
    architecture: {
      hero: blueprint.hero.id,
      header: blueprint.header.id,
      productPresentation: blueprint.productPresentation.id,
      sections: blueprint.sections.map((section) => `${section.ref} — 설명`),
    },
  }, blueprint);
  assert.ok(!exact.some((violation) => violation.code.startsWith("BLUEPRINT_")));
});
