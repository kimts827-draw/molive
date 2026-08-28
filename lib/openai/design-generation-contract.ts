import type { SafetyViolation } from "../cafe24/protection.ts";
import { renderPagePlanContract, type PagePlan } from "../design-library/page-plan.ts";
import { HERO_VARIANT_IDS } from "../design-library/variants.ts";
import { BRAND_IMAGE_POLICY, PRODUCT_AREA_IMAGE_POLICY } from "../assets/asset-policy.ts";

export type DesignGenerationInput = {
  prompt: string;
  brandName?: string;
  colors?: string[];
  /** 이번 생성 요청의 이미지 세션입니다. 첨부는 이 세션 폴더 안에 있는 것만 인정합니다. */
  assetSessionId?: string;
  assetUrls?: string[];
  assetRoles?: string[];
  /** 현재 프로젝트에 명시적으로 연결된 이미지 주소입니다(재생성 시 사용). */
  projectAssetUrls?: string[];
  /** 이번 생성 과정에서 새로 만들어 등록한 이미지 주소입니다. */
  generatedAssetUrls?: string[];
  /** page plan 대비 경로를 결정적으로 만들 때만 씁니다(테스트/스크립트용). */
  seed?: number;
};

export function buildDesignGenerationUserPrompt(input: DesignGenerationInput, plan?: PagePlan) {
  const heroChoices = plan ? plan.hero.variant : HERO_VARIANT_IDS.join(" | ");
  const productLine = plan
    ? `\nThis shop sells: ${plan.productCategory}${plan.productExamples.length ? ` (예: ${plan.productExamples.join(", ")})` : ""}. Every product name, photo direction and piece of copy must stay inside that category.`
    : "";
  return `Design a complete Cafe24 storefront from first principles.
Brand: ${input.brandName?.trim() || "Not specified"}
Creative brief: ${input.prompt}
Explicit brand colors: ${(input.colors ?? []).join(", ") || "None; infer a palette from the brief and assets"}
Attached image count: ${(input.assetUrls ?? []).length}
Attachment roles in order: ${(input.assetRoles ?? []).join(", ") || "Not labelled"}
Use attachments only through asset:// followed by the zero-based attachment index.${productLine}

IMAGE SCOPE FOR THIS GENERATION (${PRODUCT_AREA_IMAGE_POLICY} / ${BRAND_IMAGE_POLICY})
- Product area: the section holding data-cafe24-slot="product-list" carries no img element and no background photography. Cafe24 product image bindings own every product photo.
- Brand and mood sections: only the ${(input.assetUrls ?? []).length} attachment(s) of this request through asset://N, imagery you compose inside this response, or a fresh stock URL selected for this brief.
- Stored images from any other project or any earlier request are out of scope even when they belong to the same account. Do not output such an address.

Before coding, make coupled decisions and record them concretely in designRationale and the existing architecture fields: headerVariant (split-utility | centered-brand | overlay-minimal), heroComposition (${heroChoices}), productLayout (grid-four | large-grid), section order and selection, typography scale, image treatment, spacing/density, and content composition. Each decision must follow this brand and would be recognizably wrong for a materially different brand. Do not merely recolor a generic storefront. Then author the complete HTML and CSS.${plan ? `\n\n${renderPagePlanContract(plan)}` : ""}`;
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
  plan?: PagePlan,
): SafetyViolation[] {
  const violations: SafetyViolation[] = [];
  // article은 카드/아이템 마크업으로도 쓰이므로 페이지 구성은 section 요소로만 셉니다.
  const sections = [...source.html.matchAll(/<(?:section)\b/gi)].length;

  if (plan) {
    if (source.architecture?.hero !== plan.hero.variant) {
      violations.push({ code: "PLAN_HERO_MISMATCH", message: `architecture.hero는 page plan의 hero variant "${plan.hero.variant}"를 그대로 기록해야 합니다.`, token: source.architecture?.hero });
    }
    if (source.architecture?.header !== plan.header) {
      violations.push({ code: "PLAN_HEADER_MISMATCH", message: `architecture.header는 page plan의 header 구조 "${plan.header}"를 그대로 기록해야 합니다.`, token: source.architecture?.header });
    }
    if (source.architecture?.productPresentation !== plan.productPresentation) {
      violations.push({ code: "PLAN_PRODUCT_MISMATCH", message: `architecture.productPresentation은 page plan의 진열 "${plan.productPresentation}"를 그대로 기록해야 합니다.`, token: source.architecture?.productPresentation });
    }
    /**
     * 모델이 architecture.sections 맨 앞에 hero를 함께 적는 것은 자연스러운 해석이라
     * 본문 비교 전에 걸러 냅니다. 이걸 위반으로 보면 페이지를 정확히 시공한 draft까지
     * 통째로 재생성하게 되어 생성 1건당 비용과 시간이 그대로 두 배가 됩니다.
     * 저장되는 값은 어차피 pagePlanSectionRefs(plan)로 정규화됩니다.
     */
    const rawRecorded = source.architecture?.sections ?? [];
    const recorded = rawRecorded[0]?.trim().startsWith("hero/") ? rawRecorded.slice(1) : rawRecorded;
    if (recorded.length < plan.sections.length) {
      violations.push({ code: "PLAN_SECTIONS_MISSING", message: `architecture.sections에는 page plan의 섹션 ${plan.sections.length}개가 순서대로 기록되어야 합니다.`, token: String(recorded.length) });
    } else {
      for (const [index, planned] of plan.sections.entries()) {
        const ref = `${planned.type}/${planned.variant}`;
        if (!recorded[index]?.includes(ref)) {
          violations.push({ code: "PLAN_SECTION_ORDER", message: `architecture.sections[${index}]는 page plan의 "${ref}"를 그 자리에 기록해야 합니다.`, token: recorded[index]?.slice(0, 80) });
          break;
        }
      }
    }
    // hero + 계획된 본문 섹션이 실제 마크업에도 있어야 합니다(한 칸의 오차만 허용).
    if (sections < plan.sections.length) {
      violations.push({ code: "PLAN_SECTION_COUNT", message: `page plan은 hero 외에 ${plan.sections.length}개의 본문 섹션을 요구합니다. 실제 section 요소가 ${sections}개뿐입니다.`, token: String(sections) });
    }
  }

  const slots = [...source.html.matchAll(/data-cafe24-slot\s*=\s*["']product-list["']/gi)].length;

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
