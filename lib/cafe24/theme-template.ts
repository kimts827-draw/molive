export const MOIRE_LAYOUT_PATH = "layout/basic/moire.html";
export const MOIRE_HEADER_PATH = "layout/basic/moire_header.html";
export const MOIRE_CSS_PATH = "css/moire.css";
export const MOIRE_BRIDGE_CSS_PATH = "css/moire-bridge.css";
export const MOIRE_COMMERCE_CSS_PATH = "css/moire-commerce.css";
export const BASE_LAYOUT_PATH = "layout/basic/main.html";
export const BASE_INDEX_PATH = "index.html";
export const SUB_LAYOUT_PATHS = ["layout/basic/layout.html", "layout/basic/detail_layout.html"];

import { PRODUCT_SLIDE_SCRIPT_PATH } from "./product-slide-script.ts";

const SLOT_MARK = 'data-cafe24-slot="product-list"';

/**
 * Cafe24가 서버에서 직접 만들고 관리하는 파일입니다.
 * 기준 스킨 압축본에 딸려 오지만 내용이 다른 몰의 URL이고 디자인FTP 쓰기 권한도 없어 테마 ZIP에서 제외합니다.
 */
const SERVER_MANAGED_FILES = [/^sitemap[^/]*[.]xml([.]temp)?$/i];

export function isServerManagedSkinFile(path: string) {
  return SERVER_MANAGED_FILES.some((pattern) => pattern.test(path));
}

/** 사업자정보와 고객센터는 Cafe24 계정정보로 자동 출력되므로 기존 footer를 그대로 씁니다. */
export const INCLUDE_CAFE24_FOOTER = true;

const REMOVED_HOME_IMPORTS = [
  "<!--@import(/layout/basic/topbanner.html)-->",
  "<!--@import(/layout/basic/sidebar.html)-->",
  "<!--@import(/layout/basic/quick.html)-->",
];

/** 내용을 Cafe24 모듈/변수로 바꿔 끼우는 지점입니다. */
const CAFE24_BINDINGS: { bind: string; inner: string }[] = [
  // Cafe24는 module 블록 안에서만 {$...}를 치환하므로 몰 이름도 Layout_LogoTop으로 감싸야 합니다.
  { bind: "mall-name", inner: '<span module="Layout_LogoTop" class="moire-mall-name">{$mall_name}</span>' },
  { bind: "navigation", inner: "<!--@import(/layout/basic/navigation.html)-->" },
  { bind: "account", inner: "<!--@import(/layout/basic/state_login.html)-->" },
  { bind: "category", inner: '<div module="Layout_category"><ul><li><a href="{$link_product_list}">{$name_or_img_tag}</a></li></ul></div>' },
];

/**
 * 링크만 연결하는 지점입니다.
 * AI가 쓴 라벨과 아이콘을 그대로 두고 href/class만 바꿔야 Preview와 위치·크기·정렬이 같습니다.
 */
const CAFE24_LINK_BINDINGS: { bind: string; href?: string; addClass?: string }[] = [
  { bind: "search", addClass: "btnSearch eSearch" },
  { bind: "mypage", href: "/myshop/index.html" },
  { bind: "wishlist", href: "/myshop/wish_list.html" },
  { bind: "login", href: "/member/login.html" },
  { bind: "join", href: "/member/agreement.html" },
  { bind: "order", href: "/myshop/order/list.html" },
  { bind: "cart", href: "/order/basket.html" },
];

function findMatchingClose(html: string, openTagStart: number, tagName: string) {
  const open = new RegExp(`<${tagName}(?=[\\s/>])`, "gi");
  const close = new RegExp(`</${tagName}\\s*>`, "gi");
  let depth = 0;
  let cursor = openTagStart;
  while (cursor <= html.length) {
    open.lastIndex = cursor;
    close.lastIndex = cursor;
    const nextOpen = open.exec(html);
    const nextClose = close.exec(html);
    if (!nextClose) return -1;
    if (nextOpen && nextOpen.index < nextClose.index) { depth += 1; cursor = nextOpen.index + 1; continue; }
    depth -= 1;
    if (depth === 0) return nextClose.index;
    cursor = nextClose.index + 1;
  }
  return -1;
}

function tagNameAt(html: string, openStart: number) {
  return html.slice(openStart + 1).match(/^[a-zA-Z][a-zA-Z0-9-]*/)?.[0] ?? null;
}

/** 여는 태그 위치를 받아 해당 요소 전체와 내부 범위를 돌려줍니다. */
function elementRange(html: string, openStart: number) {
  const tagName = tagNameAt(html, openStart);
  if (!tagName) return null;
  const openEnd = html.indexOf(">", openStart);
  if (openEnd < 0) return null;
  const closeStart = findMatchingClose(html, openStart, tagName);
  if (closeStart < 0) return null;
  return { tagName, openEnd, closeStart, end: closeStart + `</${tagName}>`.length };
}

export function extractRootValue(html: string) {
  return html.match(/data-moire-root="([^"]+)"/)?.[1] ?? null;
}

/** MOLIVE 루트에서 헤더/푸터를 떼어냅니다. 푸터는 Cafe24 것과 중복되므로 홈 본문에서 제거합니다. */
export function splitMoireChrome(html: string) {
  let body = html;
  const take = (tagName: string) => {
    const openStart = body.search(new RegExp(`<${tagName}(?=[\\s>])`, "i"));
    if (openStart < 0) return null;
    const range = elementRange(body, openStart);
    if (!range) return null;
    const markup = body.slice(openStart, range.end);
    body = body.slice(0, openStart) + body.slice(range.end);
    return markup;
  };
  const header = take("header");
  const footer = take("footer");
  return { header, footer, body };
}

/**
 * MOLIVE 헤더의 브랜드/네비/계정 자리에 Cafe24 실제 값과 모듈을 꽂습니다.
 * Cafe24는 {$...} 변수를 module 블록 안에서만 치환하므로, 몰 이름과 로고는 Layout_LogoTop으로 감쌉니다.
 */
export function bindCafe24Header(headerHtml: string) {
  let html = headerHtml;
  const bound: string[] = [];
  for (const { bind, inner } of CAFE24_BINDINGS) {
    const mark = html.indexOf(`data-cafe24-bind="${bind}"`);
    if (mark < 0) continue;
    const openStart = html.lastIndexOf("<", mark);
    if (openStart < 0) continue;
    const range = elementRange(html, openStart);
    if (!range) continue;
    html = `${html.slice(0, range.openEnd + 1)}${inner}${html.slice(range.closeStart)}`;
    bound.push(bind);
  }
  for (const { bind, href, addClass } of CAFE24_LINK_BINDINGS) {
    const mark = html.indexOf(`data-cafe24-bind="${bind}"`);
    if (mark < 0) continue;
    const openStart = html.lastIndexOf("<", mark);
    if (openStart < 0) continue;
    const range = elementRange(html, openStart);
    if (!range) continue;
    let openTag = html.slice(openStart, range.openEnd + 1);
    if (href) {
      openTag = / href\s*=\s*"/i.test(openTag)
        ? openTag.replace(/ href\s*=\s*"[^"]*"/i, ` href="${href}"`)
        : openTag.replace(/^<([a-zA-Z0-9-]+)/, `<$1 href="${href}"`);
    }
    if (addClass) {
      openTag = / class\s*=\s*"/i.test(openTag)
        ? openTag.replace(/ class\s*=\s*"([^"]*)"/i, (_match, value: string) => ` class="${value} ${addClass}"`)
        : openTag.replace(/^<([a-zA-Z0-9-]+)/, `<$1 class="${addClass}"`);
    }
    html = html.slice(0, openStart) + openTag + html.slice(range.openEnd + 1);
    bound.push(bind);
  }
  const logo = html.match(/<img[^>]*data-cafe24-bind="logo"[^>]*>/i)?.[0];
  if (logo) {
    const bound24 = logo.replace(/src="[^"]*"/i, 'src="{$logo}"').replace(/alt="[^"]*"/i, 'alt="{$mall_name}"');
    html = html.replace(logo, `<span module="Layout_LogoTop" class="moire-logo">${bound24}</span>`);
    bound.push("logo");
  }
  return { html, bound };
}

/** MOLIVE 상품 slot 안에 Cafe24 상품 진열 module을 그대로 심습니다. */
export function replaceProductSlot(html: string, moduleHtml: string) {
  const mark = html.indexOf(SLOT_MARK);
  if (mark < 0) return { html, filled: false };
  const openStart = html.lastIndexOf("<", mark);
  if (openStart < 0) return { html, filled: false };
  const range = elementRange(html, openStart);
  if (!range) return { html, filled: false };
  return { html: `${html.slice(0, range.openEnd + 1)}\n${moduleHtml}\n${html.slice(range.closeStart)}`, filled: true };
}

/**
 * 슬롯을 순서대로 채웁니다.
 * 슬롯 안에 AI 카드(data-moire-card)가 있으면 그 구조를 Cafe24 반복 단위로 바꾸고,
 * 없으면 Guide의 원본 module을 그대로 넣습니다.
 */
export function fillProductSlots(html: string, moduleHtmls: string[]) {
  let output = "";
  let rest = html;
  let filled = 0;
  let adapted = 0;
  while (rest.includes(SLOT_MARK)) {
    const openStart = rest.lastIndexOf("<", rest.indexOf(SLOT_MARK));
    const range = openStart < 0 ? null : elementRange(rest, openStart);
    if (!range) break;
    const slotInner = rest.slice(range.openEnd + 1, range.closeStart);
    const adapter = buildProductAdapter(slotInner, filled + 1);
    const replacement = adapter ?? moduleHtmls[filled];
    if (!replacement) break;
    if (adapter) adapted += 1;
    output += `${rest.slice(0, range.openEnd + 1)}\n${replacement}\n`;
    rest = rest.slice(range.closeStart);
    filled += 1;
  }
  return { html: output + rest, filled, adapted };
}

const MODULE_CONFIG = `    <!--
        $count = {COUNT}
        $basket_result = /product/add_basket.html
        $basket_option = /product/basket_option.html
        $moreview = no
        $cache = no
    -->`;

const PRICE_ROWS = `<ul module="product_ListItem" class="{PRICE_CLASS}">
          <li class="{$item_display|display}"><strong class="{$item_title_display|display}">{$item_title}</strong> {$item_content}</li>
        </ul>`;

function attributeValue(openTag: string, name: string) {
  return openTag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i"))?.[1] ?? "";
}

function findMarked(html: string, mark: string) {
  const at = html.indexOf(mark);
  if (at < 0) return null;
  const openStart = html.lastIndexOf("<", at);
  if (openStart < 0) return null;
  const range = elementRange(html, openStart);
  if (!range) return null;
  return { openStart, openTag: html.slice(openStart, range.openEnd + 1), ...range };
}

function replaceMarkedInner(html: string, mark: string, inner: string) {
  const found = findMarked(html, mark);
  if (!found) return html;
  return `${html.slice(0, found.openEnd + 1)}${inner}${html.slice(found.closeStart)}`;
}

/**
 * AI가 만든 미리보기 카드를 Cafe24 반복 단위로 바꿉니다.
 * Cafe24가 아는 div[module] > ul > li 골격만 유지하고, 카드 안쪽은 AI 구조와 class를 그대로 씁니다.
 */
export function buildProductAdapter(slotHtml: string, moduleIndex: number, count = 8) {
  const card = findMarked(slotHtml, "data-moire-card");
  if (!card) return null;
  const listOpenStart = slotHtml.lastIndexOf("<", card.openStart - 1);
  const listTag = listOpenStart >= 0 ? tagNameAt(slotHtml, listOpenStart) : null;
  const listClass = listOpenStart >= 0 ? attributeValue(slotHtml.slice(listOpenStart, slotHtml.indexOf(">", listOpenStart) + 1), "class") : "";

  let inner = slotHtml.slice(card.openEnd + 1, card.closeStart);
  const priceClass = attributeValue(findMarked(inner, 'data-moire-bind="price"')?.openTag ?? "", "class");
  inner = replaceMarkedInner(inner, 'data-moire-bind="name"', "{$product_name}");
  inner = replaceMarkedInner(inner, 'data-moire-bind="price"', PRICE_ROWS.replace("{PRICE_CLASS}", priceClass));

  const link = findMarked(inner, 'data-moire-bind="link"');
  if (link) inner = inner.replace(link.openTag, link.openTag.replace(/\bhref\s*=\s*"[^"]*"/i, 'href="{$link_product_detail}"'));
  const image = inner.match(/<img[^>]*data-moire-bind="image"[^>]*>/i)?.[0];
  if (image) {
    inner = inner.replace(image, image
      .replace(/\bsrc\s*=\s*"[^"]*"/i, 'src="{$image_medium}"')
      .replace(/\balt\s*=\s*"[^"]*"/i, 'alt="{$seo_alt_tag}"')
      .replace(/\bsrcset\s*=\s*"[^"]*"/i, ""));
  }

  const cardClass = attributeValue(card.openTag, "class");
  const listOpen = listTag === "ul" || listTag === "ol" ? `<${listTag} class="${listClass}">` : `<ul class="${listClass}">`;
  const listClose = listTag === "ul" || listTag === "ol" ? `</${listTag}>` : "</ul>";
  return `<div module="product_listmain_${moduleIndex}" class="moire-products">
${MODULE_CONFIG.replace("{COUNT}", String(count))}
    ${listOpen}
      <li id="anchorBoxId_{$product_no}" class="${cardClass}">${inner}</li>
    ${listClose}
</div>`;
}

/** Guide 원본 index.html에서 상품 진열 module 블록을 떼어냅니다. */
export function extractProductListModule(baseIndexHtml: string, index = 1) {
  const mark = baseIndexHtml.indexOf(`module="product_listmain_${index}"`);
  if (mark < 0) return null;
  const openStart = baseIndexHtml.lastIndexOf("<div", mark);
  if (openStart < 0) return null;
  const closeStart = findMatchingClose(baseIndexHtml, openStart, "div");
  if (closeStart < 0) return null;
  return baseIndexHtml.slice(openStart, closeStart + "</div>".length);
}

export function extractProductListModules(baseIndexHtml: string, max = 8) {
  const modules: string[] = [];
  for (let index = 1; index <= max; index += 1) {
    const found = extractProductListModule(baseIndexHtml, index);
    if (found) modules.push(found);
  }
  return modules;
}

export function buildIndexHtml(patchHtml: string, moduleHtmls: string[]) {
  const chrome = splitMoireChrome(patchHtml);
  const result = fillProductSlots(chrome.body, moduleHtmls);
  let body = result.html;
  if (!result.filled && moduleHtmls.length) body = `${body}\n${moduleHtmls[0]}`;
  return {
    html: `<!--@layout(/${MOIRE_LAYOUT_PATH})-->\n${body}\n`,
    header: chrome.header,
    footerRemoved: Boolean(chrome.footer),
    slotsFilled: result.filled,
    slotsAdapted: result.adapted,
  };
}

function injectMoireCss(layout: string, options: { productSlide?: boolean } = {}) {
  const headClose = layout.indexOf("</head>");
  if (headClose < 0) throw new Error("기준 레이아웃에서 </head>를 찾지 못했습니다.");
  // Guide < AI static design < protected Header/Product/Footer 순으로 cascade를 고정합니다.
  // 상품 슬라이드 진열일 때만 Swiper init을 싣습니다. Swiper 본체(4.5.1)는 기준 스킨이 이미 싣고 있습니다.
  const slideScript = options.productSlide ? `    <!--@js(/${PRODUCT_SLIDE_SCRIPT_PATH})-->\n` : "";
  const includes = `    <!--@css(/${MOIRE_BRIDGE_CSS_PATH})-->\n    <!--@css(/${MOIRE_CSS_PATH})-->\n    <!--@css(/${MOIRE_COMMERCE_CSS_PATH})-->\n${slideScript}`;
  return `${layout.slice(0, headClose)}${includes}${layout.slice(headClose)}`;
}

/** #wrap에 MOLIVE 루트 값을 걸어 root-scoped CSS가 페이지 전체에 닿게 합니다. */
function applyGlobalRoot(layout: string, rootValue: string | null) {
  if (!rootValue || layout.includes("data-moire-root")) return layout;
  return layout.replace('<div id="wrap">', `<div id="wrap" data-moire-root="${rootValue}">`);
}

/**
 * 이 레이아웃이 홈인지 Cafe24 세부 페이지인지 #wrap에 표시합니다.
 * 세부 페이지의 본문 지면을 밝게 고정하는 CSS가 이 표식 하나만 보고 갈립니다.
 */
function markPageKind(layout: string, kind: "home" | "sub") {
  if (layout.includes("data-moire-page")) return layout;
  return layout.replace(/<div id="wrap"([^>]*)>/, (_match, attributes: string) => `<div id="wrap"${attributes} data-moire-page="${kind}">`);
}

function replaceCafe24Header(layout: string, replacement: string) {
  const headerStart = layout.indexOf('<header id="header">');
  if (headerStart < 0) return layout;
  const headerEnd = layout.indexOf("</header>", headerStart);
  if (headerEnd < 0) return layout;
  const lineEnd = layout.indexOf("\n", headerEnd);
  const after = lineEnd < 0 ? headerEnd + "</header>".length : lineEnd + 1;
  return layout.slice(0, headerStart) + replacement + layout.slice(after);
}

/** 홈 전용 레이아웃. 헤더는 MOLIVE import로 바뀌고 Cafe24 푸터는 유지합니다. */
export function buildMoireLayout(mainHtml: string, options: { rootValue?: string | null; hasMoireHeader?: boolean; productSlide?: boolean } = {}) {
  let layout = injectMoireCss(mainHtml, { productSlide: options.productSlide });
  layout = applyGlobalRoot(layout, options.rootValue ?? null);
  layout = markPageKind(layout, "home");
  layout = replaceCafe24Header(layout, options.hasMoireHeader ? `<!--@import(/${MOIRE_HEADER_PATH})-->\n` : "");
  // 홈은 Preview와 같은 full-width로 그립니다. Cafe24의 #contents/.inner 폭 제한은 이 표식으로 해제합니다.
  layout = layout.replace('<main id="contents" role="main">', '<main id="contents" role="main" data-moire-full="true">');
  for (const line of REMOVED_HOME_IMPORTS) layout = layout.split(line).join("");
  if (!INCLUDE_CAFE24_FOOTER) layout = layout.split("<!--@import(/layout/basic/footer.html)-->").join("");
  return layout.replace(/\n{3,}/g, "\n\n");
}

/** 상품상세·장바구니·회원·게시판 레이아웃. Cafe24 기능은 그대로 두고 테마만 연결합니다. */
export function buildSubLayout(layoutHtml: string, options: { rootValue?: string | null; hasMoireHeader?: boolean } = {}) {
  let layout = injectMoireCss(layoutHtml);
  layout = applyGlobalRoot(layout, options.rootValue ?? null);
  layout = markPageKind(layout, "sub");
  if (options.hasMoireHeader) layout = replaceCafe24Header(layout, `<!--@import(/${MOIRE_HEADER_PATH})-->\n`);
  return layout.replace(/\n{3,}/g, "\n\n");
}
