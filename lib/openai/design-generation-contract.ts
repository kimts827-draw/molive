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

/**
 * 상품 슬롯을 감싸는 지면이 진열을 굶기는지 봅니다.
 *
 * 슬롯 안쪽은 전부 "부모의 100%" 기준이라 프레임이 좁으면 썸네일과 글자까지 같이 줄어듭니다.
 * 렌더링 단계에서는 fixed-components의 슬롯 geometry 계약이 이미 되돌리지만, 그건 증상을 막는
 * 마지막 방어선이고 여기서는 AI가 애초에 그런 프레임을 짜지 않게 되돌려 보냅니다.
 *
 * 위반 하나가 생성 1건을 통째로 재시도시키므로 오탐이 없는 두 가지만 봅니다.
 * 1) 슬롯의 조상에 걸린 좁은 절대 measure(720px 미만)
 * 2) 슬롯 바로 위 부모의 다중 트랙 grid — 슬롯이 그 중 한 칸에 갇힙니다
 * 둘 다 @media 안의 선언은 보지 않습니다. 좁은 화면에서 좁아지는 것은 정상입니다.
 */
const PRODUCT_FRAME_MIN_WIDTH = 720;

/** at-rule 블록을 통째로 지워 무조건 적용되는 규칙만 남깁니다. */
function stripAtRuleBlocks(css: string) {
  let output = "";
  let cursor = 0;
  while (cursor < css.length) {
    const at = css.indexOf("@", cursor);
    if (at < 0) return output + css.slice(cursor);
    const open = css.indexOf("{", at);
    if (open < 0) return output + css.slice(cursor, at);
    output += css.slice(cursor, at);
    let depth = 1;
    let index = open + 1;
    while (index < css.length && depth > 0) {
      if (css[index] === "{") depth += 1;
      else if (css[index] === "}") depth -= 1;
      index += 1;
    }
    cursor = index;
  }
  return output;
}

/** 이 요소를 가리킬 수 있는 셀렉터 토큰입니다. AI CSS가 실제로 쓰는 class·id·편집 ID만 봅니다. */
function elementTokens(attributes: string) {
  const tokens = new Set<string>();
  for (const value of attributes.match(/class\s*=\s*["']([^"']*)["']/i)?.[1]?.split(/\s+/) ?? []) if (value) tokens.add(`.${value}`);
  const id = attributes.match(/\bid\s*=\s*["']([^"']*)["']/i)?.[1];
  if (id) tokens.add(`#${id}`);
  const nodeId = attributes.match(/data-moire-id\s*=\s*["']([^"']*)["']/i)?.[1];
  if (nodeId) tokens.add(`[data-moire-id="${nodeId}"]`);
  return tokens;
}

/**
 * 슬롯 자신과 그 조상들의 class/id 토큰입니다.
 * frame은 바깥에서 안쪽 순서이고 마지막 원소가 슬롯 자신, parent는 그 바로 위입니다.
 */
function productSlotFrameTokens(html: string) {
  const slotAt = html.search(/<[a-z][a-z0-9-]*\b[^>]*data-cafe24-slot\s*=\s*["']product-list["']/i);
  if (slotAt < 0) return { frame: [] as Array<Set<string>>, parent: undefined as Set<string> | undefined };
  const stack: Array<{ tag: string; tokens: Set<string> }> = [];
  const tagPattern = /<(\/?)([a-z][a-z0-9-]*)\b([^>]*)>/gi;
  for (const match of html.slice(0, slotAt).matchAll(tagPattern)) {
    const [raw, closing, tag, attributes] = match;
    if (closing) {
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        if (stack[index].tag === tag.toLowerCase()) { stack.length = index; break; }
      }
      continue;
    }
    if (raw.endsWith("/>") || /^(?:img|br|hr|input|meta|link|source|track|area|base|col|embed|param|wbr)$/i.test(tag)) continue;
    stack.push({ tag: tag.toLowerCase(), tokens: elementTokens(attributes) });
  }
  const parent = stack[stack.length - 1]?.tokens;
  const slotAttributes = html.slice(slotAt).match(/^<[a-z][a-z0-9-]*\b([^>]*)>/i)?.[1] ?? "";
  return { frame: [...stack.map((entry) => entry.tokens), elementTokens(slotAttributes)], parent };
}

/** 셀렉터가 가리키는 대상(마지막 compound)의 토큰입니다. 상태·가상요소가 붙으면 보지 않습니다. */
function selectorSubjectTokens(selector: string) {
  const subject = selector.trim().split(/[\s>+~]+/).filter(Boolean).pop() ?? "";
  if (!subject || /::|:/.test(subject)) return null;
  const tokens = subject.match(/\[data-moire-id\s*=\s*["'][^"']*["']\]|[.#][A-Za-z_-][\w-]*/g);
  return tokens?.length ? tokens.map((token) => token.replace(/\[data-moire-id\s*=\s*["']([^"']*)["']\]/, '[data-moire-id="$1"]')) : null;
}

/** 값이 좁은 절대 measure인지 봅니다. bare length와 min()/clamp()의 마지막 인자만 봅니다. */
function narrowMeasure(value: string) {
  const trimmed = value.trim();
  const functional = trimmed.match(/^(?:min|clamp)\(([\s\S]*)\)$/i);
  const candidate = functional ? functional[1].split(",").pop()?.trim() ?? "" : trimmed;
  const length = candidate.match(/^(\d+(?:\.\d+)?)(px|rem)$/i);
  if (!length) return null;
  const pixels = Number(length[1]) * (length[2].toLowerCase() === "rem" ? 16 : 1);
  return pixels > 0 && pixels < PRODUCT_FRAME_MIN_WIDTH ? trimmed : null;
}

/** grid-template-columns가 두 칸 이상인지 봅니다. repeat(1,…)과 단일 트랙은 넘어갑니다. */
function multiTrackGrid(body: string) {
  if (/grid-auto-flow\s*:\s*column/i.test(body)) return "grid-auto-flow:column";
  const columns = body.match(/grid-template-columns\s*:\s*([^;]+)/i)?.[1]?.trim();
  if (!columns) return null;
  const repeat = columns.match(/^repeat\(\s*([^,]+),/i)?.[1]?.trim();
  if (repeat) return repeat === "1" ? null : `grid-template-columns:${columns}`;
  const tracks = columns.split(/\s+/).filter(Boolean);
  return tracks.length > 1 ? `grid-template-columns:${columns}` : null;
}

function productFrameViolations(html: string, css: string): SafetyViolation[] {
  const { frame, parent } = productSlotFrameTokens(html);
  if (!frame.length) return [];
  const violations: SafetyViolation[] = [];
  for (const rule of stripAtRuleBlocks(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selectorList, body] = rule;
    for (const selector of selectorList.split(",")) {
      const subject = selectorSubjectTokens(selector);
      if (!subject) continue;
      const target = frame.find((tokens) => subject.every((token) => tokens.has(token)));
      if (!target) continue;
      for (const declaration of body.matchAll(/(?:^|;)\s*(max-width|width)\s*:\s*([^;]+)/gi)) {
        const measure = narrowMeasure(declaration[2]);
        if (!measure) continue;
        violations.push({
          code: "PRODUCT_FRAME_NARROW",
          message: "상품 슬롯을 감싸는 지면은 좁은 measure로 묶을 수 없습니다. 슬롯 안쪽은 부모 폭의 100%라 진열 전체가 같이 줄어듭니다.",
          token: `${selector.trim()} { ${declaration[1]}: ${measure} }`,
        });
        break;
      }
      if (target === parent) {
        const tracks = multiTrackGrid(body);
        if (tracks) {
          violations.push({
            code: "PRODUCT_FRAME_GRID_TRACK",
            message: "상품 슬롯의 부모를 다중 컬럼 grid로 만들 수 없습니다. 슬롯이 트랙 한 칸에 갇혀 진열이 그 폭으로 줄어듭니다.",
            token: `${selector.trim()} { ${tracks} }`,
          });
        }
      }
    }
  }
  return violations;
}

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
  if (slots > 0) violations.push(...productFrameViolations(source.html, source.css));
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
