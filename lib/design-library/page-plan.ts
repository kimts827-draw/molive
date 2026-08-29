/**
 * Page Plan — 이번 쇼핑몰 본문의 구성 계획입니다.
 *
 * Header/Footer는 고정 컴포넌트가 소유하고, 그 사이 본문의 "어떤 섹션을, 몇 개,
 * 어떤 순서로, 어떤 variant와 시각 축으로" 둘지는 전부 이 plan이 정합니다.
 * plan은 AI가 1단계에서 만들고, 정규화된 뒤 프로젝트 데이터에 그대로 저장됩니다.
 * 2단계 디자인 생성은 이 plan을 시공하고, 저장/복구/Export는 plan을 그대로 실어 나릅니다.
 *
 * 호환성: 기존 프로젝트에는 pagePlan이 없습니다. plan이 없으면 legacy
 * architecture(header/hero/productPresentation/sections)만으로 기존 동작을 유지합니다.
 */

import { z } from "zod";
import { COLOR_STRATEGIES, SURFACE_FAMILIES, brandRamp, parseHex, rgbToHsl, surfaceTokens, toHex, type BrandPalette, type ColorStrategy, type SurfaceFamily } from "../commerce/brand-theme.ts";
import { INDUSTRY_IDS, industryProfile, type IndustryId } from "./industry.ts";
import {
  SECTION_ALIGNMENTS,
  SECTION_ALIGNMENT_SPECS,
  SECTION_COLUMNS,
  SECTION_COLUMN_SPECS,
  SECTION_CONTAINERS,
  SECTION_CONTAINER_SPECS,
  SECTION_SURFACE_STYLES,
  SECTION_SURFACE_STYLE_SPECS,
  SECTION_DENSITIES,
  SECTION_DENSITY_SPECS,
  SECTION_MEDIA_POSITIONS,
  SECTION_MEDIA_POSITION_SPECS,
  SECTION_TONES,
  SECTION_TONE_SPECS,
  SECTION_TYPES,
  SECTION_TYPE_IDS,
  sectionType,
  type SectionAlignment,
  type SectionColumns,
  type SectionContainer,
  type SectionDensity,
  type SectionSurfaceStyle,
  type SectionMediaPosition,
  type SectionTone,
  type SectionTypeId,
} from "./section-registry.ts";
import {
  DENSITY_SCALES,
  FOOTER_MOODS,
  HEADER_STRUCTURES,
  HERO_VARIANTS,
  HERO_VARIANT_IDS,
  IMAGE_TREATMENTS,
  PRODUCT_PRESENTATIONS,
  TYPE_SCALES,
  type FooterMoodId,
  type HeaderStructureId,
  type HeroVariantId,
  type ImageTreatmentId,
  type ProductPresentationId,
  type TypeScaleId,
} from "./variants.ts";

export const PAGE_PLAN_VERSION = 1 as const;
/** 본문 섹션(상품 진열 포함) 허용 개수입니다. */
export const PAGE_PLAN_MIN_SECTIONS = 3;
export const PAGE_PLAN_MAX_SECTIONS = 9;

const HEADER_IDS = Object.keys(HEADER_STRUCTURES) as HeaderStructureId[];
const PRESENTATION_IDS = Object.keys(PRODUCT_PRESENTATIONS) as ProductPresentationId[];
const FOOTER_IDS = Object.keys(FOOTER_MOODS) as FooterMoodId[];
const TYPE_SCALE_IDS = Object.keys(TYPE_SCALES) as TypeScaleId[];
const IMAGE_TREATMENT_IDS = Object.keys(IMAGE_TREATMENTS) as ImageTreatmentId[];
const ALL_VARIANT_IDS = [...new Set(SECTION_TYPE_IDS.flatMap((id) => Object.keys(SECTION_TYPES[id].variants)))];

export const pagePlanSectionSchema = z.object({
  id: z.string().trim().min(1).max(60),
  type: z.enum(SECTION_TYPE_IDS as [SectionTypeId, ...SectionTypeId[]]),
  variant: z.string().trim().min(1).max(60),
  alignment: z.enum(SECTION_ALIGNMENTS),
  mediaPosition: z.enum(SECTION_MEDIA_POSITIONS),
  density: z.enum(SECTION_DENSITIES),
  tone: z.enum(SECTION_TONES),
  /** 화면 폭 사용법. 서로 다른 섹션이 같은 모양으로 붕괴하는 것을 막는 축입니다. */
  container: z.enum(SECTION_CONTAINERS).optional(),
  /** 한 행의 단위 요소 수입니다. */
  columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]).optional(),
  /** 카드·괘선 같은 표면 성격입니다. 배경색은 tone이 맡습니다. */
  surfaceStyle: z.enum(SECTION_SURFACE_STYLES).optional(),
  /** 이 브랜드에 이 섹션이 왜 필요한지. 사람이 읽는 근거이자 2단계 생성의 카피 지침입니다. */
  intent: z.string().trim().min(1).max(400),
  /** 이 섹션의 한국어 헤딩 초안입니다. */
  headline: z.string().trim().max(120),
});

export const pagePlanPaletteSchema = z.object({
  /** 이 몰의 브랜드 색입니다. 사용자가 입력한 hex가 있으면 코드가 그 값으로 확정합니다. */
  brandColor: z.string().trim().min(4).max(9),
  colorStrategy: z.enum(COLOR_STRATEGIES),
  surfaceFamily: z.enum(SURFACE_FAMILIES),
});

export const pagePlanSchema = z.object({
  version: z.literal(PAGE_PLAN_VERSION),
  industry: z.enum(INDUSTRY_IDS as unknown as [IndustryId, ...IndustryId[]]),
  /** AI가 정한 사람 친화 업종 라벨. 이미지 프롬프트에 그대로 실립니다. */
  industryLabel: z.string().trim().min(1).max(80),
  /** 이 몰이 실제로 파는 상품군. 이미지 프롬프트의 상품 카테고리 잠금값입니다. */
  productCategory: z.string().trim().min(1).max(120),
  /** 대표 상품 예시. 사진 생성이 다른 상품군으로 흘러가지 않게 붙잡는 힌트입니다. */
  productExamples: z.array(z.string().trim().min(1).max(60)).max(8),
  audience: z.string().trim().max(160),
  brandPosition: z.string().trim().max(200),
  mood: z.string().trim().max(160),
  emphasis: z.array(z.string().trim().min(1).max(60)).max(8),
  header: z.enum(HEADER_IDS as [HeaderStructureId, ...HeaderStructureId[]]),
  hero: z.object({
    variant: z.enum(HERO_VARIANT_IDS),
    alignment: z.enum(SECTION_ALIGNMENTS),
    mediaPosition: z.enum(SECTION_MEDIA_POSITIONS),
    density: z.enum(SECTION_DENSITIES),
    tone: z.enum(SECTION_TONES),
    headline: z.string().trim().max(120),
  }),
  productPresentation: z.enum(PRESENTATION_IDS as [ProductPresentationId, ...ProductPresentationId[]]),
  footerMood: z.enum(FOOTER_IDS as [FooterMoodId, ...FooterMoodId[]]),
  typeScale: z.enum(TYPE_SCALE_IDS as [TypeScaleId, ...TypeScaleId[]]),
  imageTreatment: z.enum(IMAGE_TREATMENT_IDS as [ImageTreatmentId, ...ImageTreatmentId[]]),
  /** 색 계약입니다. palette가 없는 기존 plan도 그대로 열리도록 optional입니다. */
  palette: pagePlanPaletteSchema.optional(),
  sections: z.array(pagePlanSectionSchema).min(1).max(24),
  /** 왜 이 구성인지에 대한 한 문단 설명입니다. */
  rationale: z.string().trim().max(800),
});

export type PagePlanSection = z.infer<typeof pagePlanSectionSchema>;
export type PagePlan = z.infer<typeof pagePlanSchema>;

/** OpenAI structured output(strict)용 JSON Schema입니다. */
export const pagePlanJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["version", "industry", "industryLabel", "productCategory", "productExamples", "audience", "brandPosition", "mood", "emphasis", "palette", "header", "hero", "productPresentation", "footerMood", "typeScale", "imageTreatment", "sections", "rationale"],
  properties: {
    version: { type: "integer", enum: [PAGE_PLAN_VERSION] },
    industry: { type: "string", enum: [...INDUSTRY_IDS] },
    industryLabel: { type: "string" },
    productCategory: { type: "string" },
    productExamples: { type: "array", maxItems: 8, items: { type: "string" } },
    audience: { type: "string" },
    brandPosition: { type: "string" },
    mood: { type: "string" },
    emphasis: { type: "array", maxItems: 8, items: { type: "string" } },
    palette: {
      type: "object",
      additionalProperties: false,
      required: ["brandColor", "colorStrategy", "surfaceFamily"],
      properties: {
        brandColor: { type: "string" },
        colorStrategy: { type: "string", enum: [...COLOR_STRATEGIES] },
        surfaceFamily: { type: "string", enum: [...SURFACE_FAMILIES] },
      },
    },
    header: { type: "string", enum: [...HEADER_IDS] },
    hero: {
      type: "object",
      additionalProperties: false,
      required: ["variant", "alignment", "mediaPosition", "density", "tone", "headline"],
      properties: {
        variant: { type: "string", enum: [...HERO_VARIANT_IDS] },
        alignment: { type: "string", enum: [...SECTION_ALIGNMENTS] },
        mediaPosition: { type: "string", enum: [...SECTION_MEDIA_POSITIONS] },
        density: { type: "string", enum: [...SECTION_DENSITIES] },
        tone: { type: "string", enum: [...SECTION_TONES] },
        headline: { type: "string" },
      },
    },
    productPresentation: { type: "string", enum: [...PRESENTATION_IDS] },
    footerMood: { type: "string", enum: [...FOOTER_IDS] },
    typeScale: { type: "string", enum: [...TYPE_SCALE_IDS] },
    imageTreatment: { type: "string", enum: [...IMAGE_TREATMENT_IDS] },
    sections: {
      type: "array",
      minItems: PAGE_PLAN_MIN_SECTIONS,
      maxItems: PAGE_PLAN_MAX_SECTIONS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "type", "variant", "alignment", "mediaPosition", "density", "tone", "container", "columns", "surfaceStyle", "intent", "headline"],
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: [...SECTION_TYPE_IDS] },
          variant: { type: "string", enum: ALL_VARIANT_IDS },
          alignment: { type: "string", enum: [...SECTION_ALIGNMENTS] },
          mediaPosition: { type: "string", enum: [...SECTION_MEDIA_POSITIONS] },
          density: { type: "string", enum: [...SECTION_DENSITIES] },
          tone: { type: "string", enum: [...SECTION_TONES] },
          container: { type: "string", enum: [...SECTION_CONTAINERS] },
          columns: { type: "integer", enum: [...SECTION_COLUMNS] },
          surfaceStyle: { type: "string", enum: [...SECTION_SURFACE_STYLES] },
          intent: { type: "string" },
          headline: { type: "string" },
        },
      },
    },
    rationale: { type: "string" },
  },
} as const;

function pick<T>(values: readonly T[], index: number): T {
  return values[((index % values.length) + values.length) % values.length];
}

function slugify(value: string, fallback: string) {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return slug || fallback;
}

/**
 * 섹션 하나의 축을 레지스트리 계약에 맞게 눌러 줍니다.
 * 사진이 없는 섹션에 미디어 위치가 붙거나, 사진이 필수인 섹션이 미디어 없이 나오는 것을 막습니다.
 */
function normalizeSection(section: PagePlanSection, order: number): PagePlanSection | null {
  const definition = sectionType(section.type);
  if (!definition) return null;
  const variantIds = Object.keys(definition.variants);
  const variant = variantIds.includes(section.variant) ? section.variant : pick(variantIds, order);
  const alignment: SectionAlignment = definition.axes.alignment ? section.alignment : "left";
  let mediaPosition: SectionMediaPosition = definition.axes.mediaPosition ? section.mediaPosition : "none";
  if (definition.media === "none") mediaPosition = "none";
  if (definition.media === "required" && mediaPosition === "none") mediaPosition = pick(["left", "right", "grid", "background"] as SectionMediaPosition[], order);
  const density: SectionDensity = definition.axes.density ? section.density : "regular";
  const tone: SectionTone = definition.axes.tone ? section.tone : "light";

  /**
   * geometry 축은 타입마다 의미 있는 값이 다릅니다.
   * 레지스트리가 허용하지 않은 값이 오면 그 타입의 후보 안에서 순서 기반으로 되돌립니다.
   * (허용 목록이 비어 있으면 그 축은 쓰지 않습니다 — 예: featuredProducts의 columns는 productPresentation이 소유.)
   */
  const geometry = definition.geometry ?? {};
  /**
   * 가운데 정렬 섹션에 비대칭 지면을 주면 좌우 여백이 달라 카피가 실제로는 중앙에 오지 않습니다.
   * 두 축이 서로를 무너뜨리는 조합이므로 여기서 대칭 지면만 남깁니다.
   */
  const allowedContainers = (geometry.containers ?? []).filter((value) => alignment !== "center" || value !== "asymmetric");
  const container = allowedContainers.length
    ? (allowedContainers.includes(section.container as SectionContainer) ? section.container as SectionContainer : pick(allowedContainers, order))
    : undefined;
  const columns = geometry.columns?.length
    ? (geometry.columns.includes(section.columns as SectionColumns) ? section.columns as SectionColumns : pick(geometry.columns, order))
    : undefined;
  // 사진이 없는 섹션에 photoField를 붙이면 빈 바탕이 됩니다.
  const surfaceCandidates = (geometry.surfaces ?? []).filter((style) => style !== "photoField" || mediaPosition !== "none");
  const surfaceStyle = surfaceCandidates.length
    ? (surfaceCandidates.includes(section.surfaceStyle as SectionSurfaceStyle) ? section.surfaceStyle as SectionSurfaceStyle : pick(surfaceCandidates, order))
    : undefined;

  return {
    ...section,
    id: slugify(section.id, `${section.type}-${order + 1}`),
    variant,
    alignment,
    mediaPosition,
    density,
    tone,
    container,
    columns,
    surfaceStyle,
    intent: section.intent.trim() || definition.purpose,
    headline: section.headline.trim(),
  };
}


/**
 * 브리프가 무채색/모노크롬을 명시적으로 요구했는지 봅니다.
 * inferIndustry와 같은 결정적 키워드 검사이며, 사용자가 직접 요구한 경우에만 monochrome을 허용합니다.
 */
/**
 * 브리프가 어두운 지면을 명시적으로 요구했는지 봅니다.
 * 실제 생성 검증에서 "차콜과 뉴트럴 톤"을 적은 브리프에 AI가 surfaceFamily "warm"을 돌려주어
 * 지면이 아이보리로 나오는 모순이 확인됐습니다. 그 모순만 결정적으로 막습니다.
 */
const DARK_SURFACE_KEYWORDS = ["차콜", "charcoal", "다크", "dark", "블랙", "black", "검정", "검은", "먹색", "무채색 어두운"];

/** 반대로 따뜻한 지면을 명시한 브리프는 warm을 그대로 지킵니다. */
const WARM_SURFACE_KEYWORDS = ["아이보리", "ivory", "크림", "cream", "따뜻", "warm", "베이지", "beige", "우드", "웜톤"];

export function briefAsksDarkSurface(brief: string | undefined | null) {
  if (!brief) return false;
  const haystack = brief.toLowerCase();
  return DARK_SURFACE_KEYWORDS.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

export function briefAsksWarmSurface(brief: string | undefined | null) {
  if (!brief) return false;
  const haystack = brief.toLowerCase();
  return WARM_SURFACE_KEYWORDS.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

/** 이보다 어두운 브랜드 색이면 밝은 지면과 짝지었을 때 브리프와 어긋납니다. */
const VERY_DARK_LIGHTNESS = 0.28;

const MONOCHROME_KEYWORDS = ["모노크롬", "무채색", "흑백", "블랙앤화이트", "블랙 앤 화이트", "그레이스케일", "monochrome", "black and white", "greyscale", "grayscale"];

export function briefAsksMonochrome(brief: string | undefined | null) {
  if (!brief) return false;
  const haystack = brief.toLowerCase();
  return MONOCHROME_KEYWORDS.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

/** accent 밴드로 승격할 후보 순서입니다. 전환·탐색 역할 섹션만 쓰고 상품 진열은 건드리지 않습니다. */
const ACCENT_PROMOTION_ORDER: SectionTypeId[] = ["cta", "editorialBanner", "promotion", "categoryGrid", "gift", "collection", "benefits"];

export type PagePlanNormalizeOptions = {
  /** 사용자가 생성 화면에서 고른 brand main color입니다. 있으면 이 값이 진실입니다. */
  brandColor?: string;
  /** monochrome 예외 판정을 위한 원본 브리프입니다. */
  brief?: string;
};

/**
 * 색 계약을 확정합니다. AI 응답을 심판해 재생성시키지 않고, 코드가 값을 눌러 씁니다.
 * - 사용자가 hex를 넣었으면 brandColor는 무조건 그 값입니다.
 * - 그 hex를 넣고도 AI가 monochrome을 고르면 색이 도로 사라지므로 accent-only로 강등합니다.
 *   브리프가 명시적으로 무채색을 요구한 경우만 예외로 통과시킵니다.
 * - dominant인데 surfaceFamily가 white면 색을 무력화하는 조합이라 tinted로 눌러 줍니다.
 */
function normalizePalette(plan: PagePlan, options: PagePlanNormalizeOptions): BrandPalette | undefined {
  const supplied = parseHex(options.brandColor);
  const planned = plan.palette;
  const plannedRgb = parseHex(planned?.brandColor);
  const brandColor = supplied ? toHex(supplied) : plannedRgb ? toHex(plannedRgb) : null;
  if (!brandColor) return undefined;

  let colorStrategy: ColorStrategy = planned?.colorStrategy ?? "accent-only";
  if (supplied && colorStrategy === "monochrome" && !briefAsksMonochrome(options.brief)) colorStrategy = "accent-only";

  let surfaceFamily: SurfaceFamily = planned?.surfaceFamily ?? "white";
  if (colorStrategy === "dominant" && surfaceFamily === "white") surfaceFamily = "tinted";

  /**
   * 브리프가 어두운 지면을 명시했고 브랜드 색도 매우 어두운데 AI가 밝고 따뜻한 지면을 골랐다면,
   * 그건 브리프와 어긋난 조합입니다. 재생성 없이 지면만 결정적으로 되돌립니다.
   * 브리프가 따뜻한 지면을 함께 명시했다면(예: "차콜과 아이보리") 사용자의 말을 우선해 그대로 둡니다.
   */
  const brandHsl = rgbToHsl(parseHex(brandColor) as NonNullable<ReturnType<typeof parseHex>>);
  const veryDarkBrand = brandHsl.l < VERY_DARK_LIGHTNESS;
  const lightSurface = surfaceFamily === "warm" || surfaceFamily === "white";
  if (lightSurface && veryDarkBrand && briefAsksDarkSurface(options.brief) && !briefAsksWarmSurface(options.brief)) {
    // 채도가 남아 있으면 cool 쪽이 브랜드와 덜 부딪히고, 무채색이면 dark가 브리프에 그대로 맞습니다.
    surfaceFamily = brandHsl.s >= 0.2 ? "cool" : "dark";
  }

  return { brandColor, colorStrategy, surfaceFamily };
}

/**
 * 본문에 브랜드 색 면적을 최소 한 곳 남깁니다.
 * accent tone 섹션이 하나도 없으면 전환·탐색 섹션 하나를 승격합니다(monochrome은 제외).
 * planLayoutCss의 accent 규칙이 전체 명시도라, 승격된 섹션은 AI가 무엇을 쓰든 브랜드 색을 갖습니다.
 */
function ensureAccentBands(sections: PagePlanSection[], palette: BrandPalette | undefined) {
  if (!palette || palette.colorStrategy === "monochrome") return sections;
  const limit = palette.colorStrategy === "dominant" ? 2 : 1;
  const next = [...sections];
  const accentCount = () => next.filter((section) => section.tone === "accent").length;
  if (accentCount() >= limit) return next;

  // 승격 후보: 전환·탐색 역할 섹션이 먼저, 그다음은 뒤에서부터의 톤 가능 섹션.
  const preferred = ACCENT_PROMOTION_ORDER.flatMap((typeId) => next.flatMap((section, index) => (section.type === typeId ? [index] : [])));
  const remainder = next.map((_, index) => index).reverse();
  const candidates = [...new Set([...preferred, ...remainder])]
    .filter((index) => next[index].type !== "featuredProducts" && SECTION_TYPES[next[index].type].axes.tone);

  for (const index of candidates) {
    if (accentCount() >= limit) break;
    if (next[index].tone === "accent") continue;
    // 붙어 있는 두 섹션이 모두 accent면 한 덩어리로 보여 밴드 효과가 사라집니다.
    if (next[index - 1]?.tone === "accent" || next[index + 1]?.tone === "accent") continue;
    next[index] = { ...next[index], tone: "accent" };
  }
  return next;
}

/**
 * AI가 돌려준 plan을 저장 가능한 형태로 정규화합니다.
 * - 알 수 없는 타입/variant는 레지스트리 값으로 되돌립니다.
 * - 상품 진열(featuredProducts)은 정확히 하나만 남기고, 없으면 만들어 끼웁니다.
 * - 반복 불가 타입의 중복과 붙어 있는 같은 톤을 정리해 페이지 리듬을 보장합니다.
 * plan 자체를 버리고 고정 템플릿으로 되돌리는 경로는 없습니다.
 */
export function normalizePagePlan(plan: PagePlan, options: PagePlanNormalizeOptions = {}): PagePlan {
  const seen = new Set<SectionTypeId>();
  const ids = new Set<string>();
  const sections: PagePlanSection[] = [];

  for (const [order, raw] of plan.sections.entries()) {
    const section = normalizeSection(raw, order);
    if (!section) continue;
    const definition = SECTION_TYPES[section.type];
    if (!definition.repeatable && seen.has(section.type)) continue;
    seen.add(section.type);
    let id = section.id;
    let suffix = 2;
    while (ids.has(id)) id = `${section.id}-${suffix++}`;
    ids.add(id);
    sections.push({ ...section, id });
    if (sections.length >= PAGE_PLAN_MAX_SECTIONS) break;
  }

  const productIndexes = sections.flatMap((section, index) => (section.type === "featuredProducts" ? [index] : []));
  if (productIndexes.length === 0) {
    const profile = industryProfile(plan.industry);
    const at = Math.min(sections.length, Math.max(1, Math.round(sections.length * (0.42 + (profile.positionShift.featuredProducts ?? 0)))));
    sections.splice(at, 0, {
      id: "featured-products",
      type: "featuredProducts",
      variant: "heading-more",
      alignment: "left",
      mediaPosition: "none",
      density: "regular",
      tone: "light",
      container: "boxed",
      intent: "실제 Cafe24 상품이 들어가는 단 하나의 진열 자리입니다.",
      headline: "",
    });
  } else if (productIndexes.length > 1) {
    for (const index of productIndexes.slice(1).reverse()) sections.splice(index, 1);
  }

  // 붙어 있는 섹션이 같은 톤이면 페이지가 한 덩어리로 보입니다. 두 번째 톤을 밀어 리듬을 만듭니다.
  for (let index = 1; index < sections.length; index += 1) {
    const previous = sections[index - 1].tone;
    if (sections[index].tone !== previous) continue;
    if (!SECTION_TYPES[sections[index].type].axes.tone) continue;
    const start = SECTION_TONES.indexOf(previous) + 1 + index;
    const next = SECTION_TONES.map((_, offset) => pick(SECTION_TONES, start + offset)).find((candidate) => candidate !== previous);
    sections[index] = { ...sections[index], tone: next ?? (previous === "light" ? "tinted" : "light") };
  }

  // 좌우 분할이 연달아 같은 방향이면 두 번째를 뒤집습니다.
  for (let index = 1; index < sections.length; index += 1) {
    const previous = sections[index - 1];
    const current = sections[index];
    if (current.mediaPosition !== previous.mediaPosition) continue;
    if (current.mediaPosition === "left") sections[index] = { ...current, mediaPosition: "right" };
    else if (current.mediaPosition === "right") sections[index] = { ...current, mediaPosition: "left" };
  }

  const palette = normalizePalette(plan, options);
  const bodySections = ensureAccentBands(sections.slice(0, PAGE_PLAN_MAX_SECTIONS), palette);
  return { ...plan, palette, sections: bodySections };
}

export function parsePagePlan(value: unknown, options: PagePlanNormalizeOptions = {}): PagePlan {
  return normalizePagePlan(pagePlanSchema.parse(value), options);
}

export function isPagePlan(value: unknown): value is PagePlan {
  return pagePlanSchema.safeParse(value).success;
}

/** legacy architecture.sections에 저장할 "type/variant — 헤딩" 문자열 목록입니다. */
export function pagePlanSectionRefs(plan: PagePlan): string[] {
  return plan.sections.map((section) => {
    const label = section.headline.trim() || SECTION_TYPES[section.type].name;
    return `${section.type}/${section.variant} — ${label}`;
  });
}

/** 구조 비교용 시퀀스 문자열입니다(테스트·트레이스에서 씁니다). */
export function pagePlanSignature(plan: PagePlan): string {
  return [
    `header/${plan.header}`,
    `hero/${plan.hero.variant}`,
    ...plan.sections.map((section) => `${section.type}/${section.variant}`),
    `presentation/${plan.productPresentation}`,
  ].join(" > ");
}

/** 이번 plan이 실제로 요구하는 브랜드/무드 이미지 개수의 대략치입니다. */
export function pagePlanMediaBudget(plan: PagePlan): number {
  return plan.sections.reduce((total, section) => total + (SECTION_TYPES[section.type].media === "none" || section.mediaPosition === "none" ? 0 : 1), plan.hero.mediaPosition === "none" ? 0 : 1);
}

/**
 * Editor의 선택 영역 AI 수정에 넘기는 압축 구성 컨텍스트입니다.
 * 전체 계약(renderPagePlanContract)은 페이지를 새로 시공할 때 쓰는 것이라 너무 길어서,
 * 부분 수정에는 "이 페이지가 무엇을 파는 어떤 구성인가"만 한 줄씩 전달합니다.
 */
export function renderPagePlanEditContext(plan: PagePlan): string {
  const sections = [
    `hero/${plan.hero.variant}[${plan.hero.alignment},${plan.hero.mediaPosition},${plan.hero.density},${plan.hero.tone}]`,
    ...plan.sections.map((section) => `${section.type}/${section.variant}[${section.alignment},${section.mediaPosition},${section.density},${section.tone}]`),
  ];
  return `PROJECT PAGE COMPOSITION (context only)
업종: ${plan.industryLabel} · 판매 상품군: ${plan.productCategory}${plan.productExamples.length ? ` (예: ${plan.productExamples.join(", ")})` : ""}
분위기: ${plan.mood || "명시 없음"} · 강조점: ${plan.emphasis.join(", ") || "명시 없음"}
타이포 스케일: ${plan.typeScale} · 이미지 처리: ${plan.imageTreatment} · 상품 진열: ${plan.productPresentation}${plan.palette ? `
브랜드 색: ${plan.palette.brandColor} (전략 ${plan.palette.colorStrategy}) · 색은 var(--molive-brand) 계열 변수를 쓴다` : ""}
본문 순서: ${sections.join(" → ")}
이 구성은 참고용이다. 선택 영역 밖의 섹션을 추가·삭제·재배치하지 말고, 위 상품군과 톤을 벗어나는 카피나 이미지를 만들지 않는다.`;
}


/** colorStrategy가 페이지에서 색을 얼마나 쓰는지에 대한 계약입니다. */
export const COLOR_STRATEGY_SPECS: Record<ColorStrategy, string> = {
  dominant: "브랜드 색이 페이지의 주인공이다. 큰 색면 밴드와 푸터를 브랜드 색으로 덮고, 사진보다 색이 먼저 보이게 한다.",
  band: "브랜드 색을 밴드로 쓴다. 한두 개 섹션과 푸터를 브랜드 톤으로 깔고 나머지는 밝은 지면으로 둔다.",
  "accent-only": "브랜드 색을 CTA·라벨·괘선 같은 작은 면적에만 쓰고 지면은 중립으로 둔다. 단 본문 한 곳에는 색면이 남는다.",
  duotone: "브랜드 색과 코드가 파생한 2차 색을 교대로 쓴다. 두 색이 서로 다른 섹션을 맡아 리듬을 만든다.",
  monochrome: "브랜드 색을 거의 쓰지 않고 명도 대비만으로 구성한다. 브리프가 무채색을 요구했을 때만 쓴다.",
};

/** surfaceFamily가 지면의 바탕 성격을 정합니다. */
export const SURFACE_FAMILY_SPECS: Record<SurfaceFamily, string> = {
  white: "순백에 가까운 지면. 상품과 사진이 주인공이 된다.",
  warm: "따뜻한 아이보리·크림 지면. 식품·수공예의 온기를 만든다.",
  cool: "차가운 회백 지면. 기술·정밀함의 인상을 만든다.",
  tinted: "브랜드 색을 아주 옅게 섞은 지면. 페이지 전체가 브랜드 색을 머금는다.",
  dark: "어두운 지면에 밝은 텍스트. 색과 사진이 강하게 튀어나온다.",
};

/** 2단계 생성 프롬프트에 실을 색 계약 텍스트입니다. */
export function renderPaletteContract(palette: BrandPalette | undefined) {
  if (!palette) return "";
  const ramp = brandRamp(palette.brandColor);
  if (!ramp) return "";
  const surface = surfaceTokens(palette.surfaceFamily, palette.brandColor);
  return `PALETTE (구속력 있음)
- 브랜드 색: ${ramp.brand} — 이 몰의 주 색이다. 다른 색으로 바꾸거나 채도를 낮춰 중립색으로 만들지 않는다.
- 색 전략(${palette.colorStrategy}): ${COLOR_STRATEGY_SPECS[palette.colorStrategy]}
- 지면 성격(${palette.surfaceFamily}): ${SURFACE_FAMILY_SPECS[palette.surfaceFamily]}
  기본 지면색은 var(--molive-surface)=${surface.surface}, 그 위 글자는 var(--molive-surface-ink)=${surface.surfaceInk}. 페이지 바탕은 이 값에서 출발한다.
- 코드가 아래 CSS 변수를 페이지 루트에 이미 선언한다. 리터럴 hex 대신 이 변수를 써야 나중에 색을 바꿔도 페이지가 따라온다.
  var(--molive-brand)=${ramp.brand} · var(--molive-brand-strong)=${ramp.strong} · var(--molive-brand-tint)=${ramp.tint} · var(--molive-brand-soft)=${ramp.soft} · var(--molive-brand-on)=${ramp.on}${palette.colorStrategy === "duotone" ? ` · var(--molive-brand-secondary)=${ramp.secondary}` : ""}
- 브랜드 색은 선이나 아이콘 같은 얇은 요소가 아니라 배경 색면, CTA 채움, 카드 바탕처럼 눈에 보이는 면적으로 써야 한다.
- 레퍼런스 몰은 브랜드 색을 풀폭 밴드, 푸터, 카테고리 타일, 프로모션 패널의 배경으로 쓴다. 같은 방식으로 쓴다.`;
}

function axisLine(section: PagePlanSection) {
  const parts = [
    `정렬=${section.alignment}(${SECTION_ALIGNMENT_SPECS[section.alignment]})`,
    `미디어=${section.mediaPosition}(${SECTION_MEDIA_POSITION_SPECS[section.mediaPosition]})`,
    `밀도=${section.density}(${SECTION_DENSITY_SPECS[section.density]})`,
    `톤=${section.tone}(${SECTION_TONE_SPECS[section.tone]})`,
  ];
  if (section.container) parts.push(`지면=${section.container}(${SECTION_CONTAINER_SPECS[section.container]})`);
  if (section.columns) parts.push(`컬럼=${section.columns}(${SECTION_COLUMN_SPECS[section.columns]}) — CSS는 repeat(var(--molive-columns),1fr)로 쓴다`);
  if (section.surfaceStyle) parts.push(`표면=${section.surfaceStyle}(${SECTION_SURFACE_STYLE_SPECS[section.surfaceStyle]})`);
  return parts.join(" · ");
}

/**
 * plan을 2단계 디자인 생성 프롬프트에 넣을 구조 계약 텍스트로 렌더링합니다.
 * 이 계약은 "AI가 1단계에서 스스로 세운 계획"이므로, 2단계는 그 계획을 시공합니다.
 */
export function renderPagePlanContract(plan: PagePlan): string {
  const heroVariant = HERO_VARIANTS[plan.hero.variant];
  const sectionLines = plan.sections.map((section, index) => {
    const definition = SECTION_TYPES[section.type];
    const variant = definition.variants[section.variant] ?? Object.values(definition.variants)[0];
    const slot = section.type === "featuredProducts"
      ? " ← 이 자리에 비어 있는 data-cafe24-slot=\"product-list\" wrapper를 두고 주변 프레임(헤딩·카피·배경)만 작성한다."
      : "";
    const headline = section.headline.trim() ? `\n   헤딩 초안: ${section.headline.trim()}` : "";
    return `${index + 2}. [${section.type}/${variant.id}] ${definition.name} — ${variant.name}\n   구조: ${variant.spec}\n   축: ${axisLine(section)}\n   의도: ${section.intent}${headline}${slot}`;
  });

  return `PAGE COMPOSITION (이번 프로젝트 전용, 1단계에서 확정됨 · 구속력 있음)
업종: ${plan.industryLabel} · 판매 상품군: ${plan.productCategory}${plan.productExamples.length ? ` (예: ${plan.productExamples.join(", ")})` : ""}
타깃: ${plan.audience || "명시 없음"} · 브랜드 포지션: ${plan.brandPosition || "명시 없음"}
분위기: ${plan.mood || "명시 없음"} · 강조점: ${plan.emphasis.join(", ") || "명시 없음"}
구성 근거: ${plan.rationale || "-"}
${renderPaletteContract(plan.palette)}

이 구성은 이번 브랜드를 위해 새로 설계된 것이다. 아래 섹션을 순서대로, 빠짐없이, 더하지 말고 시공하되
카피·색·이미지·비례·디테일로 브랜드를 표현한다. 다른 프로젝트에서 본 순서를 재사용하지 않는다.

고정 컴포넌트 배치(코드가 렌더링, AI는 주변만 설계):
- Header = ${plan.header} (${HEADER_STRUCTURES[plan.header].name}): ${HEADER_STRUCTURES[plan.header].spec} Header HTML/CSS는 절대 작성하지 않는다.
- Product presentation = ${plan.productPresentation} (${PRODUCT_PRESENTATIONS[plan.productPresentation].name}, ${PRODUCT_PRESENTATIONS[plan.productPresentation].columns}): ${PRODUCT_PRESENTATIONS[plan.productPresentation].spec} 카드 CSS는 코드가 소유한다.

1. [hero/${heroVariant.id}] ${heroVariant.name}
   구조: ${heroVariant.spec}
   축: 정렬=${plan.hero.alignment}(${SECTION_ALIGNMENT_SPECS[plan.hero.alignment]}) · 미디어=${plan.hero.mediaPosition}(${SECTION_MEDIA_POSITION_SPECS[plan.hero.mediaPosition]}) · 밀도=${plan.hero.density}(${SECTION_DENSITY_SPECS[plan.hero.density]}) · 톤=${plan.hero.tone}(${SECTION_TONE_SPECS[plan.hero.tone]})${plan.hero.headline.trim() ? `\n   헤딩 초안: ${plan.hero.headline.trim()}` : ""}
${sectionLines.join("\n")}

페이지 전역 축:
- Hero 기준 밀도(${plan.hero.density}, 섹션별 밀도 축이 항상 우선): ${DENSITY_SCALES[plan.hero.density]}
- 타이포 스케일(${plan.typeScale}): ${TYPE_SCALES[plan.typeScale]}
- 이미지 처리(${plan.imageTreatment}): ${IMAGE_TREATMENTS[plan.imageTreatment]}
- 푸터 무드(${plan.footerMood}): ${FOOTER_MOODS[plan.footerMood].spec}

architecture 기록 계약:
- architecture.header 에 정확히 "${plan.header}" 를 기록한다.
- architecture.hero 에 정확히 "${plan.hero.variant}" 를 기록한다.
- architecture.productPresentation 에 정확히 "${plan.productPresentation}" 를 기록한다.
- architecture.sections 에는 위 ${plan.sections.length}개 섹션을 순서대로 "type/variant — 헤딩" 형태로 기록한다.
- 섹션 배경은 위에 지정된 톤을 따르되, 붙어 있는 섹션끼리 최소 두 가지 이상의 배경 톤이 교차하게 만든다.`;
}
