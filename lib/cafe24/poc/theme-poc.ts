/**
 * Cafe24 연동 검증용 deterministic POC입니다.
 * AI, ThemeSpec, 생성 HTML을 전혀 쓰지 않고 코드에 고정된 HeaderV1 / ProductGridV1만 출력합니다.
 * 어떤 단계든 실패하면 Cafe24 기본 DOM으로 물러나지 않고 즉시 예외를 던집니다.
 */

export const POC_LAYOUT_PATH = "layout/basic/moire_poc.html";
export const POC_HEADER_PATH = "layout/basic/moire_poc_header.html";
export const POC_CSS_PATH = "css/moire-poc.css";
export const BASE_LAYOUT_PATH = "layout/basic/main.html";
export const INDEX_PATH = "index.html";

/** 헤더는 logo / category / search / login-state / order / cart 순서를 코드에서 고정합니다. */
export const HEADER_V1 = `<header id="header" class="pocHeader">
  <div class="pocHeader__inner">
    <h1 class="pocHeader__logo" module="Layout_LogoTop">
      <a href="/index.html"><img src="{$logo}" alt="{$mall_name}"></a>
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

/**
 * 상품 카드는 image / productName / originalPrice / salePrice 네 가지만 씁니다.
 * 행 수가 가변인 product_ListItem을 쓰지 않고 Cafe24가 직접 노출하는 가격 변수를 고정 위치에 둡니다.
 */
export function productGridV1(moduleIndex: number, count: number) {
  return `<section class="pocGrid" data-poc-grid="v1">
  <h2 class="pocGrid__title">PRODUCT GRID V1</h2>
  <div class="pocGrid__module" module="product_listmain_${moduleIndex}">
    <!--
        $count = ${count}
        $moreview = no
        $cache = no
    -->
    <ul class="pocGrid__list">
      <li id="anchorBoxId_{$product_no}" class="pocGrid__item">
        <div class="pocGrid__thumb"><img src="{$image_medium}" id="{$image_medium_id}" alt="{$seo_alt_tag}" /></div>
        <div class="pocGrid__name">{$product_name}</div>
        <div class="pocGrid__original">{$disp_product_price}</div>
        <div class="pocGrid__sale">{$product_sale_price}</div>
      </li>
    </ul>
  </div>
</section>
`;
}

export const POC_CSS = `/* Moiré Cafe24 연동 POC. Cafe24 기본 클래스를 건드리지 않고 poc* 클래스만 씁니다. */
.pocHeader{border-bottom:1px solid #e5e2db;background:#fff;color:#171713}
.pocHeader__inner{display:flex;align-items:center;gap:32px;max-width:1440px;margin:0 auto;padding:18px 40px}
.pocHeader__logo{margin:0;font-size:0;line-height:0}
.pocHeader__logo img{display:block;height:28px;width:auto}
.pocHeader__category{flex:1;min-width:0}
.pocHeader__categoryList{display:flex;align-items:center;gap:20px;margin:0;padding:0;list-style:none}
.pocHeader__categoryList a{font:600 13px/1 system-ui,sans-serif;letter-spacing:.02em;color:inherit;text-decoration:none;white-space:nowrap}
.pocHeader__util{display:flex;align-items:center;gap:18px}
.pocHeader__state{display:flex;align-items:center;gap:18px}
.pocHeader__item{display:inline-flex;align-items:center;font:600 12px/1 system-ui,sans-serif;letter-spacing:.06em;color:inherit;text-decoration:none;white-space:nowrap;background:none;border:0;padding:0;cursor:pointer}

.pocGrid{max-width:1440px;margin:0 auto;padding:64px 40px}
.pocGrid__title{margin:0 0 24px;font:700 14px/1 system-ui,sans-serif;letter-spacing:.14em;color:#171713}
.pocGrid__list{margin:0 -12px;padding:0;list-style:none;text-align:left;font-size:0;line-height:0}
.pocGrid__list>li{display:inline-block;width:25%;padding:0 12px 32px;box-sizing:border-box;vertical-align:top}
.pocGrid__item{margin:0;color:#171713}
.pocGrid__thumb{display:block;aspect-ratio:1/1;overflow:hidden;background:#f2f0ea}
.pocGrid__thumb a{display:block;width:100%;height:100%}
.pocGrid__thumb img{display:block;width:100%;height:100%;object-fit:contain}
.pocGrid__name{margin-top:4px;font:500 14px/1.45 system-ui,sans-serif}
/* {$disp_product_price}가 기본 판매가입니다. 취소선을 넣지 않습니다. */
.pocGrid__original{font:600 15px/1.4 system-ui,sans-serif;color:#171713}
/* {$product_sale_price}는 값이 있을 때만 보조 할인가로 보입니다. */
.pocGrid__sale{font:600 13px/1.4 system-ui,sans-serif;color:#b5321f}
.pocGrid__original:empty,.pocGrid__sale:empty,.pocGrid__name:empty{display:none}
@media (max-width:1024px){.pocGrid__list>li{width:50%}}
@media (min-width:768px) and (max-width:1024px){.pocGrid__list>li{width:33.33%}}
@media (max-width:760px){.pocHeader__inner,.pocGrid{padding-left:20px;padding-right:20px}}
`;

function required(source: string, needles: string[], label: string) {
  const missing = needles.filter((needle) => !source.includes(needle));
  if (missing.length) throw new Error(`${label}에 필수 Cafe24 마크업이 없습니다: ${missing.join(", ")}`);
}

/** Cafe24 기본 헤더 블록을 POC 헤더 import로 교체합니다. 못 찾으면 실패시킵니다. */
export function buildPocLayout(mainHtml: string) {
  const headClose = mainHtml.indexOf("</head>");
  if (headClose < 0) throw new Error("기준 레이아웃에서 </head>를 찾지 못했습니다.");
  let layout = `${mainHtml.slice(0, headClose)}    <!--@css(/${POC_CSS_PATH})-->\n${mainHtml.slice(headClose)}`;

  const headerStart = layout.indexOf('<header id="header">');
  const headerEnd = layout.indexOf("</header>", headerStart);
  if (headerStart < 0 || headerEnd < 0) throw new Error("기준 레이아웃에서 Cafe24 헤더 블록을 찾지 못했습니다.");
  const lineEnd = layout.indexOf("\n", headerEnd);
  layout = layout.slice(0, headerStart) + `<!--@import(/${POC_HEADER_PATH})-->\n` + layout.slice(lineEnd < 0 ? headerEnd + 9 : lineEnd + 1);

  for (const drop of ["<!--@import(/layout/basic/topbanner.html)-->", "<!--@import(/layout/basic/sidebar.html)-->", "<!--@import(/layout/basic/quick.html)-->"]) {
    layout = layout.split(drop).join("");
  }
  layout = layout.replace('<main id="contents" role="main">', '<main id="contents" role="main" class="pocContents">');
  if (!layout.includes("<!--@contents-->")) throw new Error("POC 레이아웃에 <!--@contents-->가 없습니다.");
  return layout.replace(/\n{3,}/g, "\n\n");
}

export function buildPocIndex(moduleIndex = 1, count = 8) {
  const grid = productGridV1(moduleIndex, count);
  required(grid, [`module="product_listmain_${moduleIndex}"`, "{$image_medium}", "{$product_name}", "{$disp_product_price}", "{$product_sale_price}"], "ProductGridV1");
  // {$product_name}은 속성값으로 안전하지 않습니다. alt에는 Guide와 같이 {$seo_alt_tag}만 씁니다.
  if (/alt="\{\$(?!seo_alt_tag)/.test(grid)) throw new Error("ProductGridV1: alt 속성에는 {$seo_alt_tag}만 쓸 수 있습니다.");
  // Cafe24가 상품명을 링크로 내보내므로 카드 전체를 <a>로 감싸면 중첩 anchor가 됩니다.
  if (/<a[^>]*>(?:(?!<\/a>)[\s\S])*<a[^>]*>/.test(grid)) throw new Error("ProductGridV1: anchor를 중첩할 수 없습니다.");
  // |display 필터는 Cafe24의 .displaynone class를 출력해 요소를 통째로 숨깁니다.
  // 텍스트 출력 진단 동안에는 사용하지 않습니다.
  if (grid.includes("|display")) throw new Error("ProductGridV1: 진단 단계에서는 display 제어 class를 쓸 수 없습니다.");
  return `<!--@layout(/${POC_LAYOUT_PATH})-->\n${grid}`;
}

export function buildPocHeader() {
  required(HEADER_V1, ['module="Layout_LogoTop"', 'module="Layout_category"', 'module="Layout_statelogoff"', 'module="Layout_stateLogon"', "{$logo}", "{$mall_name}", "{$link_product_list}", "{$action_logout}"], "HeaderV1");
  return HEADER_V1;
}

/** Guide 기준 스킨 위에 POC 파일만 덮어씁니다. 기준 파일이 없으면 즉시 실패합니다. */
export function buildPocFiles(base: Map<string, Buffer>) {
  const baseLayout = base.get(BASE_LAYOUT_PATH);
  if (!baseLayout) throw new Error(`기준 스킨에 ${BASE_LAYOUT_PATH}이 없습니다.`);
  return new Map<string, Buffer>([
    [INDEX_PATH, Buffer.from(buildPocIndex(), "utf8")],
    [POC_HEADER_PATH, Buffer.from(buildPocHeader(), "utf8")],
    [POC_LAYOUT_PATH, Buffer.from(buildPocLayout(baseLayout.toString("utf8")), "utf8")],
    [POC_CSS_PATH, Buffer.from(POC_CSS, "utf8")],
  ]);
}
