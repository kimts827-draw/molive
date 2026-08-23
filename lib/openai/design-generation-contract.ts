import type { SafetyViolation } from "../cafe24/protection.ts";
import { renderBlueprintContract, type DesignBlueprint } from "../design-library/blueprint.ts";
import { HERO_VARIANT_IDS } from "../design-library/variants.ts";

export type DesignGenerationInput = {
  prompt: string;
  brandName?: string;
  colors?: string[];
  assetUrls?: string[];
  assetRoles?: string[];
  /** blueprint 조합을 결정적으로 만들 때만 씁니다(테스트/스크립트용). */
  seed?: number;
};

export function buildDesignGenerationUserPrompt(input: DesignGenerationInput, blueprint?: DesignBlueprint) {
  const heroChoices = blueprint ? blueprint.hero.id : HERO_VARIANT_IDS.join(" | ");
  return `Design a complete Cafe24 storefront from first principles.
Brand: ${input.brandName?.trim() || "Not specified"}
Creative brief: ${input.prompt}
Explicit brand colors: ${(input.colors ?? []).join(", ") || "None; infer a palette from the brief and assets"}
Attached image count: ${(input.assetUrls ?? []).length}
Attachment roles in order: ${(input.assetRoles ?? []).join(", ") || "Not labelled"}
Use attachments only through asset:// followed by the zero-based attachment index.

Before coding, make coupled decisions and record them concretely in designRationale and the existing architecture fields: headerVariant (split-utility | centered-brand | overlay-minimal), heroComposition (${heroChoices}), productLayout (grid-four | large-grid), section order and selection, typography scale, image treatment, spacing/density, and content composition. Each decision must follow this brand and would be recognizably wrong for a materially different brand. Do not merely recolor a generic storefront. Then author the complete HTML and CSS.${blueprint ? `\n\n${renderBlueprintContract(blueprint)}` : ""}`;
}

const PRODUCT_SELECTORS = [
  ".ec-base-product",
  ".moireProductSection",
  ".prdList",
  ".prdList__item",
  ".thumbnail",
  ".description",
  ".spec",
  ".likeButton",
  ".icon__box",
] as const;

function productSlotsAreEmpty(html: string, expectedCount: number) {
  const pattern = /<([a-z][a-z0-9-]*)\b[^>]*data-cafe24-slot\s*=\s*["']product-list["'][^>]*>([\s\S]*?)<\/\1\s*>/gi;
  const matches = [...html.matchAll(pattern)];
  return matches.length === expectedCount && matches.every((match) => match[2].trim() === "");
}

/** 일반 Legacy 문서가 아니라 새 AI 생성 draft에만 적용되는 품질·소유권 계약입니다. */
export function validateGeneratedDesignContract(
  source: { html: string; css: string; architecture?: { hero?: string; header?: string; productPresentation?: string; sections?: string[] } },
  blueprint?: DesignBlueprint,
): SafetyViolation[] {
  const violations: SafetyViolation[] = [];

  if (blueprint) {
    if (source.architecture?.hero !== blueprint.hero.id) {
      violations.push({ code: "BLUEPRINT_HERO_MISMATCH", message: `architecture.hero는 blueprint의 hero variant "${blueprint.hero.id}"를 그대로 기록해야 합니다.`, token: source.architecture?.hero });
    }
    if (source.architecture?.header !== blueprint.header.id) {
      violations.push({ code: "BLUEPRINT_HEADER_MISMATCH", message: `architecture.header는 blueprint의 header 구조 "${blueprint.header.id}"를 그대로 기록해야 합니다.`, token: source.architecture?.header });
    }
    if (source.architecture?.productPresentation !== blueprint.productPresentation.id) {
      violations.push({ code: "BLUEPRINT_PRODUCT_MISMATCH", message: `architecture.productPresentation은 blueprint의 진열 "${blueprint.productPresentation.id}"를 그대로 기록해야 합니다.`, token: source.architecture?.productPresentation });
    }
    const planned = blueprint.sections.length;
    const recorded = source.architecture?.sections?.length ?? 0;
    if (recorded < planned) {
      violations.push({ code: "BLUEPRINT_SECTIONS_MISSING", message: `architecture.sections에는 blueprint의 섹션 계획 ${planned}개가 순서대로 기록되어야 합니다.` });
    }
  }
  const slots = [...source.html.matchAll(/data-cafe24-slot\s*=\s*["']product-list["']/gi)].length;
  const sections = [...source.html.matchAll(/<section\b/gi)].length;

  if (slots !== 1) violations.push({ code: "PRODUCT_SLOT_COUNT", message: "AI 생성 페이지에는 product-list 슬롯이 정확히 하나 있어야 합니다." });
  if (slots > 0 && !productSlotsAreEmpty(source.html, slots)) violations.push({ code: "PRODUCT_SLOT_NOT_EMPTY", message: "product-list 슬롯 내부는 verified ProductSection이 소유하므로 비어 있어야 합니다." });
  if (/<header\b/i.test(source.html)) violations.push({ code: "GENERATED_HEADER", message: "HeaderV1이 헤더를 소유하므로 AI HTML에 header 요소를 만들 수 없습니다." });
  if (!/data-moire-type\s*=\s*["']hero["']/i.test(source.html)) violations.push({ code: "MISSING_HERO", message: "완성된 쇼핑몰 구성을 위해 hero 섹션이 필요합니다." });
  if (sections < 3) violations.push({ code: "INSUFFICIENT_PAGE_COMPOSITION", message: "Hero와 상품 외에도 브랜드에 맞는 지원 섹션을 포함해 최소 세 개의 section 구성이 필요합니다." });
  if (!/@media[^{]*(?:max-width|width\s*<)/i.test(source.css)) violations.push({ code: "MISSING_MOBILE_REFLOW", message: "모바일 stack/reflow를 위한 반응형 media query가 필요합니다." });
  if (/!important\b/i.test(source.css)) violations.push({ code: "CSS_IMPORTANT_FORBIDDEN", message: "AI CSS는 고정 Header/Product 격리를 우회하는 !important를 사용할 수 없습니다." });

  for (const selector of PRODUCT_SELECTORS) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`${escaped}(?=[\\s.#:[>,+~{])`, "i").test(source.css)) {
      violations.push({ code: "VERIFIED_PRODUCT_CSS", message: "verified ProductSection 내부 CSS는 AI가 생성할 수 없습니다.", token: selector });
    }
  }
  return violations;
}
