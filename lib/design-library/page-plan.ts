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
import { INDUSTRY_IDS, industryProfile, type IndustryId } from "./industry.ts";
import {
  SECTION_ALIGNMENTS,
  SECTION_ALIGNMENT_SPECS,
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
  type SectionDensity,
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
  /** 이 브랜드에 이 섹션이 왜 필요한지. 사람이 읽는 근거이자 2단계 생성의 카피 지침입니다. */
  intent: z.string().trim().min(1).max(400),
  /** 이 섹션의 한국어 헤딩 초안입니다. */
  headline: z.string().trim().max(120),
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
  required: ["version", "industry", "industryLabel", "productCategory", "productExamples", "audience", "brandPosition", "mood", "emphasis", "header", "hero", "productPresentation", "footerMood", "typeScale", "imageTreatment", "sections", "rationale"],
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
        required: ["id", "type", "variant", "alignment", "mediaPosition", "density", "tone", "intent", "headline"],
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: [...SECTION_TYPE_IDS] },
          variant: { type: "string", enum: ALL_VARIANT_IDS },
          alignment: { type: "string", enum: [...SECTION_ALIGNMENTS] },
          mediaPosition: { type: "string", enum: [...SECTION_MEDIA_POSITIONS] },
          density: { type: "string", enum: [...SECTION_DENSITIES] },
          tone: { type: "string", enum: [...SECTION_TONES] },
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
  return {
    ...section,
    id: slugify(section.id, `${section.type}-${order + 1}`),
    variant,
    alignment,
    mediaPosition,
    density,
    tone,
    intent: section.intent.trim() || definition.purpose,
    headline: section.headline.trim(),
  };
}

/**
 * AI가 돌려준 plan을 저장 가능한 형태로 정규화합니다.
 * - 알 수 없는 타입/variant는 레지스트리 값으로 되돌립니다.
 * - 상품 진열(featuredProducts)은 정확히 하나만 남기고, 없으면 만들어 끼웁니다.
 * - 반복 불가 타입의 중복과 붙어 있는 같은 톤을 정리해 페이지 리듬을 보장합니다.
 * plan 자체를 버리고 고정 템플릿으로 되돌리는 경로는 없습니다.
 */
export function normalizePagePlan(plan: PagePlan): PagePlan {
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

  return { ...plan, sections: sections.slice(0, PAGE_PLAN_MAX_SECTIONS) };
}

export function parsePagePlan(value: unknown): PagePlan {
  return normalizePagePlan(pagePlanSchema.parse(value));
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
타이포 스케일: ${plan.typeScale} · 이미지 처리: ${plan.imageTreatment} · 상품 진열: ${plan.productPresentation}
본문 순서: ${sections.join(" → ")}
이 구성은 참고용이다. 선택 영역 밖의 섹션을 추가·삭제·재배치하지 말고, 위 상품군과 톤을 벗어나는 카피나 이미지를 만들지 않는다.`;
}

function axisLine(section: PagePlanSection) {
  const parts = [
    `정렬=${section.alignment}(${SECTION_ALIGNMENT_SPECS[section.alignment]})`,
    `미디어=${section.mediaPosition}(${SECTION_MEDIA_POSITION_SPECS[section.mediaPosition]})`,
    `밀도=${section.density}(${SECTION_DENSITY_SPECS[section.density]})`,
    `톤=${section.tone}(${SECTION_TONE_SPECS[section.tone]})`,
  ];
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
