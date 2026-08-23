export { REFERENCE_PATTERNS, referencePatternById } from "./reference-patterns.ts";
export {
  CATEGORY_VARIANTS,
  CTA_VARIANTS,
  DENSITY_SCALES,
  FOOTER_MOODS,
  HEADER_STRUCTURES,
  HERO_VARIANT_IDS,
  HERO_VARIANTS,
  IMAGE_TREATMENTS,
  PRODUCT_CONTEXT_VARIANTS,
  PRODUCT_PRESENTATIONS,
  SECTION_VARIANTS,
  sectionVariant,
  SOCIAL_VARIANTS,
  STORY_VARIANTS,
  TRUST_VARIANTS,
  TYPE_SCALES,
} from "./variants.ts";
export type { DesignVariant, DensityId, FooterMoodId, HeaderStructureId, HeroVariantId, ImageTreatmentId, ProductPresentationId, TypeScaleId } from "./variants.ts";
export { composeDesignBlueprint, inferIndustry, renderBlueprintContract } from "./blueprint.ts";
export type { DesignBlueprint, IndustryId } from "./blueprint.ts";
