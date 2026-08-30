/**
 * MOLIVE 고정 커머스 컴포넌트입니다.
 * HeaderV1 / ProductSectionV1의 DOM과 class는 Cafe24 실기기에서 검증된 형태 그대로이며,
 * Preview와 Cafe24 Export가 같은 마크업을 씁니다. AI는 스타일 토큰만 정합니다.
 */

import { renderComponent } from "../component-library/renderer.ts";
import { cardQuickActionCss, DEFAULT_PRODUCT_DISPLAY, PRODUCT_SCOPE, productDisplayCss, resolveProductDisplay, type ProductDisplayId } from "./product-display.ts";
import type { PreviewProductMock } from "../component-library/preview-mock.ts";
import type { ProjectHeaderPresentation } from "../project-source.ts";
import { STOREFRONT_FONT_FAMILY_SET } from "../fonts/storefront-fonts.ts";

export type CommerceVariant = "minimal" | "editorial" | "bold";
/** Cafe24 기본 스킨 상단 레이아웃(reference/cafe24-headers Top1~5)에 대응하는 배치 variant입니다. */
export type HeaderVariant = "split-utility" | "centered-brand" | "overlay-minimal" | "logo-center-row" | "stacked-left" | "stacked-split";
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
  /**
   * 상품 썸네일 표시 비율을 명시적으로 덮어씁니다.
   * 값이 있을 때만 적용해 기존 프로젝트 진열은 그대로 두고,
   * Cafe24 상품 binding과 DOM은 건드리지 않은 채 썸네일 상자의 CSS 비율만 바꿉니다.
   */
  thumbRatioOverride?: string;
  /**
   * Cafe24 원본 상품 전시 12종 중 하나입니다(reference/cafe24-product-grid, -slide).
   * 값이 있으면 legacy presentation(featured-grid 등)의 CSS 뒤층 대신 이 전시를 씁니다.
   * 저장값이 그대로 <ul class="prdList ..."> 토큰이 되어 Preview·ZIP·실몰이 같은 문자열을 갖습니다.
   */
  productDisplay?: ProductDisplayId;
};

/** Preview에서 Header를 가리키는 편집 ID입니다. Project Source HTML에는 없는 가상 노드입니다. */
export const HEADER_NODE_ID = "moire-header";

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

const HEADER_VARIANTS = new Set<HeaderVariant>(["split-utility", "centered-brand", "overlay-minimal", "logo-center-row", "stacked-left", "stacked-split"]);
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

const DEFAULT_HEADER_PRESENTATION: ProjectHeaderPresentation = {
  logo: { mode: "text", textSize: 26, imageHeight: 38, fontFamily: "inherit", lineHeight: 1, letterSpacing: 2, fontWeight: 800 },
  announcement: { visible: false, text: "새로운 소식을 입력하세요", href: "", backgroundColor: "#171713", textColor: "#ffffff", height: 36 },
};

function safeHeaderColor(value: string | undefined, fallback: string) {
  const color = value?.trim() ?? "";
  return /^(?:#[0-9a-f]{3,8}|rgba?\([\d\s,.%]+\)|hsla?\([\d\s,.%]+\))$/i.test(color) ? color : fallback;
}

function safeHeaderHref(value: string | undefined) {
  const href = value?.trim() ?? "";
  return /^(?:https?:\/\/|\/|#)/i.test(href) ? href : "";
}

const HEADER_LOGO_FONTS = new Set([
  "inherit",
  // 저장된 기존 프로젝트의 로고 스타일은 그대로 복원합니다.
  "Arial, sans-serif",
  "Pretendard, Arial, sans-serif",
  "Georgia, serif",
  "monospace",
  ...STOREFRONT_FONT_FAMILY_SET,
]);

function safeHeaderLogoFont(value: string | undefined) {
  return value && HEADER_LOGO_FONTS.has(value) ? value : "inherit";
}

export function resolveHeaderPresentation(value?: Partial<ProjectHeaderPresentation>): ProjectHeaderPresentation {
  const logoMode = value?.logo?.mode === "image" ? "image" : "text";
  return {
    logo: {
      mode: logoMode,
      text: value?.logo?.text?.trim() || undefined,
      imageUrl: value?.logo?.imageUrl?.trim() || undefined,
      textSize: Math.min(64, Math.max(18, value?.logo?.textSize ?? DEFAULT_HEADER_PRESENTATION.logo.textSize ?? 26)),
      imageHeight: Math.min(72, Math.max(20, value?.logo?.imageHeight ?? DEFAULT_HEADER_PRESENTATION.logo.imageHeight ?? 38)),
      fontFamily: safeHeaderLogoFont(value?.logo?.fontFamily),
      lineHeight: Math.min(2, Math.max(0.7, value?.logo?.lineHeight ?? DEFAULT_HEADER_PRESENTATION.logo.lineHeight ?? 1)),
      letterSpacing: Math.min(30, Math.max(-10, value?.logo?.letterSpacing ?? DEFAULT_HEADER_PRESENTATION.logo.letterSpacing ?? 2)),
      fontWeight: [300, 400, 500, 600, 700, 800, 900].includes(value?.logo?.fontWeight ?? 800) ? value?.logo?.fontWeight ?? 800 : 800,
    },
    announcement: {
      visible: value?.announcement?.visible ?? false,
      text: value?.announcement?.text ?? DEFAULT_HEADER_PRESENTATION.announcement.text,
      href: safeHeaderHref(value?.announcement?.href),
      backgroundColor: safeHeaderColor(value?.announcement?.backgroundColor, DEFAULT_HEADER_PRESENTATION.announcement.backgroundColor),
      textColor: safeHeaderColor(value?.announcement?.textColor, DEFAULT_HEADER_PRESENTATION.announcement.textColor),
      height: Math.min(72, Math.max(24, value?.announcement?.height ?? DEFAULT_HEADER_PRESENTATION.announcement.height)),
    },
  };
}

function renderAnnouncementBar(presentation: ProjectHeaderPresentation) {
  if (!presentation.announcement.visible) return "";
  const text = escapeHeaderText(presentation.announcement.text.trim() || "새로운 소식을 입력하세요");
  const content = presentation.announcement.href
    ? `<a href="${escapeHeaderText(presentation.announcement.href)}">${text}</a>`
    : `<span>${text}</span>`;
  return `<aside class="moireAnnouncementBar" aria-label="공지">${content}</aside>\n`;
}

/** Cafe24 Header template 하나를 target별 binding 값으로만 렌더링합니다. */
export function renderHeaderV1(mode: RenderMode, variant: HeaderVariant = "split-utility", brandName = "MOLIVE", presentationValue?: Partial<ProjectHeaderPresentation>) {
  if (!HEADER_VARIANTS.has(variant)) throw new Error(`지원하지 않는 HeaderV1 variant입니다: ${variant}`);
  const brand = brandName.trim() || "MOLIVE";
  const presentation = resolveHeaderPresentation(presentationValue);
  const logo = presentation.logo.mode === "image" && presentation.logo.imageUrl
    ? `<img class="pocHeader__logoImage" src="${escapeHeaderText(presentation.logo.imageUrl)}" alt="${escapeHeaderText(presentation.logo.text || brand)}" />`
    : `<span class="pocHeader__logoText">${escapeHeaderText(presentation.logo.text || brand)}</span>`;
  const template = HEADER_V1_CAFE24_TEMPLATE
    .replaceAll("__VARIANT__", variant)
    .replace('<span class="pocHeader__logoText">__BRAND_NAME__</span>', logo);
  // Preview와 Cafe24는 같은 DOM을 씁니다. Editor 선택용 메타데이터는 Canvas가 iframe에서 붙입니다.
  const header = mode === "cafe24" ? template : bindPreviewHeader(template);
  return `${renderAnnouncementBar(presentation)}${header}`;
}

/** 저장된 브랜드명을 Preview와 Cafe24 Header의 같은 텍스트 로고에 전달합니다. */
export function renderProjectHeaderV1(mode: RenderMode, project: { brandName?: string; name: string; architecture?: { header?: string; productPresentation?: string }; headerPresentation?: ProjectHeaderPresentation }) {
  const composition = resolveLegacyComposition(project.architecture);
  return renderHeaderV1(mode, composition.headerVariant, project.brandName?.trim() || project.name, project.headerPresentation);
}

export function headerTextToneCss(value: "dark" | "light") {
  return `/* Moiré Header text / icon tone */
#header.pocHeader .pocHeader__inner{color:${value === "light" ? "#ffffff" : "#171713"}}
#header.pocHeader .pocHeader__inner svg{color:inherit}
`;
}

export function headerPresentationCss(value?: Partial<ProjectHeaderPresentation>) {
  const presentation = resolveHeaderPresentation(value);
  const { textSize, imageHeight, fontFamily, lineHeight, letterSpacing, fontWeight } = presentation.logo;
  const announcement = presentation.announcement;
  return `/* Moiré Header logo / Announcement presentation */
.pocHeader__logoText{font-family:${fontFamily};font-size:${textSize}px;font-weight:${fontWeight};line-height:${lineHeight};letter-spacing:${letterSpacing}px}
.pocHeader__logo img.pocHeader__logoImage{display:block;width:auto;height:${imageHeight}px;max-width:min(360px,34vw);object-fit:contain}
.moireAnnouncementBar{position:relative;z-index:31;box-sizing:border-box;display:flex;align-items:center;justify-content:center;min-height:${announcement.height}px;padding:4px 24px;background:${announcement.backgroundColor};color:${announcement.textColor};font:600 13px/1.35 system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;text-align:center}
.moireAnnouncementBar a,.moireAnnouncementBar span{color:inherit;text-decoration:none}
.moireAnnouncementBar + #header.pocHeader--overlay-minimal{top:${announcement.visible ? announcement.height : 0}px}
@media (max-width:1024px){.pocHeader__logoText{font-size:min(${textSize}px,3.4vw)}.pocHeader__logo img.pocHeader__logoImage{height:min(${imageHeight}px,5vw)}}
@media (max-width:767px){.pocHeader__logoText{font-size:min(${textSize}px,26px)}.pocHeader__logo img.pocHeader__logoImage{height:min(${imageHeight}px,32px);max-width:36vw}.moireAnnouncementBar{min-height:min(${announcement.height}px,48px);padding-inline:16px;font-size:12px}}
`;
}

/**
 * 실몰 검증·동결된 ProductSectionV1 artifact를 Registry에서만 가져옵니다.
 * previewProducts는 Preview render에만 전달되고 Cafe24 render는 실제 상품 binding을 그대로 씁니다.
 * display는 Cafe24 전시 토큰이며 registry variant로 그대로 전달됩니다.
 */
export function renderVerifiedProductSection(
  mode: RenderMode,
  previewProducts?: readonly PreviewProductMock[],
  display: ProductDisplayId = DEFAULT_PRODUCT_DISPLAY,
) {
  const request = { component: "ProductSectionV1", variant: display };
  return renderComponent(request, mode, undefined, mode === "preview" ? { previewProducts } : {});
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
.pocHeader__logoText{font:800 24px/1 ${t.fontFamily};letter-spacing:.08em}
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
/* logo-center-row (Cafe24 Top2 / layout01 1단 로고 중앙형): 카테고리 좌 · 로고 중앙 · 유틸 우, 불투명 */
.pocHeader--logo-center-row .pocHeader__inner{display:grid;grid-template-columns:1fr auto 1fr;gap:24px}
.pocHeader--logo-center-row .pocHeader__logo{grid-column:2;justify-self:center}
.pocHeader--logo-center-row .pocHeader__category{grid-column:1;grid-row:1;justify-self:start}
.pocHeader--logo-center-row .pocHeader__util{grid-column:3;grid-row:1;justify-self:end}
/* stacked-left (Cafe24 Top3 / layout04 2단 좌측형): 로고 행(좌) + 유틸 우 / 내비 행(좌) */
.pocHeader--stacked-left .pocHeader__inner{display:grid;grid-template-columns:auto 1fr;grid-template-areas:"logo utility" "category category";gap:24px;row-gap:16px;padding:26px 0 14px}
.pocHeader--stacked-left .pocHeader__logo{grid-area:logo;justify-self:start}
.pocHeader--stacked-left .pocHeader__category{grid-area:category;justify-self:start}
.pocHeader--stacked-left .pocHeader__util{grid-area:utility;justify-self:end;align-self:center}
/* stacked-split (Cafe24 Top4 / layout02 2단 혼합형): 로고 행(중앙) / 유틸 좌 + 내비 우 */
.pocHeader--stacked-split .pocHeader__inner{display:grid;grid-template-columns:auto 1fr;grid-template-areas:"logo logo" "utility category";gap:24px;row-gap:16px;padding:26px 0 14px}
.pocHeader--stacked-split .pocHeader__logo{grid-area:logo;justify-self:center}
.pocHeader--stacked-split .pocHeader__util{grid-area:utility;justify-self:start;align-self:center}
.pocHeader--stacked-split .pocHeader__category{grid-area:category;justify-self:end}
${VARIANT_CSS[t.variant] ?? ""}
@media (max-width:1024px){.pocHeader__inner{width:calc(100% - 48px)}}
@media (max-width:767px){.pocHeader__inner{width:calc(100% - 40px);gap:16px}.pocHeader__category{display:none}.pocHeader--centered-brand .pocHeader__inner,.pocHeader--overlay-minimal .pocHeader__inner,.pocHeader--logo-center-row .pocHeader__inner,.pocHeader--stacked-left .pocHeader__inner,.pocHeader--stacked-split .pocHeader__inner{grid-template-columns:1fr auto}.pocHeader--centered-brand .pocHeader__inner,.pocHeader--stacked-left .pocHeader__inner,.pocHeader--stacked-split .pocHeader__inner{grid-template-areas:"logo utility";row-gap:0;padding:16px 0}.pocHeader--centered-brand .pocHeader__logo img{height:26px}.pocHeader--centered-brand .pocHeader__logo,.pocHeader--overlay-minimal .pocHeader__logo,.pocHeader--logo-center-row .pocHeader__logo,.pocHeader--stacked-split .pocHeader__logo{grid-column:1;justify-self:start}.pocHeader--centered-brand .pocHeader__util,.pocHeader--overlay-minimal .pocHeader__util,.pocHeader--logo-center-row .pocHeader__util,.pocHeader--stacked-split .pocHeader__util{grid-column:2;justify-self:end}.pocHeader__order,.pocHeader__state{display:none}}
`;
}

function stronglyScopeProductCss(css: string) {
  return css.split("\n").map((line) => line.replace(
    /^(\s*)(\.moireProductSection)/,
    "$1[data-moire-root] [data-cafe24-slot] $2",
  )).join("\n");
}

/** verified 선언 뒤층에서만 쓰는 presentation 선택자 prefix입니다. */
const P = PRODUCT_SCOPE;

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
/** 4:5, 3/4 같은 표기를 CSS aspect-ratio 값으로 정규화합니다. 해석되지 않으면 무시합니다. */
export function normalizeThumbRatio(value: string | undefined) {
  const match = (value ?? "").trim().replace(/\s+/g, "").match(/^(\d+(?:\.\d+)?)[:/](\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? `${width}/${height}` : null;
}

/**
 * 썸네일 상자의 비율만 마지막에 다시 선언합니다.
 * golden DOM·module·Cafe24 변수는 그대로 두고 상자 비율과 크롭 방식만 바꿉니다.
 */
function thumbRatioCss(ratio: string) {
  return `/* 상품 썸네일 표시 비율 override */
${P} .prdList .thumbnail a{display:block;overflow:hidden;aspect-ratio:${ratio}}
${P} .prdList .thumbnail a img{width:100%;height:100%;object-fit:cover}`;
}

export type VerifiedProductLayoutOptions = {
  /** Cafe24 원본 상품 전시 토큰입니다. 있으면 legacy presentation 대신 이 전시를 씁니다. */
  productDisplay?: unknown;
  /** Preview에는 Swiper JS가 없으므로 슬라이드 확인용 CSS 레이어가 한 겹 더 붙습니다. */
  target?: RenderMode;
};

export function verifiedProductLayoutCss(
  layout: ProductLayout = "grid-four",
  thumbRatioOverride?: string,
  options: VerifiedProductLayoutOptions = {},
) {
  if (!PRODUCT_LAYOUTS.has(layout)) throw new Error(`지원하지 않는 Product layout입니다: ${layout}`);
  const contentContract = `${P}{box-sizing:border-box;width:calc(100% - 64px);max-width:1280px;margin-left:auto;margin-right:auto}
@media all and (max-width:1024px){${P}{width:calc(100% - 48px)}}
@media all and (max-width:767px){${P}{width:calc(100% - 40px)}}`;
  /**
   * 상품 카드 퀵액션은 전시 12종에서 달라지지 않는 카드 공통 동작이라 전시 선택 여부와 무관하게
   * 여기서 한 번만 실립니다. canonical의 우측 상단 세로 배치를 바로 뒤에서 덮으므로
   * 전시를 아직 고르지 않은 기존 프로젝트도 같은 hover 오버레이로 동작합니다.
   */
  const canonical = `${stronglyScopeProductCss(renderVerifiedProductSection("preview").css)}\n${contentContract}\n${cardQuickActionCss()}`;
  /**
   * Cafe24 전시 토큰이 정해져 있으면 그 전시만 씁니다.
   * reference 12종에는 이미지 크롭이 전혀 없으므로 여기서는 비율 override도 얹지 않고
   * {$image_medium} 원본 비율을 그대로 흘립니다.
   */
  if (options.productDisplay !== undefined && options.productDisplay !== null) {
    return `${canonical}\n${productDisplayCss(options.productDisplay, { target: options.target === "cafe24" ? "cafe24" : "preview" })}`;
  }
  const base = layout === "grid-four" ? canonical : `${canonical}\n${PRODUCT_LAYOUT_CSS[layout]}`;
  const ratio = normalizeThumbRatio(thumbRatioOverride);
  return ratio ? `${base}\n${thumbRatioCss(ratio)}` : base;
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
  const scoped = scopeAiStaticCss(normalizeResponsiveDesignCss(css));
  const mobileImageCentering = `@media all and (max-width:767px){[data-moire-static][data-moire-root] img[data-moire-id]:where(:not([data-cafe24-slot], [data-cafe24-slot] *)){max-width:100%;margin-inline:auto;object-position:center center;transform-origin:center center}}`;
  return `${scoped}\n${mobileImageCentering}`;
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

  // 전시 토큰은 Preview와 Cafe24가 같은 값을 씁니다. 저장값이 없으면 지금까지의 기본 진열입니다.
  const display = tokens.productDisplay === undefined ? DEFAULT_PRODUCT_DISPLAY : resolveProductDisplay(tokens.productDisplay);
  const productSection = renderVerifiedProductSection(mode, mode === "preview" ? options.previewProducts : undefined, display);
  html = `${html.slice(0, first.openEnd + 1)}\n${productSection.html}\n${html.slice(first.closeStart)}`;

  // ProductSectionV1은 검증된 product_listmain_1을 소유하므로 중복 슬롯에는 상품 모듈을 넣지 않습니다.
  let cursor = first.openEnd + productSection.html.length + 2;
  while (true) {
    const extra = findSlotRange(html, cursor);
    if (!extra) break;
    html = html.slice(0, extra.openEnd + 1) + html.slice(extra.closeStart);
    cursor = extra.openEnd + 1;
  }

  void composition.productLayout;
  const header = options.includeHeader === false ? "" : renderHeaderV1(mode, composition.headerVariant);
  return { html: `${header}${html}`, slots: 1 };
}
