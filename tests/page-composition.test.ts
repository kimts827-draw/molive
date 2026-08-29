import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PAGE_PLAN_MAX_SECTIONS,
  PAGE_PLAN_VERSION,
  normalizePagePlan,
  pagePlanJsonSchema,
  pagePlanSchema,
  pagePlanSectionRefs,
  pagePlanSignature,
  renderPagePlanContract,
  renderPagePlanEditContext,
  type PagePlan,
} from "../lib/design-library/page-plan.ts";
import { composeFallbackPagePlan } from "../lib/design-library/plan-composer.ts";
import { SECTION_TYPES } from "../lib/design-library/section-registry.ts";
import { buildDesignGenerationUserPrompt, validateGeneratedDesignContract } from "../lib/openai/design-generation-contract.ts";
import { buildPreviewImagePrompt, buildSectionImagePrompt } from "../lib/openai/preview-image-contract.ts";
import { buildPagePlanUserPrompt, PAGE_PLAN_SYSTEM_PROMPT } from "../lib/openai/page-plan-contract.ts";
import { isProjectSource, projectPagePlan, type ProjectSource } from "../lib/project-source.ts";
import { buildEditorPreviewDocument } from "../lib/editor/preview-document.ts";
import { composeCommerce, resolveLegacyComposition } from "../lib/commerce/fixed-components.ts";
import { deserializeProjectDocument, serializeProjectDocument } from "../lib/project-document.ts";

/** 사용자가 지정한 9개 검증 업종입니다. 실제 AI 호출 없이 구성 엔진만 비교합니다. */
const BRIEFS = [
  { key: "패션", prompt: "미니멀하고 고급스러운 여성 패션 의류 쇼핑몰. 시즌 컬렉션과 룩북 중심.", brandName: "MAISON DEUX" },
  { key: "뷰티", prompt: "저자극 성분을 강조하는 스킨케어 화장품 브랜드. 세럼과 크림이 주력.", brandName: "온결" },
  { key: "자동차용품", prompt: "차량용 세차 디테일링 용품과 카매트를 파는 전문몰. 정밀하고 기술적인 톤.", brandName: "GARAGE9" },
  { key: "인테리어", prompt: "원목 가구와 조명을 파는 인테리어 스토어. 공간 제안 중심.", brandName: "무담" },
  { key: "반려동물", prompt: "강아지 사료와 반려동물 용품을 파는 다정한 리테일 몰.", brandName: "하울리" },
  { key: "유아", prompt: "유아 이유식과 아기 용품을 파는 안심 브랜드. 소재 안전을 강조.", brandName: "포근" },
  { key: "식품", prompt: "프리미엄 한우 정육 식품 브랜드. 선물세트와 산지 서사를 강조.", brandName: "우담" },
  { key: "라이프스타일", prompt: "감성 오브제와 캔들을 파는 라이프스타일 편집숍.", brandName: "SLOW ROOM" },
  { key: "생활용품", prompt: "주방 세제와 청소 생활용품을 저렴하게 파는 실속형 몰.", brandName: "매일살림" },
] as const;

const plans = new Map(BRIEFS.map((brief) => [brief.key, composeFallbackPagePlan(brief)] as const));

function bodySequence(plan: PagePlan) {
  return plan.sections.map((section) => section.type).join(" > ");
}

test("9개 업종 brief는 같은 section sequence를 만들지 않는다", () => {
  const signatures = new Map<string, string>();
  for (const [key, plan] of plans) {
    const signature = pagePlanSignature(plan);
    const owner = signatures.get(signature);
    assert.ok(!owner, `${key}와 ${owner}의 구조가 완전히 같습니다: ${signature}`);
    signatures.set(signature, key);
  }
  assert.equal(signatures.size, BRIEFS.length);
});

test("Hero 이후 본문 구조가 업종마다 실제로 다르다", () => {
  const sequences = new Map<string, string>();
  for (const [key, plan] of plans) {
    const sequence = bodySequence(plan);
    const owner = sequences.get(sequence);
    assert.ok(!owner, `${key}와 ${owner}의 본문 순서가 같습니다: ${sequence}`);
    sequences.set(sequence, key);
  }
  // 옛 blueprint는 전부 category → products → story → cta 한 줄기였다.
  const legacyShape = "categoryGrid > featuredProducts > brandStory > cta";
  for (const sequence of sequences.keys()) assert.notEqual(sequence, legacyShape);
});

test("section 종류와 개수가 프로젝트마다 달라진다", () => {
  const counts = new Set([...plans.values()].map((plan) => plan.sections.length));
  assert.ok(counts.size >= 2, `섹션 개수가 전부 같습니다: ${[...counts]}`);

  const typeUsage = new Map<string, number>();
  for (const plan of plans.values()) {
    for (const section of plan.sections) typeUsage.set(section.type, (typeUsage.get(section.type) ?? 0) + 1);
  }
  // 상품 진열만 9곳 전부에 있고, 나머지는 브랜드에 필요한 곳에만 있어야 한다.
  assert.equal(typeUsage.get("featuredProducts"), BRIEFS.length);
  for (const [type, used] of typeUsage) {
    if (type === "featuredProducts") continue;
    assert.ok(used < BRIEFS.length, `${type}이 9개 전부에 강제로 들어갑니다`);
  }
  assert.ok(typeUsage.size >= 8, `쓰이는 섹션 종류가 너무 적습니다: ${typeUsage.size}`);
});

test("상품 진열 위치가 업종마다 다르게 정해진다", () => {
  const positions = new Set<number>();
  for (const [key, plan] of plans) {
    const index = plan.sections.findIndex((section) => section.type === "featuredProducts");
    assert.ok(index >= 0, `${key}에 상품 진열이 없습니다`);
    assert.equal(plan.sections.filter((section) => section.type === "featuredProducts").length, 1, key);
    positions.add(index);
  }
  assert.ok(positions.size >= 3, `상품 진열이 항상 같은 자리에 옵니다: ${[...positions]}`);
});

test("같은 section도 프로젝트마다 variant와 시각 축이 갈린다", () => {
  const variantsByType = new Map<string, Set<string>>();
  for (const plan of plans.values()) {
    for (const section of plan.sections) {
      const set = variantsByType.get(section.type) ?? new Set<string>();
      set.add(section.variant);
      variantsByType.set(section.type, set);
    }
  }
  const varied = [...variantsByType.entries()].filter(([, set]) => set.size >= 2);
  assert.ok(varied.length >= 2, `모든 섹션이 한 variant로 고정되어 있습니다: ${JSON.stringify([...variantsByType].map(([k, v]) => [k, [...v]]))}`);

  const heroVariants = new Set([...plans.values()].map((plan) => plan.hero.variant));
  const presentations = new Set([...plans.values()].map((plan) => plan.productPresentation));
  assert.ok(heroVariants.size >= 3, `hero가 ${[...heroVariants]}로만 나옵니다`);
  assert.ok(presentations.size >= 3, `상품 진열 형식이 ${[...presentations]}로만 나옵니다`);
});

test("붙어 있는 섹션은 같은 배경 톤으로 뭉치지 않는다", () => {
  for (const [key, plan] of plans) {
    for (let index = 1; index < plan.sections.length; index += 1) {
      const previous = plan.sections[index - 1];
      const current = plan.sections[index];
      if (!SECTION_TYPES[current.type].axes.tone) continue;
      assert.notEqual(current.tone, previous.tone, `${key}의 ${current.type}이 앞 섹션과 같은 톤입니다`);
    }
  }
});

test("같은 시드는 같은 plan을, 시드가 다르면 다른 plan을 만든다", () => {
  const brief = BRIEFS[0];
  assert.equal(pagePlanSignature(composeFallbackPagePlan(brief, 42)), pagePlanSignature(composeFallbackPagePlan(brief, 42)));
  const signatures = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => pagePlanSignature(composeFallbackPagePlan(brief, seed))));
  assert.ok(signatures.size >= 4, `같은 브리프의 시드 변화가 구조를 바꾸지 못합니다: ${signatures.size}`);
});

test("조합된 plan은 스키마와 레지스트리 계약을 모두 통과한다", () => {
  for (const [key, plan] of plans) {
    const parsed = pagePlanSchema.parse(plan);
    assert.equal(parsed.version, PAGE_PLAN_VERSION);
    assert.ok(parsed.sections.length <= PAGE_PLAN_MAX_SECTIONS, key);
    for (const section of parsed.sections) {
      const definition = SECTION_TYPES[section.type];
      assert.ok(definition.variants[section.variant], `${key} → ${section.type}/${section.variant}`);
      if (definition.media === "none") assert.equal(section.mediaPosition, "none", `${key} → ${section.type}`);
      if (definition.media === "required") assert.notEqual(section.mediaPosition, "none", `${key} → ${section.type}`);
      assert.ok(section.intent.length > 0);
    }
    const ids = parsed.sections.map((section) => section.id);
    assert.equal(new Set(ids).size, ids.length, key);
  }
});

test("normalizePagePlan은 상품 슬롯 누락·중복 섹션·모르는 variant를 복구한다", () => {
  const base = plans.get("패션") as PagePlan;
  const broken: PagePlan = {
    ...base,
    sections: [
      { id: "story", type: "brandStory", variant: "not-a-variant", alignment: "left", mediaPosition: "none", density: "regular", tone: "light", intent: "", headline: "이야기" },
      { id: "story", type: "brandStory", variant: "dark-statement", alignment: "left", mediaPosition: "left", density: "regular", tone: "light", intent: "중복", headline: "" },
      { id: "gallery", type: "socialGallery", variant: "sns-grid", alignment: "center", mediaPosition: "none", density: "regular", tone: "light", intent: "소셜", headline: "" },
    ],
  };
  const fixed = normalizePagePlan(broken);
  assert.equal(fixed.sections.filter((section) => section.type === "featuredProducts").length, 1);
  assert.equal(fixed.sections.filter((section) => section.type === "brandStory").length, 1);
  assert.ok(SECTION_TYPES.brandStory.variants[fixed.sections[0].variant], fixed.sections[0].variant);
  // socialGallery는 미디어가 필수라 "none"으로 저장될 수 없다.
  assert.notEqual(fixed.sections.find((section) => section.type === "socialGallery")?.mediaPosition, "none");
  assert.equal(new Set(fixed.sections.map((section) => section.id)).size, fixed.sections.length);

  const overflow = normalizePagePlan({ ...base, sections: Array.from({ length: 30 }, (_, index) => ({ ...base.sections[0], id: `x-${index}`, type: "imageText" as const, variant: "side-by-side" })) });
  assert.ok(overflow.sections.length <= PAGE_PLAN_MAX_SECTIONS);
});

test("plan 계약 텍스트와 architecture ref가 구성 그대로를 전달한다", () => {
  const plan = plans.get("식품") as PagePlan;
  const contract = renderPagePlanContract(plan);
  assert.ok(contract.includes("PAGE COMPOSITION"));
  assert.ok(contract.includes(`hero/${plan.hero.variant}`));
  assert.ok(contract.includes(plan.productCategory));
  for (const section of plan.sections) assert.ok(contract.includes(`[${section.type}/${section.variant}]`), section.type);
  assert.ok(contract.includes('data-cafe24-slot="product-list"'));
  assert.ok(contract.includes(`architecture.header 에 정확히 "${plan.header}"`));

  const refs = pagePlanSectionRefs(plan);
  assert.equal(refs.length, plan.sections.length);
  for (const [index, section] of plan.sections.entries()) assert.ok(refs[index].startsWith(`${section.type}/${section.variant}`));
});

test("디자인 생성 프롬프트는 plan과 판매 상품군을 함께 싣는다", () => {
  const plan = plans.get("자동차용품") as PagePlan;
  const prompt = buildDesignGenerationUserPrompt({ prompt: BRIEFS[2].prompt, brandName: BRIEFS[2].brandName }, plan);
  assert.ok(prompt.includes("PAGE COMPOSITION"));
  assert.ok(prompt.includes(`This shop sells: ${plan.productCategory}`));
  const without = buildDesignGenerationUserPrompt({ prompt: BRIEFS[2].prompt });
  assert.ok(!without.includes("PAGE COMPOSITION"));
  assert.ok(without.includes("heroComposition (full-bleed | split-editorial | banner-stack | typographic-marquee | cinematic-still | product-forward)"));
});

test("생성 결과는 plan의 섹션 순서를 architecture에 기록해야 통과한다", () => {
  const plan = plans.get("반려동물") as PagePlan;
  const bodyMarkup = plan.sections.map((section, index) => `<section data-moire-id="s${index}" data-moire-type="section">${section.type === "featuredProducts" ? '<div data-cafe24-slot="product-list"></div>' : `<p data-moire-id="p${index}" data-moire-type="text">${section.type}</p>`}</section>`).join("");
  const html = `<div data-moire-root="plan-test"><main><section data-moire-id="hero" data-moire-type="hero"><h1 data-moire-id="t" data-moire-type="text">B</h1></section>${bodyMarkup}</main></div>`;
  const css = `[data-moire-root="plan-test"]{color:#111}\n@media(max-width:767px){[data-moire-root="plan-test"] section{padding:40px 20px}}`;
  const architecture = {
    hero: plan.hero.variant,
    header: plan.header,
    productPresentation: plan.productPresentation,
    sections: pagePlanSectionRefs(plan),
  };

  assert.deepEqual(validateGeneratedDesignContract({ html, css, architecture }, plan).filter((item) => item.code.startsWith("PLAN_")), []);

  // 모델이 hero를 목록 맨 앞에 함께 적어도 통과해야 한다(완성된 draft를 재생성으로 버리지 않기 위해).
  const withHero = { ...architecture, sections: [`hero/${plan.hero.variant} — 도입부`, ...architecture.sections] };
  assert.deepEqual(validateGeneratedDesignContract({ html, css, architecture: withHero }, plan).filter((item) => item.code.startsWith("PLAN_")), []);

  const shuffled = { ...architecture, sections: [...architecture.sections].reverse() };
  const reorderCodes = validateGeneratedDesignContract({ html, css, architecture: shuffled }, plan).map((item) => item.code);
  assert.ok(reorderCodes.includes("PLAN_SECTION_ORDER"));

  const mismatchCodes = validateGeneratedDesignContract({ html, css, architecture: { ...architecture, hero: "full-bleed", header: "split-utility", productPresentation: "grid-four", sections: [] } }, {
    ...plan,
    hero: { ...plan.hero, variant: plan.hero.variant === "full-bleed" ? "cinematic-still" : "full-bleed" },
    header: plan.header === "split-utility" ? "centered-brand" : "split-utility",
    productPresentation: plan.productPresentation === "grid-four" ? "compact-five" : "grid-four",
  }).map((item) => item.code);
  for (const code of ["PLAN_HERO_MISMATCH", "PLAN_HEADER_MISMATCH", "PLAN_PRODUCT_MISMATCH", "PLAN_SECTIONS_MISSING"]) {
    assert.ok(mismatchCodes.includes(code), code);
  }

  // 계획한 섹션 수만큼 실제 마크업이 없으면 구성 미달로 걸러진다.
  const shallowHtml = `<div data-moire-root="plan-test"><main><section data-moire-id="hero" data-moire-type="hero"><h1 data-moire-id="t" data-moire-type="text">B</h1></section><section data-moire-id="p" data-moire-type="products"><div data-cafe24-slot="product-list"></div></section></main></div>`;
  const shallowCodes = validateGeneratedDesignContract({ html: shallowHtml, css, architecture }, plan).map((item) => item.code);
  assert.ok(shallowCodes.includes("PLAN_SECTION_COUNT"), shallowCodes.join(","));
});

test("이미지 프롬프트가 내부 업종 키 대신 실제 상품군을 붙잡는다", () => {
  const plan = plans.get("식품") as PagePlan;
  const brief = { industry: plan.industryLabel, brief: BRIEFS[6].prompt, brandName: BRIEFS[6].brandName, productCategory: "한우 정육", productExamples: ["한우 등심 선물세트", "한우 채끝"] };
  const product = buildPreviewImagePrompt("한우 등심 선물세트", brief);
  assert.ok(product.includes("Product category of this store: 한우 정육."));
  assert.ok(product.includes("한우 등심 선물세트"));
  assert.ok(product.includes("do not default to desserts, bakery, coffee or flowers"));
  assert.ok(!product.includes("food-dessert"));

  const section = buildSectionImagePrompt("산지 풍경", brief);
  assert.ok(section.includes("Product category of this store: 한우 정육."));
  assert.ok(section.includes("Scene: 산지 풍경."));

  // 상품군이 없으면 잠금 문장 없이 기존 형태를 유지한다.
  const loose = buildPreviewImagePrompt("샘플 상품", { industry: "종합", brief: "테스트" });
  assert.ok(!loose.includes("Product category of this store"));
});

test("page planner 프롬프트는 구성 결정과 상품군 보존을 모두 지시한다", () => {
  for (const rule of [
    "Your only job in this step is the PAGE COMPOSITION",
    "Exactly one section must be type \"featuredProducts\"",
    "Do not reproduce a generic hero → category → products → story → CTA order",
    "different section sets, different counts, and different orders",
    "never substitute a neighbouring category",
  ]) assert.ok(PAGE_PLAN_SYSTEM_PROMPT.includes(rule), rule);

  const prompt = buildPagePlanUserPrompt({ prompt: BRIEFS[6].prompt, brandName: BRIEFS[6].brandName });
  assert.ok(prompt.includes("SECTION REGISTRY"));
  assert.ok(prompt.includes("HERO VARIANTS"));
  assert.ok(prompt.includes("- featuredProducts ["));
  assert.ok(prompt.includes(BRIEFS[6].prompt));
  assert.ok(prompt.includes("Treat it as a hint only"));
});

test("plan JSON schema는 strict structured output 형태를 지킨다", () => {
  const schema = pagePlanJsonSchema as unknown as { required: string[]; properties: Record<string, { type: string }>; additionalProperties: boolean };
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort());
  const sections = (pagePlanJsonSchema as unknown as { properties: { sections: { items: { required: string[]; properties: Record<string, unknown>; additionalProperties: boolean } } } }).properties.sections.items;
  assert.equal(sections.additionalProperties, false);
  assert.deepEqual([...sections.required].sort(), Object.keys(sections.properties).sort());
});

test("pagePlan을 담은 ProjectSource는 저장·복구되고 기존 프로젝트는 plan 없이도 유효하다", () => {
  const plan = plans.get("인테리어") as PagePlan;
  const withPlan: ProjectSource = {
    id: "plan-project",
    name: "Plan project",
    html: '<div data-moire-root="p"><main><section data-cafe24-slot="product-list"></section></main></div>',
    css: '[data-moire-root="p"]{display:block}',
    architecture: { header: plan.header, hero: plan.hero.variant, sections: pagePlanSectionRefs(plan), productPresentation: plan.productPresentation, typography: "sans", footer: "light" },
    pagePlan: plan,
    updatedAt: new Date(0).toISOString(),
  };
  assert.ok(isProjectSource(withPlan));
  const restored = JSON.parse(JSON.stringify(withPlan)) as ProjectSource;
  assert.ok(isProjectSource(restored));
  assert.equal(pagePlanSignature(projectPagePlan(restored) as PagePlan), pagePlanSignature(plan));

  const legacy: ProjectSource = { ...withPlan, pagePlan: undefined, architecture: { ...withPlan.architecture, sections: ["예전 자유 텍스트 섹션"] } };
  assert.ok(isProjectSource(legacy));
  assert.equal(projectPagePlan(legacy), null);
  // 형식이 깨진 plan이 들어 있어도 프로젝트 자체는 열리고, plan만 무시된다.
  const damaged = { ...withPlan, pagePlan: { version: 99 } } as unknown as ProjectSource;
  assert.ok(isProjectSource(damaged));
  assert.equal(projectPagePlan(damaged), null);
});

test("Preview와 Cafe24 조합은 plan이 만든 어떤 섹션 개수에도 그대로 동작한다", () => {
  for (const [key, plan] of plans) {
    const body = plan.sections.map((section, index) => section.type === "featuredProducts"
      ? `<section data-moire-id="s${index}" data-moire-type="products"><div data-cafe24-slot="product-list"></div></section>`
      : `<section data-moire-id="s${index}" data-moire-type="section"><p data-moire-id="p${index}" data-moire-type="text">${section.type}</p></section>`).join("");
    const source: ProjectSource = {
      id: `compose-${plan.industry}`,
      name: key,
      html: `<div data-moire-root="c-${plan.industry}"><main><section data-moire-id="hero" data-moire-type="hero"><h1 data-moire-id="h" data-moire-type="text">${key}</h1></section>${body}</main></div>`,
      css: `[data-moire-root="c-${plan.industry}"]{display:block}`,
      architecture: { header: plan.header, hero: plan.hero.variant, sections: pagePlanSectionRefs(plan), productPresentation: plan.productPresentation, typography: "sans", footer: plan.footerMood },
      pagePlan: plan,
      updatedAt: new Date(0).toISOString(),
    };

    // 고정 컴포넌트 조합: 상품 슬롯 하나에 verified ProductSectionV1이 정확히 한 번 들어간다.
    const composition = resolveLegacyComposition(source.architecture);
    assert.equal(composition.headerVariant, plan.header, key);
    assert.equal(composition.productLayout, plan.productPresentation, key);
    const composed = composeCommerce(source.html, "cafe24", source.commerce, composition, { includeHeader: false });
    assert.equal(composed.slots, 1, key);
    assert.equal([...composed.html.matchAll(/moireProductSection/g)].length, 1, key);

    // Preview는 legacy 경로를 그대로 타고 오류 문서로 떨어지지 않는다.
    const preview = buildEditorPreviewDocument(source);
    assert.equal(preview.kind, "legacy", key);
    assert.ok(!preview.srcDoc.includes("고정 커머스 컴포넌트를 넣지 못했습니다"), key);
    assert.ok(preview.srcDoc.includes("pocHeader"), key);

    // 저장 → 복구 왕복에서 plan이 그대로 살아남는다.
    const restored = deserializeProjectDocument(serializeProjectDocument(source)) as ProjectSource;
    assert.equal(pagePlanSignature(projectPagePlan(restored) as PagePlan), pagePlanSignature(plan), key);
  }
});

test("AI 부분 수정 컨텍스트는 구성과 상품군을 짧게 전달한다", () => {
  const plan = plans.get("식품") as PagePlan;
  const context = renderPagePlanEditContext(plan);
  assert.ok(context.startsWith("PROJECT PAGE COMPOSITION (context only)"));
  assert.ok(context.includes(plan.productCategory));
  assert.ok(context.includes(`hero/${plan.hero.variant}[`));
  for (const section of plan.sections) assert.ok(context.includes(`${section.type}/${section.variant}[`), section.type);
  assert.ok(context.includes("선택 영역 밖의 섹션을 추가·삭제·재배치하지 말고"));
  // 전체 시공 계약보다 훨씬 짧아야 부분 수정 비용이 늘지 않는다.
  assert.ok(context.length < renderPagePlanContract(plan).length / 2, `${context.length} vs ${renderPagePlanContract(plan).length}`);
});

test("editProjectNode는 plan이 있을 때만 구성 컨텍스트를 싣고 legacy는 기존 프롬프트를 유지한다", async () => {
  const source = await readFile(new URL("../lib/openai/site-generator.ts", import.meta.url), "utf8");
  assert.ok(source.includes("pagePlan?: PagePlan;"), "editProjectNode 입력에 pagePlan이 없습니다");
  assert.ok(source.includes('const planContext = input.pagePlan ? renderPagePlanEditContext(input.pagePlan) : "";'));
  // plan이 없으면 planContext가 빈 문자열이므로 userPrompt와 systemPrompt가 예전과 완전히 같아진다.
  // (system prompt 1곳 + userPrompt의 새 섹션/재디자인/기존 편집 세 분기 모두 조건부인지 확인한다.)
  assert.equal([...source.matchAll(/\$\{planContext \? /g)].length, 4);
  assert.ok(source.includes('}Project architecture (context only)'));
  assert.ok(source.includes("The user message carries this project's page composition"));

  const route = await readFile(new URL("../app/api/ai/edit/route.ts", import.meta.url), "utf8");
  assert.ok(route.includes("pagePlan: z.unknown().optional()"));
  assert.ok(route.includes("pagePlan: projectPagePlan(parsedInput.data) ?? undefined"));

  const shell = await readFile(new URL("../components/editor/editor-shell.tsx", import.meta.url), "utf8");
  assert.ok(shell.includes("pagePlan: baseSource.pagePlan"));
});
