/**
 * Moiré 고정 커머스 컴포넌트입니다.
 * HeaderV1 / ProductSectionV1의 DOM과 class는 Cafe24 실기기에서 검증된 형태 그대로이며,
 * Preview와 Cafe24 Export가 같은 마크업을 씁니다. AI는 스타일 토큰만 정합니다.
 */

import { renderComponent } from "../component-library/renderer.ts";
import type { PreviewProductMock } from "../component-library/preview-mock.ts";

export type CommerceVariant = "minimal" | "editorial" | "bold";
export type HeaderVariant = "split-utility" | "centered-brand" | "overlay-minimal";
export type ProductLayout = "grid-four" | "large-grid" | "editorial-two" | "featured-grid" | "compact-five";
export type LegacyComposition = { headerVariant: HeaderVariant; productLayout: ProductLayout };

/** AI가 정할 수 있는 값은 전부 스타일입니다. 구조를 바꾸는 값은 받지 않습니다. */
export type CommerceTokens = {
  variant?: CommerceVariant;
  ink?: string;
  muted?: string;
  surface?: string;
  accent?: string;
  border?: string;
  fontFamily?: string;
  columns?: 3 | 4;
  gap?: string;
  radius?: string;
  thumbRatio?: string;
  thumbFit?: "contain" | "cover";
  thumbBackground?: string;
};

export type RenderMode = "preview" | "cafe24";

const DEFAULTS = {
  variant: "minimal" as CommerceVariant,
  ink: "#171713",
  muted: "#8c877e",
  surface: "#ffffff",
  accent: "#b5321f",
  border: "#e5e2db",
  fontFamily: "system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif",
  columns: 4 as 3 | 4,
  gap: "32px 24px",
  radius: "0px",
  thumbRatio: "1/1",
  thumbFit: "contain" as "contain" | "cover",
  thumbBackground: "#f2f0ea",
};

const HEADER_VARIANTS = new Set<HeaderVariant>(["split-utility", "centered-brand", "overlay-minimal"]);
const PRODUCT_LAYOUTS = new Set<ProductLayout>(["grid-four", "large-grid", "editorial-two", "featured-grid", "compact-five"]);

export function resolveLegacyComposition(architecture?: { header?: string; productPresentation?: string }): LegacyComposition {
  const headerVariant = HEADER_VARIANTS.has(architecture?.header as HeaderVariant) ? architecture?.header as HeaderVariant : "split-utility";
  const productLayout = PRODUCT_LAYOUTS.has(architecture?.productPresentation as ProductLayout) ? architecture?.productPresentation as ProductLayout : "grid-four";
  return { headerVariant, productLayout };
}

const HEADER_V1_CAFE24_TEMPLATE = `<header id="header" class="pocHeader pocHeader--__VARIANT__" data-header-variant="__VARIANT__">
  <div class="pocHeader__inner">
    <h1 class="pocHeader__logo" module="Layout_LogoTop">
      <a href="/index.html"><span class="pocHeader__logoText">__BRAND_NAME__</span></a>
    </h1>
    <nav class="pocHeader__category" module="Layout_category">
      <ul class="pocHeader__categoryList">
        <li><a href="{$link_product_list}">{$name_or_img_tag}</a></li>
      </ul>
    </nav>
    <div class="pocHeader__util">
      <button type="button" class="pocHeader__item pocHeader__search btnSearch eSearch">SEARCH</button>
      <div class="pocHeader__state" module="Layout_statelogoff">
        <a class="pocHeader__item" href="/member/login.html">LOGIN</a>
        <a class="pocHeader__item" href="/member/agreement.html">JOIN</a>
      </div>
      <div class="pocHeader__state" module="Layout_stateLogon">
        <a class="pocHeader__item" href="{$action_logout}">LOGOUT</a>
      </div>
      <a class="pocHeader__item pocHeader__order" href="/myshop/order/list.html">ORDER</a>
      <a class="pocHeader__item pocHeader__cart" href="/order/basket.html">CART</a>
    </div>
  </div>
</header>
`;

function bindPreviewHeader(template: string) {
  const bindings: ReadonlyArray<readonly [string, string]> = [
    ["{$link_product_list}", "/product/list.html?cate_no=24"],
    ["{$name_or_img_tag}", "SHOP"],
    ["{$action_logout}", "/index.html"],
  ];
  let html = template;
  for (const [binding, value] of bindings) html = html.replaceAll(binding, value);
  if (/\{\$/.test(html)) throw new Error("HeaderV1 Preview mock에 치환되지 않은 Cafe24 variable이 남아 있습니다.");
  return html;
}

function escapeHeaderText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Cafe24 Header template 하나를 target별 binding 값으로만 렌더링합니다. */
export function renderHeaderV1(mode: RenderMode, variant: HeaderVariant = "split-utility", brandName = "Moiré") {
  if (!HEADER_VARIANTS.has(variant)) throw new Error(`지원하지 않는 HeaderV1 variant입니다: ${variant}`);
  const brand = brandName.trim() || "Moiré";
  const template = HEADER_V1_CAFE24_TEMPLATE
    .replaceAll("__VARIANT__", variant)
    .replaceAll("__BRAND_NAME__", escapeHeaderText(brand));
  return mode === "cafe24" ? template : bindPreviewHeader(template);
}

/** 저장된 브랜드명을 Preview와 Cafe24 Header의 같은 텍스트 로고에 전달합니다. */
export function renderProjectHeaderV1(mode: RenderMode, project: { brandName?: string; name: string; architecture?: { header?: string; productPresentation?: string } }) {
  const composition = resolveLegacyComposition(project.architecture);
  return renderHeaderV1(mode, composition.headerVariant, project.brandName?.trim() || project.name);
}

const VERIFIED_PRODUCT_SECTION_REQUEST = {
  component: "ProductSectionV1",
  variant: "grid-four",
} as const;

/**
 * 실몰 검증·동결된 ProductSectionV1 artifact를 Registry에서만 가져옵니다.
 * previewProducts는 Preview render에만 전달되고 Cafe24 render는 실제 상품 binding을 그대로 씁니다.
 */
export function renderVerifiedProductSection(mode: RenderMode, previewProducts?: readonly PreviewProductMock[]) {
  return renderComponent(VERIFIED_PRODUCT_SECTION_REQUEST, mode, undefined, mode === "preview" ? { previewProducts } : {});
}

const VARIANT_CSS: Record<CommerceVariant, string> = {
  minimal: "",
  editorial: `.pocHeader__inner{padding-top:26px;padding-bottom:26px}`,
  bold: `.pocHeader__item{font-weight:800;letter-spacing:.1em}`,
};

/** 고정 컴포넌트의 CSS입니다. AI 토큰은 값만 바꾸고 선택자와 구조는 바꾸지 못합니다. */
export function commerceCss(tokens: CommerceTokens = {}, headerVariant: HeaderVariant = "split-utility") {
  const t = { ...DEFAULTS, ...tokens };
  if (!HEADER_VARIANTS.has(headerVariant)) throw new Error(`지원하지 않는 HeaderV1 variant입니다: ${headerVariant}`);
  return `/* Moiré 고정 커머스 컴포넌트. 구조는 코드가, 스타일 값은 토큰이 정합니다. */
#header.pocHeader{position:relative;z-index:30;width:auto;max-width:none;height:auto;padding:0;border:0;box-shadow:none;box-sizing:border-box;background:${t.surface};color:${t.ink};font-family:${t.fontFamily}}
.pocHeader__inner{display:flex;align-items:center;gap:32px;box-sizing:border-box;width:calc(100% - 64px);max-width:1280px;margin:0 auto;padding:18px 0}
.pocHeader__logo{margin:0;font-size:0;line-height:0}
.pocHeader__logo img{display:block;height:28px;width:auto}
.pocHeader__logoText{font:800 20px/1 ${t.fontFamily};letter-spacing:.08em}
.pocHeader__category{flex:1;min-width:0}
.pocHeader__categoryList{display:flex;align-items:center;gap:20px;margin:0;padding:0;list-style:none}
.pocHeader__categoryList a{font:600 13px/1 ${t.fontFamily};letter-spacing:.02em;color:inherit;text-decoration:none;white-space:nowrap}
.pocHeader__util{display:flex;align-items:center;gap:18px}
.pocHeader__state{display:flex;align-items:center;gap:18px}
.pocHeader__item{display:inline-flex;align-items:center;font:600 12px/1 ${t.fontFamily};letter-spacing:.06em;color:inherit;text-decoration:none;white-space:nowrap;background:none;border:0;padding:0;cursor:pointer}
/* split-utility: compact single row — 낮은 헤더, 작은 로고, 촘촘한 한 줄 */
.pocHeader--split-utility .pocHeader__logo{order:1}
.pocHeader--split-utility .pocHeader__category{order:2}
.pocHeader--split-utility .pocHeader__util{order:3}
.pocHeader--split-utility .pocHeader__inner{padding:12px 0;gap:28px}
.pocHeader--split-utility .pocHeader__logo img{height:22px}
.pocHeader--split-utility .pocHeader__categoryList a{font-size:12px}
/* centered-brand: large brand row + separate nav row — 큰 로고 행 아래 내비 행 분리 */
.pocHeader--centered-brand .pocHeader__inner{display:grid;grid-template-columns:1fr auto 1fr;grid-template-areas:". logo utility" "category category category";gap:24px;row-gap:16px;padding:26px 0 14px}
.pocHeader--centered-brand .pocHeader__logo{grid-area:logo;justify-self:center}
.pocHeader--centered-brand .pocHeader__logo img{height:34px}
.pocHeader--centered-brand .pocHeader__category{grid-area:category;justify-self:center}
.pocHeader--centered-brand .pocHeader__categoryList{gap:26px}
.pocHeader--centered-brand .pocHeader__util{grid-area:utility;justify-self:end;align-self:center}
/* overlay-minimal: Hero 위 투명 오버레이 — 넉넉한 상단 여백, 넓은 자간 */
#header.pocHeader--overlay-minimal{position:absolute;inset:0 0 auto;background:transparent;color:${t.ink}}
.pocHeader--overlay-minimal .pocHeader__inner{display:grid;grid-template-columns:1fr auto 1fr;gap:24px;padding:30px 0}
.pocHeader--overlay-minimal .pocHeader__logo{grid-column:2;justify-self:center}
.pocHeader--overlay-minimal .pocHeader__logo img{height:30px}
.pocHeader--overlay-minimal .pocHeader__category{grid-column:1;grid-row:1;justify-self:start}
.pocHeader--overlay-minimal .pocHeader__util{grid-column:3;grid-row:1;justify-self:end}
.pocHeader--overlay-minimal .pocHeader__item,.pocHeader--overlay-minimal .pocHeader__categoryList a{letter-spacing:.12em}
${VARIANT_CSS[t.variant] ?? ""}
@media (max-width:1024px){.pocHeader__inner{width:calc(100% - 48px)}}
@media (max-width:767px){.pocHeader__inner{width:calc(100% - 40px);gap:16px}.pocHeader__category{display:none}.pocHeader--centered-brand .pocHeader__inner,.pocHeader--overlay-minimal .pocHeader__inner{grid-template-columns:1fr auto}.pocHeader--centered-brand .pocHeader__inner{grid-template-areas:"logo utility";row-gap:0;padding:16px 0}.pocHeader--centered-brand .pocHeader__logo img{height:26px}.pocHeader--centered-brand .pocHeader__logo,.pocHeader--overlay-minimal .pocHeader__logo{grid-column:1;justify-self:start}.pocHeader--centered-brand .pocHeader__util,.pocHeader--overlay-minimal .pocHeader__util{grid-column:2;justify-self:end}.pocHeader__order,.pocHeader__state{display:none}}
`;
}

function stronglyScopeProductCss(css: string) {
  return css.split("\n").map((line) => line.replace(
    /^(\s*)(\.moireProductSection)/,
    "$1[data-moire-root] [data-cafe24-slot] $2",
  )).join("\n");
}

/** verified 선언 뒤층에서만 쓰는 presentation 선택자 prefix입니다. */
const P = "[data-moire-root] [data-cafe24-slot] .moireProductSection.ec-base-product";

/**
 * Presentation variant별 CSS 뒤층입니다. golden DOM/module/변수 계약은 그대로 두고
 * 반복 폭·이미지 비율·밀도·정렬·모바일 reflow만 재선언합니다.
 * 이미지 소스 정책: Guide skin4/17/18의 상품 진열에서 검증된 리스트 이미지 변수는
 * {$image_medium}뿐이므로({$image_tiny}는 board/myshop 전용, big/small은 미존재)
 * 큰 카드를 쓰는 variant는 변수 교체 대신 카드 콘텐츠 폭 캡으로 확대를 막습니다.
 */
const PRODUCT_LAYOUT_CSS: Record<Exclude<ProductLayout, "grid-four">, string> = {
  "large-grid": `/* ProductSectionV1/large-grid: PC 3열, 4/5 크롭, 넉넉한 간격의 라이프스타일 진열 */
${P} .prdList > li{width:33.3333%}
@media all and (min-width:768px) and (max-width:1024px){${P} .prdList > li{width:50%}}
@media all and (max-width:767px){${P} .prdList > li{width:50%}}
${P} .prdList{margin:0 -14px}
${P} .prdList > li{margin:0 0 52px}
${P} .prdList .prdList__item{margin:0 14px}
${P} .prdList .thumbnail a{display:block;overflow:hidden;aspect-ratio:4/5}
${P} .prdList .thumbnail a img{height:100%;object-fit:cover}
${P} .prdList .description .name a{font-size:14px}`,
  "editorial-two": `/* ProductSectionV1/editorial-two: 2열 대형 카드, 3/4 크롭, 중앙 정렬 타이포, 좁은 section 폭 */
${P}{max-width:1040px}
${P} .prdList > li{width:50%;margin:0 0 76px}
${P} .prdList .prdList__item{margin:0 auto;max-width:500px}
${P} .prdList .thumbnail a{display:block;overflow:hidden;aspect-ratio:3/4}
${P} .prdList .thumbnail a img{height:100%;object-fit:cover}
${P} .prdList .description{margin:24px 0 0;text-align:center}
${P} .prdList .description .name{text-align:center}
${P} .prdList .description .name a{font-size:15px;letter-spacing:.01em}
${P} .spec{margin:10px 0 0}
${P} .spec > li{margin:0 0 6px;text-align:center}
${P} .prdList .icon{text-align:center}
@media all and (min-width:768px) and (max-width:1024px){${P} .prdList > li{width:50%}}
@media all and (max-width:767px){${P} .prdList > li{width:100%;margin:0 0 56px}${P} .prdList .prdList__item{max-width:420px}}`,
  "featured-grid": `/* ProductSectionV1/featured-grid: 첫 상품을 4/5 대형 피처로, 나머지는 1/1 그리드로 */
${P} .prdList > li{width:25%;margin:0 0 40px}
${P} .prdList > li:first-child{width:50%}
${P} .prdList > li:first-child .prdList__item{max-width:540px}
${P} .prdList .thumbnail a{display:block;overflow:hidden;aspect-ratio:1/1}
${P} .prdList > li:first-child .thumbnail a{aspect-ratio:4/5}
${P} .prdList .thumbnail a img{height:100%;object-fit:cover}
${P} .prdList > li:first-child .description .name a{font-size:15px}
@media all and (min-width:768px) and (max-width:1024px){${P} .prdList > li{width:50%}${P} .prdList > li:first-child{width:100%}${P} .prdList > li:first-child .prdList__item{margin-left:auto;margin-right:auto;max-width:520px}}
@media all and (max-width:767px){${P} .prdList > li{width:50%}${P} .prdList > li:first-child{width:100%}${P} .prdList > li:first-child .prdList__item{margin-left:auto;margin-right:auto;max-width:420px}}`,
  "compact-five": `/* ProductSectionV1/compact-five: 5열 컴팩트, 1/1 크롭, 타이트한 정보 밀도, 넓은 section 폭 */
${P}{max-width:1440px}
${P} .prdList{margin:0 -6px}
${P} .prdList > li{width:20%;margin:0 0 20px}
${P} .prdList .prdList__item{margin:0 6px}
${P} .prdList .thumbnail{margin:0 0 8px}
${P} .prdList .thumbnail a{display:block;overflow:hidden;aspect-ratio:1/1}
${P} .prdList .thumbnail a img{height:100%;object-fit:cover}
${P} .prdList .description{margin:12px 8px 0 0;font-size:11px;line-height:16px}
${P} .prdList .description .name a{font-size:12px}
${P} .spec{margin:6px 0 0}
${P} .spec > li{margin:0 0 6px;line-height:16px}
${P} .prdList .icon{margin:8px 0 0}
@media all and (min-width:768px) and (max-width:1024px){${P} .prdList > li{width:25%}}
@media all and (max-width:767px){${P} .prdList{margin:0 -4px}${P} .prdList > li{width:50%;margin:0 0 16px}${P} .prdList .prdList__item{margin:0 4px}}`,
};

/** AI CSS와 Guide bridge보다 뒤에서 golden 선언을 같은 값으로 재확정합니다. */
export function verifiedProductLayoutCss(layout: ProductLayout = "grid-four") {
  if (!PRODUCT_LAYOUTS.has(layout)) throw new Error(`지원하지 않는 Product layout입니다: ${layout}`);
  const contentContract = `${P}{box-sizing:border-box;width:calc(100% - 64px);max-width:1280px;margin-left:auto;margin-right:auto}
@media all and (max-width:1024px){${P}{width:calc(100% - 48px)}}
@media all and (max-width:767px){${P}{width:calc(100% - 40px)}}`;
  const canonical = `${stronglyScopeProductCss(renderVerifiedProductSection("preview").css)}\n${contentContract}`;
  if (layout === "grid-four") return canonical;
  return `${canonical}\n${PRODUCT_LAYOUT_CSS[layout]}`;
}

function normalizeResponsiveDesignCss(css: string) {
  return css.replace(/([^{}]*hero[^{}]*)\{([^{}]*)\}/gi, (rule, selector: string, body: string) => {
    const normalized = body.replace(/calc\(\s*100(?:d|s|l)?vh\s*-\s*\d+(?:\.\d+)?px\s*\)/gi, "100svh");
    return `${selector}{${normalized}}`;
  }).replace(/([^{}]+)\{([^{}]*)\}/g, (rule, selector: string, body: string) => {
    const normalized = body.replace(/font-size\s*:\s*(-?\d+(?:\.\d+)?)vw\s*;/gi, (_declaration, raw: string) => {
      const fluid = `${raw}vw`;
      if (/hero|display/i.test(selector)) return `font-size:clamp(48px,${fluid},76px);`;
      if (/\bh[1-6]\b|heading|title/i.test(selector)) return `font-size:clamp(32px,${fluid},48px);`;
      if (/nav|menu/i.test(selector)) return `font-size:clamp(12px,${fluid},14px);`;
      if (/meta|small|eyebrow|caption/i.test(selector)) return `font-size:clamp(11px,${fluid},13px);`;
      return `font-size:clamp(14px,${fluid},16px);`;
    });
    return `${selector}{${normalized}}`;
  });
}

function splitSelectorList(selectorList: string) {
  const selectors: string[] = [];
  let start = 0;
  let round = 0;
  let square = 0;
  for (let index = 0; index < selectorList.length; index += 1) {
    const char = selectorList[index];
    if (char === "(") round += 1;
    else if (char === ")") round = Math.max(0, round - 1);
    else if (char === "[") square += 1;
    else if (char === "]") square = Math.max(0, square - 1);
    else if (char === "," && round === 0 && square === 0) {
      selectors.push(selectorList.slice(start, index));
      start = index + 1;
    }
  }
  selectors.push(selectorList.slice(start));
  return selectors;
}

function scopeStaticSelector(selector: string) {
  const trimmed = selector.trim();
  if (!trimmed || trimmed.startsWith("@") || /^(?:from|to|\d+(?:\.\d+)?%)$/i.test(trimmed)) return selector;
  const scoped = /\[data-moire-root(?:\s*=|\])/i.test(trimmed)
    ? trimmed.replace(/\[data-moire-root/gi, "[data-moire-static][data-moire-root")
    : `[data-moire-static] ${trimmed}`;
  const pseudoElement = scoped.match(/(::[a-z-]+(?:\([^)]*\))?)\s*$/i);
  const boundary = ":where(:not([data-cafe24-slot], [data-cafe24-slot] *))";
  if (!pseudoElement || pseudoElement.index === undefined) return `${scoped}${boundary}`;
  return `${scoped.slice(0, pseudoElement.index)}${boundary}${scoped.slice(pseudoElement.index)}`;
}

function scopeAiStaticCss(css: string) {
  return css.replace(/([^{}]+)\{([^{}]*)\}/g, (rule, rawSelector: string, body: string) => {
    const leading = rawSelector.match(/^(\s*(?:\/\*[\s\S]*?\*\/\s*)*)/)?.[1] ?? "";
    const selectorList = rawSelector.slice(leading.length);
    if (!selectorList.trim() || selectorList.trim().startsWith("@")) return rule;
    const selectors = splitSelectorList(selectorList).map(scopeStaticSelector).join(",");
    return `${leading}${selectors}{${body}}`;
  });
}

/** AI presentation CSS는 정적 본문에만 적용하고 Product slot에서 scope를 끊습니다. */
export function isolateAiDesignCss(css: string) {
  return scopeAiStaticCss(normalizeResponsiveDesignCss(css));
}

const SLOT_MARK = 'data-cafe24-slot="product-list"';

function findSlotRange(html: string, from: number) {
  const mark = html.indexOf(SLOT_MARK, from);
  if (mark < 0) return null;
  const openStart = html.lastIndexOf("<", mark);
  if (openStart < 0) return null;
  const tagName = html.slice(openStart + 1).match(/^[a-zA-Z][a-zA-Z0-9-]*/)?.[0];
  const openEnd = html.indexOf(">", mark);
  if (!tagName || openEnd < 0) return null;
  const open = new RegExp(`<${tagName}(?=[\\s/>])`, "gi");
  const close = new RegExp(`</${tagName}\\s*>`, "gi");
  let depth = 0;
  let cursor = openStart;
  while (cursor <= html.length) {
    open.lastIndex = cursor;
    close.lastIndex = cursor;
    const nextOpen = open.exec(html);
    const nextClose = close.exec(html);
    if (!nextClose) return null;
    if (nextOpen && nextOpen.index < nextClose.index) { depth += 1; cursor = nextOpen.index + 1; continue; }
    depth -= 1;
    if (depth === 0) return { openEnd, closeStart: nextClose.index };
    cursor = nextClose.index + 1;
  }
  return null;
}

function stripElement(html: string, tagName: string) {
  const openStart = html.search(new RegExp(`<${tagName}(?=[\\s>])`, "i"));
  if (openStart < 0) return html;
  const closeAt = html.toLowerCase().indexOf(`</${tagName}>`, openStart);
  if (closeAt < 0) return html;
  return html.slice(0, openStart) + html.slice(closeAt + tagName.length + 3);
}

function stripAllElements(html: string, tagName: string) {
  let output = html;
  while (new RegExp(`<${tagName}(?=[\\s>])`, "i").test(output)) {
    const next = stripElement(output, tagName);
    if (next === output) break;
    output = next;
  }
  return output;
}

function markAiStaticRoot(html: string) {
  if (/\bdata-moire-static(?:\s|=|>)/i.test(html)) return html;
  return html.replace(/<([a-z][a-z0-9-]*)(?=[\s>])/i, '<$1 data-moire-static');
}

/**
 * AI 본문에 고정 컴포넌트를 끼워 넣습니다.
 * 상품 슬롯이 하나도 없으면 Guide module로 물러나지 않고 실패시킵니다.
 */
export function composeCommerce(
  bodyHtml: string,
  mode: RenderMode,
  tokens: CommerceTokens = {},
  composition: LegacyComposition = { headerVariant: "split-utility", productLayout: "grid-four" },
  options: { includeHeader?: boolean; previewProducts?: readonly PreviewProductMock[] } = {},
) {
  let html = markAiStaticRoot(stripAllElements(bodyHtml, "header"));
  const first = findSlotRange(html, 0);
  if (!first) throw new Error("상품 슬롯(data-cafe24-slot=\"product-list\")이 없습니다. 검증된 ProductSectionV1을 넣을 자리가 필요합니다.");

  const productSection = renderVerifiedProductSection(mode, mode === "preview" ? options.previewProducts : undefined);
  html = `${html.slice(0, first.openEnd + 1)}\n${productSection.html}\n${html.slice(first.closeStart)}`;

  // ProductSectionV1은 검증된 product_listmain_1을 소유하므로 중복 슬롯에는 상품 모듈을 넣지 않습니다.
  let cursor = first.openEnd + productSection.html.length + 2;
  while (true) {
    const extra = findSlotRange(html, cursor);
    if (!extra) break;
    html = html.slice(0, extra.openEnd + 1) + html.slice(extra.closeStart);
    cursor = extra.openEnd + 1;
  }

  void tokens;
  void composition.productLayout;
  const header = options.includeHeader === false ? "" : renderHeaderV1(mode, composition.headerVariant);
  return { html: `${header}${html}`, slots: 1 };
}
