import assert from "node:assert/strict";
import test from "node:test";
import { REFERENCE_PATTERNS, referencePatternById } from "../lib/design-library/reference-patterns.ts";
import { FOOTER_MOODS, HEADER_STRUCTURES, HERO_VARIANT_IDS, HERO_VARIANTS, IMAGE_TREATMENTS, PRODUCT_PRESENTATIONS, TYPE_SCALES } from "../lib/design-library/variants.ts";
import {
  SECTION_COLUMN_SPECS,
  SECTION_CONTAINER_SPECS,
  SECTION_SURFACE_STYLE_SPECS,
  SECTION_TYPES,
  SECTION_TYPE_IDS,
  SECTION_VARIANTS,
  renderSectionCatalog,
  sectionType,
  sectionVariant,
} from "../lib/design-library/section-registry.ts";
import { inferIndustry, extractProductNouns, INDUSTRY_PROFILES, SECTION_BASE_POSITION } from "../lib/design-library/industry.ts";

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

test("본문 섹션 레지스트리는 고정 5종을 넘어 업종별 섹션을 갖추고 각 타입마다 여러 모양을 제공한다", () => {
  // 이전 구조는 category/products/story/cta/social/trust 6종뿐이라 결과가 한 모양으로 수렴했다.
  assert.ok(SECTION_TYPE_IDS.length >= 16, `섹션 타입이 너무 적습니다: ${SECTION_TYPE_IDS.length}`);
  for (const required of ["featuredProducts", "materials", "process", "benefits", "useCases", "productFocus", "gift", "promotion", "specs", "infoGuide"]) {
    assert.ok(SECTION_TYPE_IDS.includes(required as (typeof SECTION_TYPE_IDS)[number]), required);
  }
  for (const id of SECTION_TYPE_IDS) {
    const definition = SECTION_TYPES[id];
    assert.ok(Object.keys(definition.variants).length >= 3, `${id} variant가 부족합니다`);
    assert.ok(definition.purpose.length > 20, `${id} purpose가 필요합니다`);
    assert.ok(SECTION_BASE_POSITION[id] > 0, `${id} 기본 위치가 필요합니다`);
    if (definition.media === "none") assert.equal(definition.axes.mediaPosition, false, `${id}는 미디어 축을 가질 수 없습니다`);
    if (definition.media === "required") assert.equal(definition.axes.mediaPosition, true, `${id}는 미디어 위치 축이 있어야 합니다`);
  }
  assert.equal(SECTION_TYPES.featuredProducts.role, "products");
  assert.equal(SECTION_TYPES.featuredProducts.repeatable, false);
});

test("section variant는 type/variant ref로 조회되고 모르는 ref는 거부한다", () => {
  assert.equal(sectionVariant("brandStory/split-media").id, "split-media");
  assert.equal(sectionVariant("process/numbered-steps").kind, "trust");
  assert.throws(() => sectionVariant("brandStory/does-not-exist"));
  assert.throws(() => sectionVariant("nope/split-media"));
  assert.equal(sectionType("nope"), undefined);
  for (const key of Object.keys(SECTION_VARIANTS)) assert.match(key, /^[a-zA-Z]+\/[a-z0-9-]+$/);
});

test("섹션 카탈로그 텍스트는 모든 타입과 선택 기준을 planner에게 넘긴다", () => {
  const catalog = renderSectionCatalog();
  for (const id of SECTION_TYPE_IDS) {
    assert.ok(catalog.includes(`- ${id} [`), id);
    assert.ok(catalog.includes(SECTION_TYPES[id].purpose.slice(0, 15)), id);
  }
  assert.ok(catalog.includes("role=products"));
});

test("업종 추론은 9개 검증 업종을 서로 다르게 분류하고 더 구체적인 업종을 우선한다", () => {
  assert.equal(inferIndustry("미니멀한 여성 패션 의류 쇼핑몰"), "fashion");
  assert.equal(inferIndustry("저자극 스킨케어 화장품 브랜드"), "beauty");
  assert.equal(inferIndustry("차량용 세차 디테일링 용품 전문몰"), "auto");
  assert.equal(inferIndustry("원목 가구와 조명 인테리어 스토어"), "interior");
  assert.equal(inferIndustry("강아지 사료와 반려동물 용품"), "pet");
  assert.equal(inferIndustry("유아 이유식과 아기 용품"), "kids");
  assert.equal(inferIndustry("프리미엄 한우 정육 식품 브랜드"), "food");
  assert.equal(inferIndustry("감성 오브제를 파는 라이프스타일 편집숍"), "lifestyle");
  assert.equal(inferIndustry("주방 세제와 청소 생활용품"), "household");
  assert.equal(inferIndustry("아무 관련 없는 종합 스토어"), "general");
  // "건강기능식품"이 "식품" 키워드에 삼켜지지 않아야 한다.
  assert.equal(inferIndustry("유산균과 비타민 건강기능식품"), "health");
});

test("업종 프로필은 고정 flow가 아니라 가중치와 후보 풀만 갖는다", () => {
  for (const profile of Object.values(INDUSTRY_PROFILES)) {
    assert.ok(profile.heroPool.length >= 1, profile.id);
    assert.ok(profile.presentationPool.length >= 1, profile.id);
    assert.ok(profile.bodyCount[0] >= 3 && profile.bodyCount[1] >= profile.bodyCount[0], profile.id);
    for (const id of Object.keys(profile.sectionWeights)) {
      assert.ok(SECTION_TYPE_IDS.includes(id as (typeof SECTION_TYPE_IDS)[number]), `${profile.id} → ${id}`);
    }
    // 상품 진열은 항상 코드가 넣으므로 가중치 목록에 있어서는 안 된다.
    assert.equal(profile.sectionWeights.featuredProducts, undefined, profile.id);
  }
  assert.ok(Object.keys(HEADER_STRUCTURES).length === 3);
  assert.ok(Object.keys(PRODUCT_PRESENTATIONS).length === 5);
});

test("브리프에 적힌 실제 상품 명사를 뽑아 이미지 프롬프트 잠금값으로 넘긴다", () => {
  assert.deepEqual(extractProductNouns("프리미엄 한우 선물세트와 육포를 파는 정육 브랜드", "food").sort(), ["한우", "육포"].sort());
  assert.ok(extractProductNouns("차량용 방향제와 카매트", "auto").includes("카매트"));
  assert.deepEqual(extractProductNouns("아주 추상적인 브랜드 이야기"), []);
});

test("hero variant 여섯 종은 구조적으로 배타적인 spec을 갖는다", () => {
  const specs = Object.values(HERO_VARIANTS).map((variant) => variant.spec);
  // 서로 다른 hero가 같은 문장으로 읽히면 planner가 한 종류로 수렴합니다.
  assert.equal(new Set(specs).size, specs.length);
  assert.ok(HERO_VARIANTS["full-bleed"].spec.includes("겹쳐"), "full-bleed는 오버레이 hero입니다");
  assert.ok(HERO_VARIANTS["split-editorial"].spec.includes("겹치지 않고"), "split-editorial은 겹치지 않는 hero입니다");
  assert.ok(HERO_VARIANTS["cinematic-still"].spec.includes("정중앙"), "cinematic-still은 중앙 정렬 hero입니다");
  // 리테일 hero를 평가절하하는 어휘가 남아 있으면 planner가 회피합니다.
  for (const id of ["banner-stack", "product-forward"] as const) {
    assert.ok(HERO_VARIANTS[id].spec.includes("레퍼런스"), `${id}는 레퍼런스 근거를 함께 말해야 합니다`);
  }
});

test("리테일 업종은 카테고리 진입을 Hero 직후로 당긴다", () => {
  for (const id of ["household", "pet", "kids", "auto", "digital", "general"] as const) {
    const shift = INDUSTRY_PROFILES[id].positionShift.categoryGrid;
    assert.ok(shift !== undefined && shift < 0, `${id}는 카테고리를 위로 당겨야 합니다`);
    assert.ok(SECTION_BASE_POSITION.categoryGrid + shift < SECTION_BASE_POSITION.featuredProducts, id);
  }
});

test("중립 톤 일변도를 벗어날 수 있는 고채도·리테일 선택지가 있다", () => {
  assert.ok("saturated-pop" in IMAGE_TREATMENTS);
  assert.ok("bold-retail" in TYPE_SCALES);
  // 리테일 업종은 그 선택지를 실제 후보 풀에 갖고 있어야 합니다.
  for (const id of ["household", "pet", "kids", "general"] as const) {
    const profile = INDUSTRY_PROFILES[id];
    assert.ok(profile.imageTreatmentPool.includes("saturated-pop") || profile.typeScalePool.includes("bold-retail"), id);
  }
});

test("섹션 레지스트리는 타입마다 쓸 수 있는 지면·컬럼·표면을 명시한다", () => {
  for (const typeId of SECTION_TYPE_IDS) {
    const definition = SECTION_TYPES[typeId];
    assert.ok(definition.geometry?.containers?.length, `${typeId}에 지면 후보가 필요합니다`);
    for (const value of definition.geometry.containers) assert.ok(SECTION_CONTAINER_SPECS[value], value);
    for (const value of definition.geometry?.columns ?? []) assert.ok(SECTION_COLUMN_SPECS[value], String(value));
    for (const value of definition.geometry?.surfaces ?? []) assert.ok(SECTION_SURFACE_STYLE_SPECS[value], value);
  }
  // 상품 진열의 컬럼은 productPresentation이 소유하므로 중복 축을 만들지 않습니다.
  assert.equal(SECTION_TYPES.featuredProducts.geometry?.columns, undefined);
  assert.equal(SECTION_TYPES.featuredProducts.geometry?.surfaces, undefined);
});
