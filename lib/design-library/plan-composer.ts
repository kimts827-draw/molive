/**
 * Page Plan 결정적 조합기입니다.
 *
 * AI planner가 응답하지 못했을 때(키 없음, 타임아웃, 스키마 실패) 쓰는 대비 경로이며,
 * 고정 템플릿으로 물러나지 않습니다. 업종 가중치 + 섹션 기본 위치 + 시드 난수로
 * 매번 다른 구성을 조합하므로, 대비 경로에서도 브리프가 다르면 구조가 달라집니다.
 *
 * 테스트는 이 조합기를 실제 AI 호출 없이 구조 다양성을 검증하는 데 씁니다.
 */

import {
  extractProductNouns,
  inferIndustry,
  industryProfile,
  SECTION_BASE_POSITION,
  type IndustryId,
} from "./industry.ts";
import {
  normalizePagePlan,
  PAGE_PLAN_VERSION,
  type PagePlan,
  type PagePlanSection,
} from "./page-plan.ts";
import {
  SECTION_TYPES,
  type SectionAlignment,
  type SectionDensity,
  type SectionMediaPosition,
  type SectionTone,
  type SectionTypeId,
} from "./section-registry.ts";
import { briefSeed as seedFromBrief, mulberry32, resolvePlanTypography } from "./plan-typography.ts";
import type { DensityId } from "./variants.ts";
import { COLOR_STRATEGIES, parseHex, toHex, type BrandPalette, type ColorStrategy, type SurfaceFamily } from "../commerce/brand-theme.ts";

/** RNG와 시드는 폰트 확정과 같은 것을 써야 같은 브리프가 같은 plan을 얻습니다. */
export { briefSeed } from "./plan-typography.ts";

function choose<T>(values: readonly T[], random: () => number): T {
  return values[Math.min(values.length - 1, Math.floor(random() * values.length))];
}

function weightedSample(weights: Partial<Record<SectionTypeId, number>>, count: number, random: () => number): SectionTypeId[] {
  const pool = (Object.keys(weights) as SectionTypeId[])
    .filter((id) => id !== "featuredProducts" && (weights[id] ?? 0) > 0)
    .map((id) => ({ id, weight: weights[id] ?? 0 }));
  const picked: SectionTypeId[] = [];
  while (picked.length < count && pool.length) {
    const total = pool.reduce((sum, item) => sum + item.weight, 0);
    let cursor = random() * total;
    let index = pool.length - 1;
    for (let position = 0; position < pool.length; position += 1) {
      cursor -= pool[position].weight;
      if (cursor <= 0) { index = position; break; }
    }
    picked.push(pool[index].id);
    pool.splice(index, 1);
  }
  return picked;
}

const TONE_CYCLES: SectionTone[][] = [
  ["light", "tinted", "light", "dark", "light", "tinted", "light", "accent", "light"],
  ["light", "dark", "light", "tinted", "accent", "light", "tinted", "light", "dark"],
  ["tinted", "light", "dark", "light", "tinted", "light", "accent", "tinted", "light"],
];

const DENSITY_ORDER: SectionDensity[] = ["airy", "regular", "dense"];

function shiftDensity(base: DensityId, delta: number): SectionDensity {
  const index = DENSITY_ORDER.indexOf(base as SectionDensity);
  return DENSITY_ORDER[Math.min(DENSITY_ORDER.length - 1, Math.max(0, index + delta))];
}

/** 대비 경로가 쓰는 한국어 헤딩 초안입니다. 2단계 생성이 실제 카피로 다시 씁니다. */
const HEADLINE_DRAFTS: Record<SectionTypeId, string> = {
  categoryGrid: "무엇을 찾으시나요",
  collection: "컬렉션",
  featuredProducts: "지금의 추천",
  productFocus: "대표 상품",
  brandStory: "브랜드 이야기",
  imageText: "우리가 지키는 것",
  editorialBanner: "이번 시즌",
  lookbook: "룩북",
  materials: "무엇으로 만드는가",
  process: "만드는 과정",
  benefits: "약속드립니다",
  specs: "사양",
  useCases: "이럴 때 쓰세요",
  gift: "선물하기",
  promotion: "기획전",
  socialGallery: "브랜드의 순간들",
  infoGuide: "이용 안내",
  cta: "지금 둘러보기",
};

function mediaPositionFor(typeId: SectionTypeId, order: number, random: () => number): SectionMediaPosition {
  const definition = SECTION_TYPES[typeId];
  if (definition.media === "none" || !definition.axes.mediaPosition) return "none";
  if (typeId === "lookbook" || typeId === "socialGallery" || typeId === "collection" || typeId === "promotion") return "grid";
  if (typeId === "editorialBanner") return random() < 0.5 ? "background" : "right";
  if (definition.media === "optional" && random() < 0.3) return "none";
  return order % 2 === 0 ? "left" : "right";
}

function alignmentFor(typeId: SectionTypeId, random: () => number): SectionAlignment {
  const definition = SECTION_TYPES[typeId];
  if (!definition.axes.alignment) return "left";
  const roll = random();
  if (roll < 0.55) return "left";
  if (roll < 0.9) return "center";
  return "right";
}

export type PlanCompositionInput = { prompt: string; brandName?: string; colors?: string[] };

/**
 * 대비 경로의 색 전략입니다. 사용자가 hex를 넣었을 때만 palette가 생기며,
 * 전략은 시드로 고르되 monochrome은 제외해 색이 사라지지 않게 합니다.
 * (사용자가 명시적으로 무채색을 요구한 경우는 normalizePagePlan이 따로 통과시킵니다.)
 */
const FALLBACK_STRATEGIES = COLOR_STRATEGIES.filter((strategy) => strategy !== "monochrome") as ColorStrategy[];

function composePalette(colors: string[] | undefined, random: () => number): BrandPalette | undefined {
  const rgb = (colors ?? []).map(parseHex).find((value) => value !== null);
  if (!rgb) return undefined;
  const colorStrategy = choose(FALLBACK_STRATEGIES, random);
  const surfaceFamily = choose((colorStrategy === "dominant" ? ["tinted", "dark"] : ["white", "warm", "cool", "tinted"]) as SurfaceFamily[], random);
  return { brandColor: toHex(rgb), colorStrategy, surfaceFamily };
}

/**
 * 업종 가중치와 시드로 Page Plan을 조합합니다.
 * 같은 시드는 같은 plan을, 다른 브리프는 다른 구조를 냅니다.
 */
export function composeFallbackPagePlan(input: PlanCompositionInput, seed?: number): PagePlan {
  const brief = `${input.brandName ?? ""} ${input.prompt}`.trim();
  const resolvedSeed = seed ?? seedFromBrief(brief);
  const random = mulberry32(resolvedSeed);
  const industry: IndustryId = inferIndustry(brief);
  const profile = industryProfile(industry);

  const header = choose(profile.headerPool, random);
  const heroVariant = choose(profile.heroPool, random);
  const productPresentation = choose(profile.presentationPool, random);
  const footerMood = choose(profile.footerPool, random);
  const typeScale = choose(profile.typeScalePool, random);
  const imageTreatment = choose(profile.imageTreatmentPool, random);
  const baseDensity = choose(profile.densityPool, random);

  const [minCount, maxCount] = profile.bodyCount;
  const bodyCount = minCount + Math.floor(random() * (maxCount - minCount + 1));
  const supporting = weightedSample(profile.sectionWeights, Math.max(2, bodyCount - 1), random);

  const placed = [...supporting, "featuredProducts" as SectionTypeId]
    .map((typeId) => ({
      typeId,
      position: SECTION_BASE_POSITION[typeId] + (profile.positionShift[typeId] ?? 0) + (random() - 0.5) * 0.14,
    }))
    .sort((left, right) => left.position - right.position);

  const toneCycle = choose(TONE_CYCLES, random);
  const productNouns = extractProductNouns(brief, industry);

  const sections: PagePlanSection[] = placed.map(({ typeId }, order) => {
    const definition = SECTION_TYPES[typeId];
    const variantIds = Object.keys(definition.variants);
    return {
      id: `${typeId}-${order + 1}`,
      type: typeId,
      variant: choose(variantIds, random),
      alignment: alignmentFor(typeId, random),
      mediaPosition: mediaPositionFor(typeId, order, random),
      density: definition.axes.density ? shiftDensity(baseDensity, Math.floor(random() * 3) - 1) : "regular",
      tone: definition.axes.tone ? toneCycle[order % toneCycle.length] : "light",
      // geometry 축도 시드로 고릅니다. normalizeSection이 타입별 허용 조합으로 다시 눌러 줍니다.
      container: definition.geometry?.containers?.length ? choose(definition.geometry.containers, random) : undefined,
      columns: definition.geometry?.columns?.length ? choose(definition.geometry.columns, random) : undefined,
      surfaceStyle: definition.geometry?.surfaces?.length ? choose(definition.geometry.surfaces, random) : undefined,
      intent: definition.purpose,
      headline: HEADLINE_DRAFTS[typeId],
    };
  });

  const plan: PagePlan = {
    version: PAGE_PLAN_VERSION,
    industry,
    industryLabel: profile.label,
    productCategory: productNouns.length ? productNouns.join(", ") : profile.label,
    productExamples: productNouns,
    audience: "",
    brandPosition: "",
    mood: "",
    emphasis: productNouns.slice(0, 3),
    header,
    hero: {
      variant: heroVariant,
      alignment: choose(["left", "center"] as SectionAlignment[], random),
      mediaPosition: heroVariant === "typographic-marquee" ? "bottom" : "background",
      density: baseDensity,
      tone: toneCycle[0] === "dark" ? "dark" : choose(["light", "dark"] as SectionTone[], random),
      headline: "",
    },
    palette: composePalette(input.colors, random),
    productPresentation,
    footerMood,
    typeScale,
    typography: resolvePlanTypography(profile, typeScale, random),
    imageTreatment,
    sections,
    rationale: `AI page planner 응답을 쓰지 못해 ${profile.label} 가중치와 브리프 시드(${resolvedSeed})로 구성했습니다.`,
  };

  return normalizePagePlan(plan, { brandColor: (input.colors ?? [])[0], brief });
}
