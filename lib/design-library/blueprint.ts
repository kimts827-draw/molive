/**
 * 디자인 blueprint 조합기입니다.
 * 업종을 추론하고, variants.ts의 레퍼런스 기반 variant를 업종 프로필에 따라 조합해
 * AI 생성기의 구조 계약(blueprint)을 만듭니다. AI는 자유 구조를 발명하는 대신
 * 이 blueprint를 시공하고, architecture에 그 선택을 그대로 기록해야 합니다.
 */

import {
  DENSITY_SCALES,
  FOOTER_MOODS,
  HEADER_STRUCTURES,
  HERO_VARIANTS,
  IMAGE_TREATMENTS,
  PRODUCT_PRESENTATIONS,
  sectionVariant,
  TYPE_SCALES,
  type DensityId,
  type DesignVariant,
  type FooterMoodId,
  type HeaderStructureId,
  type HeroVariantId,
  type ImageTreatmentId,
  type ProductPresentationId,
  type TypeScaleId,
} from "./variants.ts";

export type IndustryId = "fashion" | "food-dessert" | "beauty" | "auto-tech" | "living" | "kids" | "pet" | "general";

type BlueprintFlow = {
  id: string;
  mood: string;
  header: HeaderStructureId;
  hero: HeroVariantId;
  /** hero를 제외한 섹션 순서. products/* 항목이 정확히 하나 있어야 하며 그 자리가 verified 상품 슬롯이다. */
  sections: string[];
  productPresentation: ProductPresentationId;
  footer: FooterMoodId;
  density: DensityId;
  typeScale: TypeScaleId;
  imageTreatment: ImageTreatmentId;
};

type IndustryProfile = {
  id: IndustryId;
  name: string;
  keywords: string[];
  flows: BlueprintFlow[];
};

const INDUSTRY_PROFILES: IndustryProfile[] = [
  {
    id: "fashion",
    name: "패션/의류",
    keywords: ["패션", "의류", "옷", "어패럴", "스트릿", "레디투웨어", "컬렉션", "룩북", "fashion", "apparel", "wear", "outer", "denim", "주얼리", "잡화", "가방", "슈즈"],
    flows: [
      {
        id: "fashion-editorial",
        header: "centered-brand",
        productPresentation: "editorial-two",
        mood: "editorial — 잡지 지면처럼 절제된 에디토리얼",
        hero: "split-editorial",
        sections: ["category/editorial-index", "products/heading-more", "story/lookbook-row", "cta/statement-text", "social/sns-gallery"],
        footer: "ink-dark",
        density: "airy",
        typeScale: "serif-display",
        imageTreatment: "desaturated-editorial",
      },
      {
        id: "fashion-visual-first",
        header: "overlay-minimal",
        productPresentation: "large-grid",
        mood: "visual-first — 타이포와 이미지가 먼저 말하는 브랜드 무드",
        hero: "typographic-marquee",
        sections: ["story/lookbook-row", "products/curation-band", "category/collection-tiles", "cta/full-campaign"],
        footer: "ink-dark",
        density: "airy",
        typeScale: "serif-display",
        imageTreatment: "desaturated-editorial",
      },
      {
        id: "fashion-airy",
        header: "centered-brand",
        productPresentation: "large-grid",
        mood: "airy — 밝은 여백과 키비주얼 중심의 시즌 에디트",
        hero: "full-bleed",
        sections: ["category/collection-tiles", "products/heading-more", "story/split-media", "cta/marquee-strip", "social/ugc-strip"],
        footer: "paper-light",
        density: "regular",
        typeScale: "serif-display",
        imageTreatment: "vivid-clean",
      },
    ],
  },
  {
    id: "food-dessert",
    name: "식품/디저트",
    keywords: ["디저트", "베이커리", "케이크", "쿠키", "초콜릿", "커피", "식품", "간식", "수제", "젤라또", "마카롱", "티", "dessert", "bakery", "sweet", "food", "건강식품", "영양제"],
    flows: [
      {
        id: "dessert-warm-gift",
        header: "centered-brand",
        productPresentation: "featured-grid",
        mood: "warm & gift-oriented — 온기 있는 선물 제안",
        hero: "full-bleed",
        sections: ["category/collection-tiles", "products/best-frame", "story/split-media", "cta/promo-duo", "social/sns-gallery"],
        footer: "warm-tinted",
        density: "regular",
        typeScale: "rounded-warm",
        imageTreatment: "warm-film",
      },
      {
        id: "dessert-storytelling",
        header: "split-utility",
        productPresentation: "featured-grid",
        mood: "storytelling — 재료와 공정이 먼저 오는 서사",
        hero: "banner-stack",
        sections: ["story/split-media", "products/curation-band", "trust/info-columns", "cta/statement-text"],
        footer: "warm-tinted",
        density: "regular",
        typeScale: "rounded-warm",
        imageTreatment: "warm-film",
      },
      {
        id: "dessert-appetite",
        header: "overlay-minimal",
        productPresentation: "featured-grid",
        mood: "appetite-first — 클로즈업 한 컷으로 식욕을 여는 구성",
        hero: "cinematic-still",
        sections: ["products/heading-more", "category/quick-menu", "story/dark-statement", "cta/full-campaign"],
        footer: "ink-dark",
        density: "regular",
        typeScale: "serif-display",
        imageTreatment: "warm-film",
      },
    ],
  },
  {
    id: "auto-tech",
    name: "자동차/테크",
    keywords: ["자동차", "차량", "카", "모터", "튜닝", "액세서리", "가전", "디지털", "테크", "전자", "기기", "장비", "공구", "auto", "car", "motor", "tech", "gear", "device"],
    flows: [
      {
        id: "auto-technical",
        header: "split-utility",
        productPresentation: "compact-five",
        mood: "technical — 어둡고 정밀한 스펙 중심 구성",
        hero: "cinematic-still",
        sections: ["trust/spec-band", "products/heading-more", "category/quick-menu", "story/dark-statement", "cta/full-campaign"],
        footer: "ink-dark",
        density: "dense",
        typeScale: "sans-modern",
        imageTreatment: "dark-cinematic",
      },
      {
        id: "auto-trust",
        header: "split-utility",
        productPresentation: "compact-five",
        mood: "trust-driven — 탐색과 정보가 촘촘한 리테일 구성",
        hero: "product-forward",
        sections: ["category/quick-menu", "products/best-frame", "trust/info-columns", "story/split-media", "cta/promo-duo"],
        footer: "paper-light",
        density: "dense",
        typeScale: "sans-modern",
        imageTreatment: "vivid-clean",
      },
    ],
  },
  {
    id: "beauty",
    name: "뷰티/화장품",
    keywords: ["뷰티", "화장품", "스킨케어", "코스메틱", "세럼", "크림", "메이크업", "beauty", "cosmetic", "skincare"],
    flows: [
      {
        id: "beauty-clean",
        header: "centered-brand",
        productPresentation: "grid-four",
        mood: "clean — 밝고 정돈된 성분/효능 중심",
        hero: "full-bleed",
        sections: ["products/curation-band", "story/split-media", "trust/info-columns", "cta/full-campaign", "social/sns-gallery"],
        footer: "paper-light",
        density: "regular",
        typeScale: "sans-modern",
        imageTreatment: "vivid-clean",
      },
      {
        id: "beauty-ritual",
        header: "overlay-minimal",
        productPresentation: "editorial-two",
        mood: "ritual — 어두운 무드의 프리미엄 리추얼",
        hero: "cinematic-still",
        sections: ["story/dark-statement", "products/heading-more", "category/collection-tiles", "cta/statement-text"],
        footer: "ink-dark",
        density: "airy",
        typeScale: "serif-display",
        imageTreatment: "dark-cinematic",
      },
    ],
  },
  {
    id: "living",
    name: "리빙/생활",
    keywords: ["리빙", "생활", "주방", "홈", "인테리어", "가구", "오브제", "문구", "캠핑", "아웃도어", "living", "home", "object"],
    flows: [
      {
        id: "living-collected",
        header: "split-utility",
        productPresentation: "grid-four",
        mood: "collected — 편집된 보드형 도입과 컬렉션 탐색",
        hero: "banner-stack",
        sections: ["category/collection-tiles", "products/heading-more", "story/split-media", "cta/statement-text"],
        footer: "paper-light",
        density: "regular",
        typeScale: "sans-modern",
        imageTreatment: "vivid-clean",
      },
      {
        id: "living-editorial",
        header: "centered-brand",
        productPresentation: "editorial-two",
        mood: "object-editorial — 오브제를 잡지처럼 다루는 구성",
        hero: "split-editorial",
        sections: ["story/lookbook-row", "products/curation-band", "trust/info-columns", "cta/full-campaign"],
        footer: "ink-dark",
        density: "airy",
        typeScale: "serif-display",
        imageTreatment: "desaturated-editorial",
      },
    ],
  },
  {
    id: "kids",
    name: "유아동",
    keywords: ["유아", "아동", "키즈", "아기", "장난감", "토이", "어린이", "kids", "baby", "toy"],
    flows: [
      {
        id: "kids-bright",
        header: "centered-brand",
        productPresentation: "featured-grid",
        mood: "bright — 밝고 다정한 탐색 우선 구성",
        hero: "full-bleed",
        sections: ["category/quick-menu", "products/heading-more", "story/split-media", "cta/promo-duo", "social/sns-gallery"],
        footer: "warm-tinted",
        density: "regular",
        typeScale: "rounded-warm",
        imageTreatment: "vivid-clean",
      },
    ],
  },
  {
    id: "pet",
    name: "반려동물",
    keywords: ["반려", "펫", "강아지", "고양이", "댕댕", "냥", "pet", "dog", "cat"],
    flows: [
      {
        id: "pet-retail",
        header: "split-utility",
        productPresentation: "compact-five",
        mood: "friendly retail — 퀵 탐색과 상품이 앞서는 구성",
        hero: "product-forward",
        sections: ["category/quick-menu", "products/best-frame", "cta/promo-duo", "story/split-media", "social/sns-gallery"],
        footer: "paper-light",
        density: "dense",
        typeScale: "rounded-warm",
        imageTreatment: "vivid-clean",
      },
    ],
  },
  {
    id: "general",
    name: "종합",
    keywords: [],
    flows: [
      {
        id: "general-keyvisual",
        header: "split-utility",
        productPresentation: "grid-four",
        mood: "keyvisual — 보편적인 키비주얼 리테일",
        hero: "full-bleed",
        sections: ["category/collection-tiles", "products/heading-more", "story/split-media", "cta/full-campaign"],
        footer: "paper-light",
        density: "regular",
        typeScale: "sans-modern",
        imageTreatment: "vivid-clean",
      },
      {
        id: "general-editorial",
        header: "centered-brand",
        productPresentation: "editorial-two",
        mood: "editorial — 절제된 에디토리얼",
        hero: "split-editorial",
        sections: ["category/editorial-index", "products/heading-more", "story/dark-statement", "cta/statement-text"],
        footer: "ink-dark",
        density: "airy",
        typeScale: "serif-display",
        imageTreatment: "desaturated-editorial",
      },
      {
        id: "general-board",
        header: "split-utility",
        productPresentation: "compact-five",
        mood: "board — 편집 보드형 도입",
        hero: "banner-stack",
        sections: ["category/quick-menu", "products/heading-more", "cta/promo-duo", "social/sns-gallery"],
        footer: "paper-light",
        density: "regular",
        typeScale: "sans-modern",
        imageTreatment: "vivid-clean",
      },
    ],
  },
];

export type DesignBlueprint = {
  industry: IndustryId;
  industryName: string;
  flowId: string;
  mood: string;
  header: (typeof HEADER_STRUCTURES)[HeaderStructureId];
  hero: DesignVariant & { id: HeroVariantId };
  productPresentation: (typeof PRODUCT_PRESENTATIONS)[ProductPresentationId];
  /** hero 제외, 순서대로. ref는 "kind/variant" 형태. */
  sections: Array<{ ref: string; variant: DesignVariant }>;
  footerMood: FooterMoodId;
  density: DensityId;
  typeScale: TypeScaleId;
  imageTreatment: ImageTreatmentId;
  seed: number;
};

export function inferIndustry(text: string): IndustryId {
  const haystack = text.toLowerCase();
  let best: { id: IndustryId; hits: number } = { id: "general", hits: 0 };
  for (const profile of INDUSTRY_PROFILES) {
    if (profile.id === "general") continue;
    const hits = profile.keywords.reduce((count, keyword) => count + (haystack.includes(keyword.toLowerCase()) ? 1 : 0), 0);
    if (hits > best.hits) best = { id: profile.id, hits };
  }
  return best.hits > 0 ? best.id : "general";
}

/** 시드 고정 시 같은 blueprint가 나오는 결정적 RNG(mulberry32)입니다. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function composeDesignBlueprint(input: { prompt: string; brandName?: string }, seed?: number): DesignBlueprint {
  const resolvedSeed = seed ?? Math.floor(Math.random() * 0xffffffff);
  const random = mulberry32(resolvedSeed);
  const industry = inferIndustry(`${input.brandName ?? ""} ${input.prompt}`);
  const profile = INDUSTRY_PROFILES.find((candidate) => candidate.id === industry) ?? INDUSTRY_PROFILES[INDUSTRY_PROFILES.length - 1];
  const flow = profile.flows[Math.floor(random() * profile.flows.length)] ?? profile.flows[0];
  const products = flow.sections.filter((ref) => ref.startsWith("products/"));
  if (products.length !== 1) throw new Error(`flow ${flow.id}의 products 섹션은 정확히 하나여야 합니다.`);
  return {
    industry: profile.id,
    industryName: profile.name,
    flowId: flow.id,
    mood: flow.mood,
    header: HEADER_STRUCTURES[flow.header],
    hero: HERO_VARIANTS[flow.hero],
    productPresentation: PRODUCT_PRESENTATIONS[flow.productPresentation],
    sections: flow.sections.map((ref) => ({ ref, variant: sectionVariant(ref) })),
    footerMood: flow.footer,
    density: flow.density,
    typeScale: flow.typeScale,
    imageTreatment: flow.imageTreatment,
    seed: resolvedSeed,
  };
}

/** blueprint를 AI user prompt에 넣을 구조 계약 텍스트로 렌더링합니다. */
export function renderBlueprintContract(blueprint: DesignBlueprint) {
  const sectionLines = blueprint.sections.map((section, index) => {
    const slot = section.ref.startsWith("products/")
      ? " ← 이 자리에 비어 있는 data-cafe24-slot=\"product-list\" wrapper를 두고, 명시된 프레임(헤딩/카피)만 주변에 작성한다."
      : "";
    return `${index + 2}. [${section.ref}] ${section.variant.name}: ${section.variant.spec}${slot}`;
  });
  return `DESIGN BLUEPRINT (reference-derived, binding)
업종: ${blueprint.industryName} · 무드: ${blueprint.mood} · flow: ${blueprint.flowId}

이 blueprint는 Cafe24 실제 레퍼런스 패턴에서 조합되었다. 아래 구조를 그대로 시공하되, 카피·색·이미지 선택으로 브랜드를 표현한다. 섹션 순서를 바꾸거나 섹션을 빼고 더하지 않는다.

고정 컴포넌트 배치(코드가 렌더링, AI는 주변만 설계):
- Header = ${blueprint.header.id} (${blueprint.header.name}): ${blueprint.header.spec} Header HTML/CSS는 절대 작성하지 않는다.
- Product presentation = ${blueprint.productPresentation.id} (${blueprint.productPresentation.name}, ${blueprint.productPresentation.columns}): ${blueprint.productPresentation.spec} 카드 CSS는 코드가 소유하므로 상품 섹션의 헤딩·카피·배경·여백만 이 진열 스케일에 어울리게 설계한다.

1. [hero/${blueprint.hero.id}] ${blueprint.hero.name}: ${blueprint.hero.spec}
${sectionLines.join("\n")}

디자인 축:
- 콘텐츠 밀도(${blueprint.density}): ${DENSITY_SCALES[blueprint.density]}
- 타이포 스케일(${blueprint.typeScale}): ${TYPE_SCALES[blueprint.typeScale]}
- 이미지 처리(${blueprint.imageTreatment}): ${IMAGE_TREATMENTS[blueprint.imageTreatment]}
- 푸터 무드(${blueprint.footerMood}): ${FOOTER_MOODS[blueprint.footerMood].spec}

architecture 기록 계약:
- architecture.header 에 정확히 "${blueprint.header.id}" 를 기록한다.
- architecture.productPresentation 에 정확히 "${blueprint.productPresentation.id}" 를 기록한다.
- architecture.hero 에 정확히 "${blueprint.hero.id}" 를 기록한다.
- architecture.sections 는 위 섹션 계획을 순서대로 기록하되, 각 항목 앞에 variant ref를 남긴다. 예: "story/split-media — 산지 서사".
- 섹션 배경은 서로 붙는 섹션끼리 최소 두 가지 이상의 배경 톤이 교차하도록 설계해 페이지 리듬을 만든다.`;
}
