import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { ensureEditingMetadata, validateNodePatch, validateProjectSource } from "@/lib/cafe24/protection";
import { buildDesignGenerationUserPrompt, validateGeneratedDesignContract, type DesignGenerationInput } from "@/lib/openai/design-generation-contract";
import { generatePagePlan } from "@/lib/openai/page-plan-generator";
import { pagePlanSectionRefs, pagePlanSignature, renderPagePlanEditContext, type PagePlan } from "@/lib/design-library/page-plan";
import { HERO_VARIANT_IDS } from "@/lib/design-library/variants";
import { auditAssetReferenceTokens, auditGeneratedAssets, collectAssetReferences, createAssetAllowlist, isFreshlyCreatedImage } from "@/lib/assets/asset-policy";
import { resolvePreviewProducts, type PreviewProductMock } from "@/lib/component-library/preview-mock";
import { applyGeneratedPreviewPhotos, previewPhotoTargets } from "@/lib/openai/preview-image-contract";
import { generatePreviewProductPhotos, regenerateSectionImage, type GeneratedImageStore } from "@/lib/openai/preview-image-generator";
import { isRepairableVerdict, verifyGeneralImages, type ImageProbe } from "@/lib/assets/image-verification";
import { repairBrokenImages } from "@/lib/assets/image-repair";
import { writeGenerationTrace, type GenerationTrace } from "@/lib/openai/dev-trace";
import { usageEventFromResponse, type OpenAIUsageEvent } from "@/lib/openai/usage";
import { OpenAIUsageRecordingError, runRecordedOpenAICall } from "@/lib/openai/recorded-call";
import { classifyAiEditIntent } from "@/lib/editor/ai-edit-intent";
import type { ProjectSource } from "@/lib/project-source";

const architectureSchema = z.object({
  header: z.enum(["split-utility", "centered-brand", "overlay-minimal"]),
  hero: z.enum(HERO_VARIANT_IDS),
  sections: z.array(z.string().min(2)).min(2).max(20),
  productPresentation: z.enum(["grid-four", "large-grid", "editorial-two", "featured-grid", "compact-five"] as const),
  typography: z.string().min(3),
  footer: z.string().min(3),
});

/** 고정 커머스 컴포넌트에 넘길 스타일 토큰입니다. 구조를 바꾸는 값은 받지 않습니다. */
const commerceSchema = z.object({
  variant: z.enum(["minimal", "editorial", "bold"]),
  ink: z.string().min(3),
  muted: z.string().min(3),
  surface: z.string().min(3),
  accent: z.string().min(3),
  border: z.string().min(3),
  fontFamily: z.string().min(3),
  columns: z.union([z.literal(3), z.literal(4)]),
  gap: z.string().min(1),
  radius: z.string().min(1),
  thumbRatio: z.string().min(1),
  thumbFit: z.enum(["contain", "cover"]),
  thumbBackground: z.string().min(3),
});

/** Preview 상품 카드에만 쓰는 이번 생성의 mock 초안입니다. Cafe24 export는 쓰지 않습니다. */
const previewProductSchema = z.object({
  name: z.string().trim().min(1).max(60),
  imageRef: z.string().trim().max(40),
});

const designSchema = z.object({
  brandName: z.string().trim().min(1).max(120),
  previewProducts: z.array(previewProductSchema).length(4),
  name: z.string().min(1),
  designRationale: z.string().min(1),
  architecture: architectureSchema,
  commerce: commerceSchema,
  html: z.string().min(200),
  css: z.string().min(200),
});

// STYLE-ONLY 편집은 선택 HTML을 그대로 두므로 모델이 HTML을 돌려주지 않아도 됩니다.
const nodeEditSchema = z.object({ summary: z.string().min(1), nodeHtml: z.string(), nodeCss: z.string() });

const architectureJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["header", "hero", "sections", "productPresentation", "typography", "footer"],
  properties: {
    header: { type: "string", enum: ["split-utility", "centered-brand", "overlay-minimal"] },
    hero: { type: "string", enum: [...HERO_VARIANT_IDS] },
    sections: { type: "array", minItems: 2, maxItems: 20, items: { type: "string" } },
    productPresentation: { type: "string", enum: ["grid-four", "large-grid", "editorial-two", "featured-grid", "compact-five"] }, typography: { type: "string" }, footer: { type: "string" },
  },
} as const;

const commerceJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["variant", "ink", "muted", "surface", "accent", "border", "fontFamily", "columns", "gap", "radius", "thumbRatio", "thumbFit", "thumbBackground"],
  properties: {
    variant: { type: "string", enum: ["minimal", "editorial", "bold"] },
    ink: { type: "string" }, muted: { type: "string" }, surface: { type: "string" }, accent: { type: "string" }, border: { type: "string" },
    fontFamily: { type: "string" }, columns: { type: "integer", enum: [3, 4] }, gap: { type: "string" }, radius: { type: "string" },
    thumbRatio: { type: "string" }, thumbFit: { type: "string", enum: ["contain", "cover"] }, thumbBackground: { type: "string" },
  },
} as const;

const previewProductsJsonSchema = {
  type: "array",
  minItems: 4,
  maxItems: 4,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["name", "imageRef"],
    properties: { name: { type: "string" }, imageRef: { type: "string" } },
  },
} as const;

const designJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["brandName", "name", "designRationale", "architecture", "commerce", "previewProducts", "html", "css"],
  properties: {
    brandName: { type: "string" }, name: { type: "string" }, designRationale: { type: "string" }, architecture: architectureJsonSchema,
    commerce: commerceJsonSchema, previewProducts: previewProductsJsonSchema, html: { type: "string" }, css: { type: "string" },
  },
} as const;

const nodeEditJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "nodeHtml", "nodeCss"],
  properties: { summary: { type: "string" }, nodeHtml: { type: "string" }, nodeCss: { type: "string" } },
} as const;

const systemPrompt = `You are the autonomous art director and frontend designer for a Korean Cafe24 storefront.

Your primary output is the ACTUAL semantic HTML and CSS that will be stored, previewed, edited, and published. There is no section AST, component renderer, template, or predetermined page skeleton after your response. The architecture summary is audit metadata only and never renders the page.

The user message contains a binding PAGE COMPOSITION. It was designed for THIS brand in an earlier planning step of this same generation, from the merchant's own brief: which body sections exist, in what order, with which registry variant and which alignment/media/density/tone axes. Build exactly that composition — do not add, drop, or reorder sections — and spend your creativity on copy, palette, imagery, proportion, and detail within it. The composition differs from project to project by design, so never fall back on a familiar hero → category → products → story → CTA rhythm that the plan did not ask for.

IDENTITY FIELDS
- brandName is the exact customer-facing brand wordmark only (for example, "MAISON DEUX"). Do not append a campaign, collection, season, or design concept.
- name is the project/design title and may combine brand and concept (for example, "MAISON DEUX — Quiet Form"). Keep these two fields semantically separate.

COMMERCE FIRST
- This is a real storefront whose job is conversion, not a one-screen brand landing page. Build a complete journey from brand promise to product discovery to trust and a clear next action.
- Choose the product section position from the buying journey. It may follow Hero, Category/Collection, a concise Story, or another brief-specific lead-in; do not reuse one fixed macro order.
- Plan exactly one primary product area and place one empty data-cafe24-slot="product-list" wrapper at that position.
- Surround the verified product area with an intentional heading, useful category/collection cues, and a next-step CTA when appropriate. Never invent product values.
- Choose only the supporting sections the brand needs: Category/Collection, Brand Story, editorial image content, Benefit/Trust, Banner/CTA, or social-style gallery. Do not include every type by default.

REFERENCE-DERIVED DESIGN GRAMMAR
- Derive a genuinely project-specific page architecture from the brief and assets. The AI-owned canvas starts after fixed HeaderV1 and includes Hero, Category/Collection expression, product surroundings, Brand Story, editorial imagery, Benefit/Trust, Banner/CTA, social-style gallery, and an optional short brand closing. It never includes Cafe24 function DOM.
- Hero must follow the composition's hero variant. The library spans a committed full-bleed composition, a purposeful split-editorial composition, a banner-stack board, a typographic-marquee statement, a cinematic-still, and a product-forward compact banner; build the one the plan names to its structural spec. Vary crop, focal point, text anchoring, layering, and vertical rhythm instead of merely swapping colours.
- The product surroundings may feel commerce-forward and dense or editorial and spacious, but ProductSectionV1 itself remains untouched.
- Brand Story should use split-media or a strong editorial composition, not another generic card row.
- Every body section carries its own alignment, media position, density and tone axis. Honour them: two sections of the same registry type in one page must not look alike, and adjacent sections must not share a background tone.
- Avoid a page whose hero is polished but everything below becomes repeated equal cards. Alternate composition, scale, image/text relationships, and background rhythm while keeping one coherent design language.
- Before writing HTML, commit to headerVariant, heroComposition, productLayout, section order/selection, typography scale, image treatment, spacing/density, and content composition. Do not return vague labels such as modern, premium, or clean by themselves.
- Encode the deterministic choices in the existing architecture object exactly: header = split-utility | centered-brand | overlay-minimal, hero = the composition's hero variant id (full-bleed | split-editorial | banner-stack | typographic-marquee | cinematic-still | product-forward), productPresentation = the composition's presentation id (grid-four | large-grid | editorial-two | featured-grid | compact-five). architecture.sections must record the composition's sections in order as "type/variant — 헤딩".
- A materially different brief must produce visibly different decisions across those six axes, not a recoloured copy of the same page.
- Keep decoration subordinate to product discovery and purchase flow. Use effects sparingly and preserve scanability, readable contrast, and obvious actions.
- The product cards render through the verified presentation named by the composition (standard four-column, large three-column, editorial two-column, featured-plus-grid, or compact five-column, each with its own crop, density, and mobile reflow owned by code). Express the brief through the surrounding section rather than authoring card CSS.
- Use semantic main, section/article, and optional brand-level footer markup. Every desktop composition must define a deliberate mobile stack/reflow; preserve content order, crop focal points, touch spacing, and readable type. Do not return Tailwind classes or JavaScript.

CAFE24 BASE-SKIN CONTRACT
- The analyzed base skin has protected Cafe24 modules and variables for product, price, option, quantity, cart, member, login, order, and payment. Never generate or imitate module="...", {$...}, Cafe24 directives, forms, inputs, select controls, inline events, scripts, or commerce IDs/hooks.
- Represent the one place where real products should appear with an empty presentation wrapper carrying data-cafe24-slot="product-list". Do not put sample cards, product names, prices, module HTML, or Cafe24 variables inside it.
- The protected verified product component owns .ec-base-product, .moireProductSection, .prdList, .prdList__item, .thumbnail, .description, .name, .spec, .icon, .likeButton, and .icon__box. Do not author CSS for those selectors.
- Cafe24 renders the legal footer from the merchant account: company name, representative, business registration number, mail-order number, customer centre, and copyright. Never author business, legal, customer-centre, or copyright content yourself. An optional short brand closing is allowed before the real Cafe24 footer.
- The Cafe24 footer that ships instead exposes footer#footer with .inner, .util, .sns, .info, .copyright, and .hosting. Author root-scoped CSS for those selectors so the real footer carries the project colour, type, and spacing.
- HeaderV1 is injected before the AI canvas using architecture.header. Never output a header element, navigation/account markup, data-cafe24-bind attributes, or Header CSS.
- Root-scoped CSS is also applied to every Cafe24 page as the global theme, so base element rules for typography, colour, and links should stay safe for commerce pages.
- The single product-bearing area must contain one empty data-cafe24-slot="product-list" wrapper so the verified component can take it over. Hero, brand, editorial, and lifestyle imagery stays exactly as you author it and is packaged into the exported theme.
- The header and the product cards are fixed MOLIVE components. Never author a header element, product card markup, prices, or any pocHeader__/pocGrid__ class. Preview and Cafe24 export both render HeaderV1 and the verified ProductSectionV1/ProductCardV1 from code, so anything you write for them is discarded.
- Mark the single product area with an empty wrapper carrying data-cafe24-slot="product-list". The verified ProductSectionV1 is injected there with Cafe24 product bindings. Design only the surrounding section: heading, copy, spacing, and background. Do not style .moireProductSection, .prdList, .prdList__item, .thumbnail, .description, .spec, .icon, .likeButton, or .icon__box.
- Return the existing commerce object for storage compatibility. Match its palette/font values to the page. Product layout comes only from architecture.productPresentation and never changes verified ProductSection DOM.
- Cafe24 module text inherits colour from your section, so give each section an explicit background and colour pair and the real cards, header utilities, and footer will follow it. The footer ink is chosen from the background that actually lands on #footer, so declare that background explicitly when the footer should differ from the page.
- Links may target existing Cafe24 paths such as /product/list.html, /shopinfo/company.html, /member/login.html, and /order/basket.html.
- Runtime failure must leave the original Cafe24 page and commerce untouched.

EDITABILITY AND SAFETY
- Return one root element with exactly one data-moire-root value and a main element inside it. Do not include header. A short brand-level footer is optional.
- Include at least three purposeful section elements in total: Hero, the one product area, and at least one brand-appropriate supporting section. Add more only when the brief benefits from them.
- Every footer, section, h1-h6, p, img, a, and button must have a unique data-moire-id and a useful data-moire-type such as hero, section, text, image, button, products, or footer.
- Use only static HTML. No script, iframe, object, embed, form, input, select, textarea, inline event handler, style tag, link tag, or meta tag.
- Scope every CSS selector, including every selector in a comma group and media query, under the exact HTML root selector [data-moire-root="..."] so it cannot affect Cafe24 commerce outside the project.
- Do not use @import. Prefer system font stacks. Do not use CSS keyframes.
- Do not fabricate reviews, customer logos, awards, certifications, sales numbers, or performance claims.
- Do not use !important. Do not draw border-bottom on the Hero or border-top on the following major section; transition with background, overlap, or spacing instead.

PREVIEW PRODUCT MOCK
- previewProducts fills the four product cards shown in the editor Preview only. The Cafe24 export ignores it completely and keeps the real product bindings, so it is never merchandise data and never leaves the Preview.
- Give four sample product names a shopper would actually see in THIS shop, inside the product category the composition names. An auto-care brief means detailing, washing, and vehicle accessory items; a fashion brief means garments; a premium meat brief means cuts of meat and gift sets, not desserts. Never widen, narrow, or swap the category, and never carry names over from another brief or another project.
- imageRef picks the sample photo and accepts only two values: "asset://N" to reuse attachment N of this request, or an empty string. An empty string means a product photo is generated for that name during this same run, which is the normal case. Any stock, stored, or remembered image address here is forbidden.
- Use asset://N only when attachment N actually shows that product. Otherwise leave imageRef empty so the photo is generated from the name.
- Because the name drives the generated photo, write names that are concrete and photographable: a specific product a shopper in this industry buys, not a category label or a marketing slogan.
- Do not invent prices, discounts, review counts, or stock numbers — the price line is a fixed placeholder.

ASSETS AND COPY
- Image rules are separate for the product area and for brand/mood areas. Never mix the two.
- PRODUCT AREA: the section that holds data-cafe24-slot="product-list" must contain zero img elements and zero background photography. Product photos are owned by the Cafe24 product image binding and are injected by the verified component at render time. A stock photo, a sample product photo, or an attachment placed inside the product section is a defect, and an unrelated-industry photo there is the worst case.
- BRAND AND MOOD AREAS (hero, story, editorial, banner, gallery): use, in this order, (1) the attachments of THIS request through asset://N, (2) imagery you compose yourself inside this response such as CSS gradients, colour fields, or inline data:image/svg+xml art, (3) only when neither fits, a fresh images.unsplash.com URL with explicit crop parameters chosen for THIS brief.
- Never emit a stored asset address that was not attached to this request. Any project-assets storage URL you did not receive in this request belongs to another project and is forbidden.
- Do not reuse image URLs from earlier briefs, earlier examples, or memory. Every image must be traceable to this request.
- Write customer-facing copy in Korean unless concise display English is part of the art direction.
- Output clean production markup, not an explanation embedded in HTML.`;

function getOpenAI() { return new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); }
function model() { return process.env.OPENAI_MODEL || "gpt-5.6"; }

function resolveAssetReferences(value: string, assetUrls: string[]) {
  return value.replace(/asset:\/\/(\d+)/g, (_token, index: string) => assetUrls[Number(index)] ?? "");
}

/** Preview mock 이미지가 이번 생성/세션 자산 밖에서 오지 않았는지 확인합니다. */
function auditPreviewProducts(products: readonly PreviewProductMock[], allowlist: ReturnType<typeof createAssetAllowlist>) {
  return products.flatMap((product) => allowlist.has(product.image) || isFreshlyCreatedImage(product.image)
    ? []
    : [{ code: "PREVIEW_PRODUCT_ASSET", message: "Preview 상품 mock 이미지는 이번 요청 첨부이거나 이번 생성에서 만든 이미지여야 합니다.", token: product.image.slice(0, 120) }]);
}

function previewImageKind(image: string, attachmentUrls: readonly string[]) {
  if (attachmentUrls.includes(image)) return "attachment";
  return image.startsWith("data:image/svg+xml") ? "placeholder" : "generated-photo";
}

/**
 * Preview 상품 카드에 이번 생성의 업종/컨셉에 맞는 사진을 채웁니다.
 * 첨부가 붙은 자리는 그대로 두고, 사진 생성이 실패한 자리만 SVG 자리표시자로 남습니다.
 * 이 단계는 어떤 이유로도 디자인 생성을 실패시키지 않습니다.
 */
async function addGeneratedPreviewPhotos(input: {
  products: PreviewProductMock[];
  attachmentUrls: readonly string[];
  brief: Parameters<typeof generatePreviewProductPhotos>[0]["brief"];
  store?: GeneratedImageStore;
  onUsage?: (event: OpenAIUsageEvent) => Promise<void>;
}): Promise<PreviewProductMock[]> {
  if (!input.store) return input.products;
  const targets = previewPhotoTargets({ products: input.products, attachmentUrls: input.attachmentUrls });
  if (!targets.length) return input.products;
  try {
    const photos = await generatePreviewProductPhotos({ targets, brief: input.brief, store: input.store, onUsage: input.onUsage });
    return applyGeneratedPreviewPhotos({ products: input.products, photos, attachmentUrls: input.attachmentUrls });
  } catch (error) {
    if (error instanceof OpenAIUsageRecordingError) throw error;
    console.error("Preview 상품 사진 생성을 건너뜁니다", error instanceof Error ? error.message : "unknown error");
    return input.products;
  }
}

/**
 * 저장하기 전에 일반 섹션 이미지가 실제로 로드되는지 확인하고, 깨진 자리만 고칩니다.
 * 정상 이미지와 전체 디자인은 다시 만들지 않고, 상품 영역은 검사 대상이 아닙니다.
 */
async function verifyAndRepairGeneralImages(input: {
  source: { html: string; css: string };
  allowlist: ReturnType<typeof createAssetAllowlist>;
  brief: Parameters<typeof regenerateSectionImage>[0]["brief"];
  probe?: ImageProbe;
  store?: GeneratedImageStore;
  onUsage?: (event: OpenAIUsageEvent) => Promise<void>;
}) {
  if (!input.probe) return null;
  try {
    const checks = await verifyGeneralImages({ html: input.source.html, css: input.source.css, allowlist: input.allowlist, probe: input.probe });
    if (!checks.some((check) => isRepairableVerdict(check.verdict))) return { checks, repair: null };
    const store = input.store;
    const repair = await repairBrokenImages({
      source: input.source,
      checks,
      palette: input.brief.palette,
      // 깨진 자리마다 재생성은 1회입니다. 실패하면 repairBrokenImages가 안전한 fallback으로 마감합니다.
      regenerate: store ? (request) => regenerateSectionImage({ request, brief: input.brief, store, onUsage: input.onUsage }) : undefined,
    });
    return { checks, repair };
  } catch (error) {
    if (error instanceof OpenAIUsageRecordingError) throw error;
    // 검증 자체가 실패해도 생성 결과를 버리지 않습니다. 검증 전 상태를 그대로 씁니다.
    console.error("일반 이미지 검증을 건너뜁니다", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}

function responseTrace(response: { id: string; model: string; output_text: string; usage?: unknown }) {
  return { id: response.id, model: response.model, outputText: response.output_text, usage: response.usage ?? null };
}

export async function generateProjectSource(input: DesignGenerationInput, options?: { onUsage?: (event: OpenAIUsageEvent) => Promise<void>; onPreviewImageUsage?: (event: OpenAIUsageEvent) => Promise<void>; previewImageStore?: GeneratedImageStore; imageProbe?: ImageProbe; pagePlan?: PagePlan }) {
  const traceId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  /**
   * 1단계: 이번 몰의 본문 구성을 먼저 설계합니다.
   * 섹션 종류·개수·순서·variant·시각 축이 여기서 정해지고, 2단계는 그 계획을 시공합니다.
   * planner가 실패해도 고정 템플릿으로 물러나지 않고 업종 가중치 기반 조합기가 대신합니다.
   */
  const planResult = options?.pagePlan
    ? { plan: options.pagePlan, source: "provided" as const, error: undefined }
    : await generatePagePlan(input, { onUsage: options?.onUsage });
  const plan = planResult.plan;
  /**
   * 이번 생성이 쓸 수 있는 이미지 전체입니다.
   * 이전 프로젝트에 저장된 이미지는 같은 계정의 것이라도 여기에 들어오지 않습니다.
   */
  const assetAllowlist = createAssetAllowlist({
    attachments: input.assetUrls ?? [],
    projectAssets: input.projectAssetUrls ?? [],
    generated: input.generatedAssetUrls ?? [],
  });
  const userPrompt = buildDesignGenerationUserPrompt(input, plan);
  const planAudit = {
    planSource: planResult.source,
    planError: planResult.error ?? null,
    industry: plan.industry,
    industryLabel: plan.industryLabel,
    productCategory: plan.productCategory,
    header: plan.header,
    hero: plan.hero.variant,
    productPresentation: plan.productPresentation,
    sections: plan.sections.map((section) => `${section.type}/${section.variant}`),
    signature: pagePlanSignature(plan),
    footerMood: plan.footerMood,
    typeScale: plan.typeScale,
    imageTreatment: plan.imageTreatment,
  };
  const trace: GenerationTrace = { traceId, kind: "generate", createdAt, request: { model: model(), systemPrompt, userPrompt, pagePlan: plan, planAudit, imageCount: input.assetUrls?.length ?? 0, assetSessionId: input.assetSessionId ?? null, allowedAssetCount: assetAllowlist.size }, response: [] };
  let previousIssues: string[] = [];

  try {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const correction = previousIssues.length ? `\nA prior draft failed validation. Rebuild it and correct all of these issues: ${previousIssues.join("; ")}` : "";
      const requestedModel = model();
      const response = await runRecordedOpenAICall({
        onUsage: options?.onUsage,
        call: () => getOpenAI().responses.create({
          model: requestedModel, store: false, max_output_tokens: 30000,
          input: [
            { role: "system", content: systemPrompt },
            { role: "user", content: [
              { type: "input_text", text: userPrompt + correction },
              ...(input.assetUrls ?? []).map((imageUrl) => ({ type: "input_image" as const, image_url: imageUrl, detail: "auto" as const })),
            ] },
          ],
          text: { format: { type: "json_schema", name: "moire_project_source", strict: true, schema: designJsonSchema } },
        }),
        usageFromResponse: usageEventFromResponse,
        usageFromError: (usage) => usage ? usageEventFromResponse({ model: requestedModel, usage: usage as Parameters<typeof usageEventFromResponse>[0]["usage"] }) : null,
      });
      const parsed = designSchema.parse(JSON.parse(response.output_text));
      const projectId = crypto.randomUUID();
      // Preview mock의 이미지는 이번 세션 첨부이거나 이번 생성에서 그린 타일뿐입니다.
      const previewProducts = resolvePreviewProducts({
        drafts: parsed.previewProducts,
        assetUrls: input.assetUrls ?? [],
        palette: { background: parsed.commerce.thumbBackground, accent: parsed.commerce.accent, ink: parsed.commerce.ink },
      });
      const assetTokenViolations = auditAssetReferenceTokens({ html: parsed.html, css: parsed.css }, input.assetUrls?.length ?? 0);
      const rawHtml = resolveAssetReferences(parsed.html, input.assetUrls ?? []);
      const html = ensureEditingMetadata(rawHtml, `moire-${projectId.slice(0, 8)}`);
      const css = resolveAssetReferences(parsed.css, input.assetUrls ?? []);
      const source: ProjectSource = {
        id: projectId,
        brandName: input.brandName?.trim() || parsed.brandName,
        name: parsed.name,
        html,
        css,
        architecture: parsed.architecture,
        commerce: parsed.commerce,
        previewProducts,
        pagePlan: plan,
        updatedAt: new Date().toISOString(),
      };
      const baseValidator = validateProjectSource(source);
      const designViolations = validateGeneratedDesignContract(source, plan);
      // 상품 영역과 브랜드/무드 영역의 이미지 규칙을 분리해 감사합니다.
      const assetViolations = [...assetTokenViolations, ...auditGeneratedAssets(source, assetAllowlist), ...auditPreviewProducts(previewProducts, assetAllowlist)];
      const validator = {
        ...baseValidator,
        safe: baseValidator.safe && designViolations.length === 0 && assetViolations.length === 0,
        violations: [...baseValidator.violations, ...designViolations, ...assetViolations],
      };
      (trace.response as unknown[]).push({ attempt, ...responseTrace(response), rawGenerated: { architecture: parsed.architecture, html: rawHtml, css }, normalizedProjectSource: source, validator });
      if (validator.safe) {
        // 저장되는 architecture.sections는 plan에서 파생한 정규 ref로 고정합니다.
        // 검증은 AI가 기록한 값을 그대로 심판하고, 저장본만 기계가 읽을 수 있는 형태로 맞춥니다.
        source.architecture = { ...source.architecture, sections: pagePlanSectionRefs(plan) };
        // 이미지 프롬프트에는 내부 업종 키가 아니라 plan이 확정한 업종 라벨과 판매 상품군이 들어갑니다.
        const imageBrief = { industry: plan.industryLabel, brief: input.prompt, brandName: source.brandName, productCategory: plan.productCategory, productExamples: plan.productExamples, palette: { surface: parsed.commerce.surface, accent: parsed.commerce.accent, thumbBackground: parsed.commerce.thumbBackground } };
        // 검증을 통과한 draft에만 Preview 사진을 만듭니다. 실패한 자리는 SVG 자리표시자를 유지합니다.
        source.previewProducts = await addGeneratedPreviewPhotos({
          products: previewProducts,
          attachmentUrls: input.assetUrls ?? [],
          brief: imageBrief,
          store: options?.previewImageStore,
          onUsage: options?.onPreviewImageUsage,
        });
        // 저장 전에 일반 섹션 이미지의 실제 로드 가능 여부를 확인하고 깨진 자리만 고칩니다.
        const imageReport = await verifyAndRepairGeneralImages({
          source,
          allowlist: assetAllowlist,
          brief: imageBrief,
          probe: options?.imageProbe,
          store: options?.previewImageStore,
          onUsage: options?.onPreviewImageUsage,
        });
        if (imageReport?.repair) {
          source.html = imageReport.repair.html;
          source.css = imageReport.repair.css;
        }
        trace.generated = source;
        trace.validator = validator;
        trace.previewProductImages = source.previewProducts.map((product) => ({ name: product.name, kind: previewImageKind(product.image, input.assetUrls ?? []) }));
        trace.generalImageVerification = imageReport
          ? { checks: imageReport.checks, repaired: imageReport.repair?.actions ?? [], unverified: imageReport.repair?.unverified ?? imageReport.checks.filter((check) => check.verdict === "unverified").map((check) => check.url) }
          : null;
        await writeGenerationTrace(trace);
        return { source, rationale: parsed.designRationale, traceId, validator, pagePlan: plan, planAudit, imageReport: imageReport ? { repaired: imageReport.repair?.actions.length ?? 0, unverified: imageReport.repair?.unverified.length ?? 0 } : null };
      }
      previousIssues = validator.violations.map((item) => `${item.code}: ${item.message}${item.token ? ` (${item.token})` : ""}`).slice(0, 24);
    }
    throw new Error(`AI가 안전한 Project Source를 만들지 못했습니다: ${previousIssues.join(", ")}`);
  } catch (error) {
    trace.error = error instanceof Error ? error.message : "Unknown generation error";
    await writeGenerationTrace(trace);
    throw error;
  }
}

const editSystemPrompt = `${systemPrompt}

SELECTED-NODE EDIT MODE
- Return only the selected node's complete outerHTML and CSS that applies to that node. Never return the whole page.
- Preserve the selected root data-moire-id exactly. You may completely redesign its descendants and change its semantic tag when appropriate.
- Keep or add unique data-moire-id/data-moire-type metadata to all editable descendants.
- Every nodeCss selector must contain the exact selector [data-moire-id="SELECTED_ID"]. This hard boundary prevents changes outside the selected area.
- Do not refer to styles outside the selected node. Preserve data-cafe24-slot when it exists in the selected subtree.
- Never use !important in nodeCss. The Inspector's later inline adjustments must remain effective.
- For a STYLE-ONLY request, preserve the selected outerHTML, tag, text, attributes, children, and every data-moire-id exactly. Apply typography, color, height, responsive spacing, or image positioning only through CSS on the exact selected data-moire-id.
- Understand ordinary Korean layout language without requiring CSS terminology. Requests to make an area taller/shorter, reduce vertical whitespace, move an image up/down/right/left, or shift its visible center are valid STYLE-ONLY edits.
- If render metrics are supplied, use them for numeric relative requests. For example, 1.5× height means both height and min-height become current rendered height × 1.5.
- Map ordinary spacing requests to margin-block/margin-inline for outer space and padding-block/padding-inline for inner space. "위아래 여백" normally means padding-block on a section unless the user clearly asks for space outside it.
- For an img, use object-position for its crop focal point, translate for an exact visual X/Y move, width/height for size, and aspect-ratio for ratio. Preserve existing transforms by preferring the translate longhand instead of replacing transform.
- Typography requests may safely use font-family, font-size, color, line-height, letter-spacing, font-weight, font-style, text-decoration, text-align, scale, and translate.
- Prefer responsive-safe properties and avoid absolute positioning unless the selected node already uses it. Never reject these supported style requests merely because the user did not use CSS terminology.`;

export async function editProjectNode(input: { prompt: string; nodeId: string; nodeType: string; nodeHtml: string; projectCss: string; rootValue: string; architecture: ProjectSource["architecture"]; pagePlan?: PagePlan; renderMetrics?: { width: number; height: number; fontSize: number; lineHeight: number; letterSpacing: number; marginTop: number; marginBottom: number; paddingTop: number; paddingBottom: number } }, options?: { onUsage?: (event: OpenAIUsageEvent) => Promise<void> }) {
  const traceId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const editIntent = classifyAiEditIntent(input.prompt);
  /**
   * page plan이 있는 프로젝트는 "이 몰이 무엇을 파는 어떤 구성인가"를 참고 컨텍스트로 함께 넘겨
   * 부분 수정이 상품군과 페이지 톤에서 벗어나지 않게 합니다.
   * plan이 없는 기존 프로젝트는 예전 프롬프트를 그대로 씁니다.
   */
  const planContext = input.pagePlan ? renderPagePlanEditContext(input.pagePlan) : "";
  const scopedSystemPrompt = `${editSystemPrompt.replaceAll("SELECTED_ID", input.nodeId)}\nEvery nodeCss selector must also begin with the exact project selector [data-moire-root="${input.rootValue}"].${editIntent === "style-only" ? "\nThis is a STYLE-ONLY request. Return the selected outerHTML unchanged and put the requested visual change only in nodeCss." : ""}${planContext ? "\nThe user message carries this project's page composition. Treat it as context: keep the edit inside the composition's product category and tone, and never add, remove, or reorder sections outside the selected node." : ""}`;
  const userPrompt = `${planContext ? `${planContext}\n` : ""}Project architecture (context only):\n${JSON.stringify(input.architecture)}\nSelected node type: ${input.nodeType}\nCurrent selected render metrics (CSS px, use for relative changes):\n${JSON.stringify(input.renderMetrics ?? null)}\nSelected node outerHTML:\n${input.nodeHtml}\nCurrent project CSS for visual context:\n${input.projectCss}\nUser request:\n${input.prompt}`;
  const trace: GenerationTrace = { traceId, kind: "edit", createdAt, request: { model: model(), systemPrompt: scopedSystemPrompt, userPrompt } };
  try {
    const requestedModel = model();
    const response = await runRecordedOpenAICall({
      onUsage: options?.onUsage,
      call: () => getOpenAI().responses.create({
        model: requestedModel, store: false, max_output_tokens: 16000,
        input: [{ role: "system", content: scopedSystemPrompt }, { role: "user", content: userPrompt }],
        text: { format: { type: "json_schema", name: "moire_node_patch", strict: true, schema: nodeEditJsonSchema } },
      }),
      usageFromResponse: usageEventFromResponse,
      usageFromError: (usage) => usage ? usageEventFromResponse({ model: requestedModel, usage: usage as Parameters<typeof usageEventFromResponse>[0]["usage"] }) : null,
    });
    const parsed = nodeEditSchema.parse(JSON.parse(response.output_text));
    if (editIntent === "style-only" && !parsed.nodeCss.trim()) {
      throw new Error("AI가 실제로 적용할 스타일 값을 만들지 못했습니다. 변경할 크기나 배율을 더 구체적으로 적어 주세요.");
    }
    if (editIntent !== "style-only" && parsed.nodeHtml.trim().length < 20) {
      throw new Error("AI가 선택 영역의 HTML을 돌려주지 않았습니다. 요청을 조금 더 구체적으로 적어 주세요.");
    }
    const candidateHtml = editIntent === "style-only" ? input.nodeHtml : parsed.nodeHtml;
    const nodeHtml = ensureEditingMetadata(candidateHtml, `moire-${input.nodeId.replace(/[^a-z0-9-]/gi, "").slice(0, 24)}`);
    const patch = { nodeHtml, nodeCss: parsed.nodeCss };
    // 편집은 이미 이 프로젝트에 들어와 있는 이미지만 물려받습니다. 다른 프로젝트의 저장 이미지는 새로 끌어올 수 없습니다.
    const existingReferences = collectAssetReferences(input.nodeHtml, input.projectCss);
    const editAllowlist = createAssetAllowlist({ projectAssets: existingReferences.map((reference) => reference.url) });
    // 이미 있던 이미지까지 다시 심판하지 않습니다. 보호된 Product DOM이 선택 안에 있다는 이유만으로
    // 이미지를 건드리지 않는 CSS 수정까지 거부되던 원인입니다.
    const introduced = new Set(existingReferences.map((reference) => reference.url.slice(0, 120)));
    const assetViolations = auditGeneratedAssets({ html: patch.nodeHtml, css: patch.nodeCss }, editAllowlist)
      .filter((violation) => !violation.token || !introduced.has(violation.token));
    const nodeValidator = validateNodePatch({ nodeId: input.nodeId, rootValue: input.rootValue, ...patch });
    const validator = { safe: nodeValidator.safe && assetViolations.length === 0, violations: [...nodeValidator.violations, ...assetViolations] };
    trace.response = responseTrace(response);
    trace.generated = patch;
    trace.validator = validator;
    if (!validator.safe) throw new Error(`AI node patch 보호 검사 실패: ${validator.violations.map((item) => item.code).join(", ")}`);
    await writeGenerationTrace(trace);
    return { ...patch, summary: parsed.summary, traceId, validator };
  } catch (error) {
    trace.error = error instanceof Error ? error.message : "Unknown edit error";
    await writeGenerationTrace(trace);
    throw error;
  }
}
