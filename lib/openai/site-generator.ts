import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { ensureEditingMetadata, validateNodePatch, validateProjectSource } from "@/lib/cafe24/protection";
import { buildDesignGenerationUserPrompt, validateGeneratedDesignContract, type DesignGenerationInput } from "@/lib/openai/design-generation-contract";
import { composeDesignBlueprint } from "@/lib/design-library/blueprint";
import { HERO_VARIANT_IDS } from "@/lib/design-library/variants";
import { writeGenerationTrace, type GenerationTrace } from "@/lib/openai/dev-trace";
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

const designSchema = z.object({
  name: z.string().min(1),
  designRationale: z.string().min(1),
  architecture: architectureSchema,
  commerce: commerceSchema,
  html: z.string().min(200),
  css: z.string().min(200),
});

const nodeEditSchema = z.object({ summary: z.string().min(1), nodeHtml: z.string().min(20), nodeCss: z.string() });

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

const designJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "designRationale", "architecture", "commerce", "html", "css"],
  properties: {
    name: { type: "string" }, designRationale: { type: "string" }, architecture: architectureJsonSchema,
    commerce: commerceJsonSchema, html: { type: "string" }, css: { type: "string" },
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

The user message contains a binding DESIGN BLUEPRINT composed from real Cafe24 reference patterns: one hero variant, an ordered section plan, and density/typography/image-treatment axes. Build exactly that structure — do not add, drop, or reorder sections — and spend your creativity on copy, palette, imagery, proportion, and detail within it. Two briefs with different blueprints must produce structurally different pages, not recolored copies.

COMMERCE FIRST
- This is a real storefront whose job is conversion, not a one-screen brand landing page. Build a complete journey from brand promise to product discovery to trust and a clear next action.
- Choose the product section position from the buying journey. It may follow Hero, Category/Collection, a concise Story, or another brief-specific lead-in; do not reuse one fixed macro order.
- Plan exactly one primary product area and place one empty data-cafe24-slot="product-list" wrapper at that position.
- Surround the verified product area with an intentional heading, useful category/collection cues, and a next-step CTA when appropriate. Never invent product values.
- Choose only the supporting sections the brand needs: Category/Collection, Brand Story, editorial image content, Benefit/Trust, Banner/CTA, or social-style gallery. Do not include every type by default.

REFERENCE-DERIVED DESIGN GRAMMAR
- Derive a genuinely project-specific page architecture from the brief and assets. The AI-owned canvas starts after fixed HeaderV1 and includes Hero, Category/Collection expression, product surroundings, Brand Story, editorial imagery, Benefit/Trust, Banner/CTA, social-style gallery, and an optional short brand closing. It never includes Cafe24 function DOM.
- Hero must follow the blueprint's hero variant. The library spans a committed full-bleed composition, a purposeful split-editorial composition, a banner-stack board, a typographic-marquee statement, a cinematic-still, and a product-forward compact banner; build the one the blueprint names to its structural spec. Vary crop, focal point, text anchoring, layering, and vertical rhythm instead of merely swapping colours.
- The product surroundings may feel commerce-forward and dense or editorial and spacious, but ProductSectionV1 itself remains untouched.
- Brand Story should use split-media or a strong editorial composition, not another generic card row.
- Category, CTA, Benefit/Trust, gallery, and editorial sections are optional. Select and order them according to industry, buying intent, available imagery, and brand voice.
- Avoid a page whose hero is polished but everything below becomes repeated equal cards. Alternate composition, scale, image/text relationships, and background rhythm while keeping one coherent design language.
- Before writing HTML, commit to headerVariant, heroComposition, productLayout, section order/selection, typography scale, image treatment, spacing/density, and content composition. Do not return vague labels such as modern, premium, or clean by themselves.
- Encode the deterministic choices in the existing architecture object exactly: header = split-utility | centered-brand | overlay-minimal, hero = the blueprint's hero variant id (full-bleed | split-editorial | banner-stack | typographic-marquee | cinematic-still | product-forward), productPresentation = the blueprint's presentation id (grid-four | large-grid | editorial-two | featured-grid | compact-five). architecture.sections is the actual ordered section plan and must record the blueprint's section refs in order.
- A materially different brief must produce visibly different decisions across those six axes, not a recoloured copy of the same page.
- Keep decoration subordinate to product discovery and purchase flow. Use effects sparingly and preserve scanability, readable contrast, and obvious actions.
- The product cards render through the verified presentation named by the blueprint (standard four-column, large three-column, editorial two-column, featured-plus-grid, or compact five-column, each with its own crop, density, and mobile reflow owned by code). Express the brief through the surrounding section rather than authoring card CSS.
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
- The header and the product cards are fixed Moiré components. Never author a header element, product card markup, prices, or any pocHeader__/pocGrid__ class. Preview and Cafe24 export both render HeaderV1 and the verified ProductSectionV1/ProductCardV1 from code, so anything you write for them is discarded.
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

ASSETS AND COPY
- For attached images use asset://0, asset://1, etc. in attachment order. When none exist, use relevant images.unsplash.com URLs with explicit crop parameters.
- Write customer-facing copy in Korean unless concise display English is part of the art direction.
- Output clean production markup, not an explanation embedded in HTML.`;

function getOpenAI() { return new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); }
function model() { return process.env.OPENAI_MODEL || "gpt-5.6"; }

function resolveAssetReferences(value: string, assetUrls: string[]) {
  return value.replace(/asset:\/\/(\d+)/g, (_token, index: string) => assetUrls[Number(index)] ?? "");
}

function responseTrace(response: { id: string; model: string; output_text: string; usage?: unknown }) {
  return { id: response.id, model: response.model, outputText: response.output_text, usage: response.usage ?? null };
}

export async function generateProjectSource(input: DesignGenerationInput) {
  const traceId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const blueprint = composeDesignBlueprint(input, input.seed);
  const userPrompt = buildDesignGenerationUserPrompt(input, blueprint);
  const blueprintAudit = {
    industry: blueprint.industry,
    flowId: blueprint.flowId,
    header: blueprint.header.id,
    hero: blueprint.hero.id,
    productPresentation: blueprint.productPresentation.id,
    sections: blueprint.sections.map((section) => section.ref),
    footerMood: blueprint.footerMood,
    density: blueprint.density,
    typeScale: blueprint.typeScale,
    imageTreatment: blueprint.imageTreatment,
    seed: blueprint.seed,
  };
  const trace: GenerationTrace = { traceId, kind: "generate", createdAt, request: { model: model(), systemPrompt, userPrompt, blueprint: blueprintAudit, imageCount: input.assetUrls?.length ?? 0 }, response: [] };
  let previousIssues: string[] = [];

  try {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const correction = previousIssues.length ? `\nA prior draft failed validation. Rebuild it and correct all of these issues: ${previousIssues.join("; ")}` : "";
      const response = await getOpenAI().responses.create({
        model: model(), store: false, max_output_tokens: 30000,
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: [
            { type: "input_text", text: userPrompt + correction },
            ...(input.assetUrls ?? []).map((imageUrl) => ({ type: "input_image" as const, image_url: imageUrl, detail: "auto" as const })),
          ] },
        ],
        text: { format: { type: "json_schema", name: "moire_project_source", strict: true, schema: designJsonSchema } },
      });
      const parsed = designSchema.parse(JSON.parse(response.output_text));
      const projectId = crypto.randomUUID();
      const rawHtml = resolveAssetReferences(parsed.html, input.assetUrls ?? []);
      const html = ensureEditingMetadata(rawHtml, `moire-${projectId.slice(0, 8)}`);
      const css = resolveAssetReferences(parsed.css, input.assetUrls ?? []);
      const source: ProjectSource = { id: projectId, name: parsed.name, html, css, architecture: parsed.architecture, commerce: parsed.commerce, updatedAt: new Date().toISOString() };
      const baseValidator = validateProjectSource(source);
      const designViolations = validateGeneratedDesignContract(source, blueprint);
      const validator = {
        ...baseValidator,
        safe: baseValidator.safe && designViolations.length === 0,
        violations: [...baseValidator.violations, ...designViolations],
      };
      (trace.response as unknown[]).push({ attempt, ...responseTrace(response), rawGenerated: { architecture: parsed.architecture, html: rawHtml, css }, normalizedProjectSource: source, validator });
      if (validator.safe) {
        trace.generated = source;
        trace.validator = validator;
        await writeGenerationTrace(trace);
        return { source, rationale: parsed.designRationale, traceId, validator, blueprint: blueprintAudit };
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
- Do not refer to styles outside the selected node. Preserve data-cafe24-slot when it exists in the selected subtree.`;

export async function editProjectNode(input: { prompt: string; nodeId: string; nodeType: string; nodeHtml: string; projectCss: string; rootValue: string; architecture: ProjectSource["architecture"] }) {
  const traceId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const scopedSystemPrompt = `${editSystemPrompt.replaceAll("SELECTED_ID", input.nodeId)}\nEvery nodeCss selector must also begin with the exact project selector [data-moire-root="${input.rootValue}"].`;
  const userPrompt = `Project architecture (context only):\n${JSON.stringify(input.architecture)}\nSelected node type: ${input.nodeType}\nSelected node outerHTML:\n${input.nodeHtml}\nCurrent project CSS for visual context:\n${input.projectCss}\nUser request:\n${input.prompt}`;
  const trace: GenerationTrace = { traceId, kind: "edit", createdAt, request: { model: model(), systemPrompt: scopedSystemPrompt, userPrompt } };
  try {
    const response = await getOpenAI().responses.create({
      model: model(), store: false, max_output_tokens: 16000,
      input: [{ role: "system", content: scopedSystemPrompt }, { role: "user", content: userPrompt }],
      text: { format: { type: "json_schema", name: "moire_node_patch", strict: true, schema: nodeEditJsonSchema } },
    });
    const parsed = nodeEditSchema.parse(JSON.parse(response.output_text));
    const nodeHtml = ensureEditingMetadata(parsed.nodeHtml, `moire-${input.nodeId.replace(/[^a-z0-9-]/gi, "").slice(0, 24)}`);
    const patch = { nodeHtml, nodeCss: parsed.nodeCss };
    const validator = validateNodePatch({ nodeId: input.nodeId, rootValue: input.rootValue, ...patch });
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
