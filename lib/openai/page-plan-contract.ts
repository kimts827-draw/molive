/**
 * Page Plan(1단계) 프롬프트 계약입니다.
 * server 전용 SDK와 분리해 두어 테스트와 클라이언트 도구가 그대로 읽을 수 있습니다.
 */

import { renderSectionCatalog } from "../design-library/section-registry.ts";
import { INDUSTRY_IDS, industryProfile, inferIndustry } from "../design-library/industry.ts";
import { HEADER_STRUCTURES, HERO_VARIANTS, PRODUCT_PRESENTATIONS } from "../design-library/variants.ts";

export type PagePlanInput = {
  prompt: string;
  brandName?: string;
  colors?: string[];
  assetRoles?: string[];
  assetUrls?: string[];
  /** 대비 경로를 결정적으로 만들 때만 씁니다(테스트/스크립트용). */
  seed?: number;
};

const heroCatalog = Object.values(HERO_VARIANTS).map((variant) => `- ${variant.id}: ${variant.spec}`).join("\n");
const headerCatalog = Object.values(HEADER_STRUCTURES).map((structure) => `- ${structure.id}: ${structure.spec}`).join("\n");
const presentationCatalog = Object.values(PRODUCT_PRESENTATIONS).map((presentation) => `- ${presentation.id} (${presentation.columns}): ${presentation.spec}`).join("\n");

export const PAGE_PLAN_SYSTEM_PROMPT = `You are the store architect for a Korean Cafe24 storefront builder.

Your only job in this step is the PAGE COMPOSITION: read the merchant's brief and decide what this specific storefront's home page is made of. A later step writes the actual HTML/CSS from your plan, so this plan is the single place where page structure is decided.

WHAT YOU MUST READ OUT OF THE BRIEF
- productCategory: what this shop actually sells, in the merchant's own terms. If the brief names the products (예: 한우 선물세트, 차량용 방향제, 원목 식탁), keep those words. Never generalise them into a bigger category and never substitute a neighbouring category (a premium food brief is not automatically desserts or bakery).
- productExamples: up to 8 concrete, photographable products a shopper would see in THIS shop. Derive them from the brief, not from a generic idea of the industry.
- industry: the closest key from the fixed list. This key is only used to look up internal weights.
- industryLabel: a short human label for this shop's category in Korean (예: "프리미엄 정육", "차량용 디테일링 용품"). Be specific; this label is reused for photography direction.
- audience, brandPosition, mood, emphasis: what the brief actually asks for.

HOW TO COMPOSE THE PAGE
- Header and the Cafe24 legal footer are fixed components you do not design. You compose only the body between them.
- Choose 3 to 9 body sections from the section registry. Pick only the sections THIS brand needs and leave the rest out. A page that uses every section type is a failure.
- Exactly one section must be type "featuredProducts". That is the single verified Cafe24 product slot. Put it where this brand's buying journey wants it: a fast retail shop earns it right after the hero, a premium narrative brand can earn attention first.
- Order the sections by this brand's argument, not by habit. Do not reproduce a generic hero → category → products → story → CTA order unless that order is genuinely the right one for this brief.
- Two materially different briefs must produce different section sets, different counts, and different orders. If your plan would look the same for a fashion brand and an auto-parts shop, it is wrong.
- Give every section a variant from that section type's variant list, plus alignment, mediaPosition, density and tone. Use these axes to make repeated section types look different, and alternate tone so adjacent sections do not merge into one block.
- Respect each section type's media rule: a "none" media section has no photography, a "required" media section must not use mediaPosition "none".
- intent must say, in Korean, why this brand needs this section. headline is a short Korean heading draft.

CONSTRAINTS
- Do not invent reviews, ratings, follower counts, awards, certifications, sales figures, discounts, prices, or delivery terms. Sections exist to hold such content only when it is generic and safe.
- Photography is generated or attached later. A section whose media is required will consume one image, so keep the total image demand sensible for a home page.
- Write Korean for industryLabel, productCategory, productExamples, audience, brandPosition, mood, emphasis, intent, headline and rationale. Keep the enum ids exactly as given in English.`;

export function buildPagePlanUserPrompt(input: PagePlanInput) {
  const guessed = inferIndustry(`${input.brandName ?? ""} ${input.prompt}`);
  const profile = industryProfile(guessed);
  return `Merchant brief: ${input.prompt}
Brand: ${input.brandName?.trim() || "Not specified"}
Explicit brand colors: ${(input.colors ?? []).join(", ") || "None"}
Attachment count: ${(input.assetUrls ?? []).length}${(input.assetRoles ?? []).length ? ` (roles: ${(input.assetRoles ?? []).join(", ")})` : ""}

industry keys: ${INDUSTRY_IDS.join(" | ")}
Keyword pre-scan suggests "${guessed}" (${profile.label}). Treat it as a hint only — if the brief says otherwise, override it.

HERO VARIANTS (pick exactly one)
${heroCatalog}

HEADER STRUCTURES (pick exactly one)
${headerCatalog}

PRODUCT PRESENTATIONS (pick exactly one; this styles the verified product cards)
${presentationCatalog}

SECTION REGISTRY (choose the body sections from here)
${renderSectionCatalog()}

Return the page composition for this specific storefront.`;
}

