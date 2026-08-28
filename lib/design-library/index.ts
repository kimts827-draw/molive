export { REFERENCE_PATTERNS, referencePatternById } from "./reference-patterns.ts";
export {
  DENSITY_SCALES,
  FOOTER_MOODS,
  HEADER_STRUCTURES,
  HERO_VARIANT_IDS,
  HERO_VARIANTS,
  IMAGE_TREATMENTS,
  PRODUCT_PRESENTATIONS,
  TYPE_SCALES,
} from "./variants.ts";
export type { DesignVariant, DensityId, FooterMoodId, HeaderStructureId, HeroVariantId, ImageTreatmentId, ProductPresentationId, TypeScaleId } from "./variants.ts";
export {
  SECTION_ALIGNMENTS,
  SECTION_DENSITIES,
  SECTION_MEDIA_POSITIONS,
  SECTION_TONES,
  SECTION_TYPE_IDS,
  SECTION_TYPES,
  SECTION_VARIANTS,
  isSectionTypeId,
  renderSectionCatalog,
  sectionType,
  sectionVariant,
} from "./section-registry.ts";
export type {
  SectionAlignment,
  SectionDensity,
  SectionMediaPosition,
  SectionRole,
  SectionTone,
  SectionTypeDefinition,
  SectionTypeId,
} from "./section-registry.ts";
export { INDUSTRY_IDS, INDUSTRY_PROFILES, SECTION_BASE_POSITION, extractProductNouns, inferIndustry, industryProfile, isIndustryId } from "./industry.ts";
export type { IndustryId, IndustryProfile } from "./industry.ts";
export {
  PAGE_PLAN_MAX_SECTIONS,
  PAGE_PLAN_MIN_SECTIONS,
  PAGE_PLAN_VERSION,
  isPagePlan,
  normalizePagePlan,
  pagePlanJsonSchema,
  pagePlanMediaBudget,
  pagePlanSchema,
  pagePlanSectionRefs,
  pagePlanSignature,
  parsePagePlan,
  renderPagePlanContract,
  renderPagePlanEditContext,
} from "./page-plan.ts";
export type { PagePlan, PagePlanSection } from "./page-plan.ts";
export { briefSeed, composeFallbackPagePlan } from "./plan-composer.ts";
export type { PlanCompositionInput } from "./plan-composer.ts";
