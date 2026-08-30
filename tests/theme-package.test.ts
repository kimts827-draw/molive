import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
import {
  BASE_INDEX_PATH,
  bindCafe24Header,
  buildIndexHtml,
  buildMoireLayout,
  buildProductAdapter,
  buildSubLayout,
  extractProductListModule,
  extractProductListModules,
  extractRootValue,
  fillProductSlots,
  isServerManagedSkinFile,
  MOIRE_BRIDGE_CSS_PATH,
  MOIRE_CSS_PATH,
  MOIRE_HEADER_PATH,
  MOIRE_LAYOUT_PATH,
  replaceProductSlot,
  splitMoireChrome,
  SUB_LAYOUT_PATHS,
} from "../lib/cafe24/theme-template.ts";
import { assetFileName, collectAssetUrls, rewriteAssetUrls, themeAssetHref } from "../lib/cafe24/theme-assets.ts";
import { buildBridgeCss, buildFooterThemeCss, buildSubpageSurfaceCss, resolveFooterBackground, resolveFooterInk, resolveFooterPalette } from "../lib/cafe24/theme-bridge.ts";
import { createZip } from "../lib/zip.ts";
import { PRODUCT_SECTION_V1_CSS } from "../lib/component-library/components/product-section-v1.ts";

const guideIndex = await readFile(`Guide/skin4/${BASE_INDEX_PATH}`, "utf8");
const guideLayout = await readFile("Guide/skin4/layout/basic/main.html", "utf8");
const guideSubLayout = await readFile("Guide/skin4/layout/basic/layout.html", "utf8");

const slot = (label: string) => `<section data-cafe24-slot="product-list"><p>${label}</p></section>`;

test("Guide 원본에서 상품 진열 module만 떼어낸다", () => {
  const moduleHtml = extractProductListModule(guideIndex);
  assert.ok(moduleHtml);
  assert.ok(moduleHtml.startsWith('<div module="product_listmain_1"'));
  assert.ok(moduleHtml.endsWith("</div>"));
  assert.equal((moduleHtml.match(/<div/g) ?? []).length, (moduleHtml.match(/<\/div>/g) ?? []).length);
});

test("상품 진열 module을 여러 개 모은다", () => {
  const modules = extractProductListModules(guideIndex);
  assert.ok(modules.length >= 4);
  assert.ok(modules[0].includes('module="product_listmain_1"'));
  assert.ok(modules[1].includes('module="product_listmain_2"'));
});

test("상품 slot 안에 module을 심는다", () => {
  const result = replaceProductSlot(`<div data-moire-root="a">${slot("placeholder")}</div>`, "<div>MODULE</div>");
  assert.equal(result.filled, true);
  assert.ok(result.html.includes("MODULE"));
  assert.ok(!result.html.includes("placeholder"));
});

test("slot이 여러 개면 module을 순서대로 채운다", () => {
  const html = `<div data-moire-root="a">${slot("best")}${slot("new")}</div>`;
  const result = fillProductSlots(html, ["<div>MOD1</div>", "<div>MOD2</div>"]);
  assert.equal(result.filled, 2);
  assert.ok(result.html.indexOf("MOD1") < result.html.indexOf("MOD2"));
  assert.ok(!result.html.includes("best"));
  assert.ok(!result.html.includes("new"));
});

test("헤더와 푸터를 본문에서 떼어낸다", () => {
  const html = '<div data-moire-root="a"><header data-moire-id="h">BRAND</header><main>BODY</main><footer data-moire-id="f">사업자정보</footer></div>';
  const chrome = splitMoireChrome(html);
  assert.ok(chrome.header?.includes("BRAND"));
  assert.ok(chrome.footer?.includes("사업자정보"));
  assert.ok(chrome.body.includes("BODY"));
  assert.ok(!chrome.body.includes("BRAND"));
  assert.ok(!chrome.body.includes("사업자정보"));
});

test("홈 index에는 AI 푸터가 남지 않는다", () => {
  const built = buildIndexHtml(`<div data-moire-root="a"><header>H</header><main>${slot("p")}</main><footer>F</footer></div>`, ["<div>MODULE</div>"]);
  assert.ok(built.html.startsWith(`<!--@layout(/${MOIRE_LAYOUT_PATH})-->`));
  assert.equal(built.footerRemoved, true);
  assert.equal(built.slotsFilled, 1);
  assert.ok(built.header?.includes("H"));
  assert.ok(!built.html.includes("<footer>"));
});

test("헤더의 브랜드·네비·계정 자리에 Cafe24 값과 모듈을 꽂는다", () => {
  const header = '<header><a data-cafe24-bind="mall-name">샘플스토어</a><img data-cafe24-bind="logo" src="/x.png" alt="brand"><nav data-cafe24-bind="navigation"><a href="#">Shop</a></nav><div data-cafe24-bind="account">LOGIN</div></header>';
  const bound = bindCafe24Header(header);
  assert.ok(bound.html.includes("{$mall_name}"));
  assert.ok(!bound.html.includes("샘플스토어"));
  assert.ok(bound.html.includes('src="{$logo}"'));
  assert.ok(bound.html.includes("<!--@import(/layout/basic/navigation.html)-->"));
  assert.ok(bound.html.includes("<!--@import(/layout/basic/state_login.html)-->"));
  assert.deepEqual(bound.bound.sort(), ["account", "logo", "mall-name", "navigation"]);
});

test("bind 표시가 없으면 헤더를 그대로 둔다", () => {
  const bound = bindCafe24Header("<header><h1>BRAND</h1></header>");
  assert.equal(bound.html, "<header><h1>BRAND</h1></header>");
  assert.deepEqual(bound.bound, []);
});

test("홈 레이아웃은 MOLIVE 헤더를 import하고 Cafe24 푸터를 유지한다", () => {
  const layout = buildMoireLayout(guideLayout, { rootValue: "atelier", hasMoireHeader: true });
  assert.ok(layout.includes(`<!--@css(/${MOIRE_CSS_PATH})-->`));
  assert.ok(layout.includes(`<!--@import(/${MOIRE_HEADER_PATH})-->`));
  assert.ok(layout.includes('<div id="wrap" data-moire-root="atelier" data-moire-page="home">'));
  assert.ok(!layout.includes('<header id="header">'));
  assert.ok(layout.includes("/layout/basic/footer.html"));
  assert.ok(layout.includes("<!--@contents-->"));
});

test("서브 레이아웃은 Cafe24 기능을 유지한 채 테마만 연결한다", () => {
  const layout = buildSubLayout(guideSubLayout, { rootValue: "atelier", hasMoireHeader: true });
  assert.ok(layout.includes(`<!--@css(/${MOIRE_CSS_PATH})-->`));
  assert.ok(layout.includes('<div id="wrap" data-moire-root="atelier" data-moire-page="sub">'));
  assert.ok(layout.includes(`<!--@import(/${MOIRE_HEADER_PATH})-->`));
  assert.ok(layout.includes("/layout/basic/footer.html"));
  assert.ok(layout.includes("/layout/basic/css/common.css"));
  assert.ok(layout.includes("<!--@contents-->"));
});

test("MOLIVE 헤더가 없으면 서브 레이아웃의 Cafe24 헤더를 건드리지 않는다", () => {
  const layout = buildSubLayout(guideSubLayout, { rootValue: "atelier", hasMoireHeader: false });
  assert.ok(layout.includes('<header id="header">'));
  assert.ok(layout.includes("/layout/basic/navigation.html"));
});

test("서브 레이아웃 경로가 실제로 존재한다", async () => {
  for (const path of SUB_LAYOUT_PATHS) {
    const content = await readFile(`Guide/skin4/${path}`, "utf8");
    assert.ok(content.includes("<!--@contents-->"), path);
  }
});

test("루트 값을 읽어 글로벌 테마에 사용한다", () => {
  assert.equal(extractRootValue('<div data-moire-root="atelier-nol">x</div>'), "atelier-nol");
  assert.equal(extractRootValue("<div>x</div>"), null);
});

test("ZIP은 표준 시그니처와 항목 수를 갖는다", () => {
  const zip = createZip([
    { path: "index.html", data: Buffer.from("hello moire", "utf8") },
    { path: "css/moire.css", data: Buffer.from("body{color:red}", "utf8") },
  ]);
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  const eocd = zip.length - 22;
  assert.equal(zip.readUInt32LE(eocd), 0x06054b50);
  assert.equal(zip.readUInt16LE(eocd + 10), 2);
});

test("Cafe24가 서버에서 만드는 sitemap 파일만 제외 대상으로 본다", () => {
  for (const path of ["sitemap.xml", "sitemap0.xml.temp", "sitemap1.xml", "SITEMAP.XML"]) {
    assert.equal(isServerManagedSkinFile(path), true, path);
  }
  for (const path of ["index.html", "css/moire.css", "css/sitemap.css", "board/sitemap.xml.html"]) {
    assert.equal(isServerManagedSkinFile(path), false, path);
  }
});

test("기준 스킨의 sitemap 파일은 실제로 존재하고 전부 걸러진다", async () => {
  const names = await readdir("Guide/skin4");
  const sitemaps = names.filter((name) => name.toLowerCase().startsWith("sitemap"));
  assert.deepEqual(sitemaps.sort(), ["sitemap.xml", "sitemap0.xml.temp"]);
  assert.equal(sitemaps.every(isServerManagedSkinFile), true);
});

test("네비·계정 바인딩이 없으면 서브 레이아웃의 Cafe24 헤더를 지키는 것이 기본이다", () => {
  const layout = buildSubLayout(guideSubLayout, { rootValue: "atelier", hasMoireHeader: false });
  assert.ok(layout.includes('<header id="header">'));
  assert.ok(layout.includes("/layout/basic/state_login.html"));
  assert.ok(layout.includes(`<!--@css(/${MOIRE_CSS_PATH})-->`));
  assert.ok(layout.includes('<div id="wrap" data-moire-root="atelier" data-moire-page="sub">'));
});

test("어두운 테마 배경이면 밝은 푸터 글씨를 고른다", () => {
  const dark = resolveFooterInk('[data-moire-root="a"]{background:#14130f;color:#eee}');
  assert.equal(dark.ink, "#f5f3ee");
  assert.ok((dark.luminance ?? 1) < 0.45);
});

test("밝은 테마 배경이면 어두운 푸터 글씨를 고른다", () => {
  for (const css of ['[data-moire-root="a"]{background:#f6f4ef}', '[data-moire-root="a"]{background:rgb(255,255,255)}', '[data-moire-root="a"]{background-color:#fff}']) {
    assert.equal(resolveFooterInk(css).ink, "#1b1a17", css);
  }
});

test("배경을 못 찾으면 밝은 배경으로 보고 어두운 글씨를 쓴다", () => {
  const fallback = resolveFooterInk('[data-moire-root="a"] .card{padding:1rem}');
  assert.equal(fallback.ink, "#1b1a17");
  assert.equal(fallback.luminance, null);
});

test("브리지 CSS는 Header shell만 연결하고 verified Product/Footer palette는 소유하지 않는다", () => {
  const bridge = buildBridgeCss('[data-moire-root="a"]{background:#111}');
  assert.equal(bridge.includes("[data-cafe24-slot] .prdList"), false);
  assert.ok(bridge.includes("--moire-footer-ink:#f5f3ee"));
  assert.ok(!bridge.includes("!important"));
});

test("Footer palette는 배경과 primary/secondary/divider 색을 명시하고 inner를 1280px로 제한한다", () => {
  const dark = resolveFooterPalette('[data-moire-root="a"] footer#footer{background:#171613}');
  assert.equal(dark.background, "#171613");
  assert.equal(dark.primary, "#f5f3ee");
  const css = buildFooterThemeCss('[data-moire-root="a"] footer#footer{background:#171613}');
  for (const contract of ["background:#171613", "color:#f5f3ee", "max-width:1280px", "width:calc(100% - 64px)", "border-color:"]) assert.ok(css.includes(contract), contract);
  // Guide layout.css의 #footer:before(position:absolute;bottom:100px)가 footer를 containing block으로 갖지 못하면 PC 뷰포트의 Hero를 가로지르는 1px 선이 된다.
  assert.ok(css.includes("[data-moire-root] #footer{position:relative;"), "footer는 자신의 ::before를 위한 containing block이어야 한다");
});

test("레이아웃 cascade는 Guide < AI design < protected commerce 순서다", () => {
  const layout = buildMoireLayout(guideLayout, { rootValue: "atelier", hasMoireHeader: true });
  const bridgeAt = layout.indexOf(`<!--@css(/${MOIRE_BRIDGE_CSS_PATH})-->`);
  const themeAt = layout.indexOf(`<!--@css(/${MOIRE_CSS_PATH})-->`);
  const protectedAt = layout.indexOf("<!--@css(/css/moire-commerce.css)-->");
  assert.ok(bridgeAt > 0 && themeAt > bridgeAt && protectedAt > themeAt);
  assert.ok(layout.indexOf("/layout/basic/css/ec-base-product.css") < bridgeAt || !layout.includes("ec-base-product.css"));
});

test("background:var(--x)로 선언된 테마 색도 따라간다", () => {
  const light = resolveFooterInk('[data-moire-root="a"]{--paper:#e8e5db;background:var(--paper)}');
  assert.equal(light.ink, "#1b1a17");
  assert.ok((light.luminance ?? 0) > 0.45);
  const dark = resolveFooterInk('[data-moire-root="a"]{--ink:#12110e;background:var(--ink)}');
  assert.equal(dark.ink, "#f5f3ee");
  const fallbackValue = resolveFooterInk('[data-moire-root="a"]{background:var(--missing,#101010)}');
  assert.equal(fallbackValue.ink, "#f5f3ee");
});

test("상품 썸네일 폭은 Guide descendant selector를 쓰는 verified CSS만 소유한다", () => {
  const bridge = buildBridgeCss('[data-moire-root="a"]{background:#fff}');
  assert.equal(bridge.includes("[data-cafe24-slot] .prdList"), false);
  assert.ok(PRODUCT_SECTION_V1_CSS.includes(".thumbnail a img { width: 100%"));
  assert.equal(PRODUCT_SECTION_V1_CSS.includes(".thumbnail > a > img"), false);
});

test("푸터 대비색은 테마 루트가 아니라 푸터에 실제로 깔리는 배경으로 판단한다", () => {
  const darkFooterOnLightPage = '[data-moire-root="a"]{background:#f7f5f0}[data-moire-root="a"] #footer{background:#14130f}';
  const result = resolveFooterInk(darkFooterOnLightPage);
  assert.equal(result.from, "footer");
  assert.equal(result.ink, "#f5f3ee");

  const lightFooterOnDarkPage = '[data-moire-root="a"]{background:#111}[data-moire-root="a"] footer#footer{background:#fbfaf7}';
  const flipped = resolveFooterInk(lightFooterOnDarkPage);
  assert.equal(flipped.from, "footer");
  assert.equal(flipped.ink, "#1b1a17");
});

test("푸터 배경이 없으면 wrap, 그다음 테마 루트로 거슬러 올라간다", () => {
  const wrap = resolveFooterInk('[data-moire-root="a"]{background:#fff}[data-moire-root="a"] #wrap{background:#101010}');
  assert.equal(wrap.from, "wrap");
  assert.equal(wrap.ink, "#f5f3ee");

  const root = resolveFooterInk('[data-moire-root="a"]{background:#101010}');
  assert.equal(root.from, "root");
  assert.equal(root.ink, "#f5f3ee");

  assert.equal(resolveFooterBackground('[data-moire-root="a"] .card{padding:1rem}'), null);
  assert.equal(resolveFooterInk('[data-moire-root="a"] .card{padding:1rem}').from, "default");
});

test("푸터 배경이 여러 번 선언되면 마지막 선언을 따른다", () => {
  const css = '[data-moire-root="a"] #footer{background:#fff}[data-moire-root="a"] #footer{background:#0d0d0b}';
  assert.equal(resolveFooterInk(css).ink, "#f5f3ee");
});

test("Hero·브랜드 이미지 주소를 src/srcset/CSS url에서 모은다", () => {
  const html = '<img src="https://images.unsplash.com/a.jpg"><img srcset="https://cdn.example.com/b.webp 1x, //cdn.example.com/c.webp 2x"><img src="/SkinImg/img/local.png"><img src="data:image/png;base64,AAA">';
  const css = '[data-moire-root="a"] .hero{background-image:url("https://cdn.example.com/d.jpg")}';
  const urls = collectAssetUrls(html, css).sort();
  assert.deepEqual(urls, [
    "https://cdn.example.com/b.webp",
    "https://cdn.example.com/c.webp",
    "https://cdn.example.com/d.jpg",
    "https://images.unsplash.com/a.jpg",
  ]);
});

test("파일명은 content-type이나 확장자에서 정하고 모르면 건너뛴다", () => {
  assert.match(assetFileName("https://x.test/a", "image/jpeg") ?? "", /^[0-9a-f]{12}\.jpg$/);
  assert.match(assetFileName("https://x.test/photo.PNG", null) ?? "", /^[0-9a-f]{12}\.png$/);
  assert.match(assetFileName("https://x.test/a.jpeg", null) ?? "", /^[0-9a-f]{12}\.jpg$/);
  assert.equal(assetFileName("https://x.test/page", "text/html"), null);
  assert.equal(assetFileName("https://x.test/a", "image/jpeg"), assetFileName("https://x.test/a", "image/jpeg"));
});

test("주소를 스킨 경로로 바꾸고 프로토콜 생략형도 함께 처리한다", () => {
  const mapping = new Map([["https://cdn.example.com/hero.jpg", "abc123def456.jpg"]]);
  const html = '<img src="https://cdn.example.com/hero.jpg"><img src="//cdn.example.com/hero.jpg">';
  const rewritten = rewriteAssetUrls(html, mapping);
  assert.equal(rewritten, '<img src="/SkinImg/moire/abc123def456.jpg"><img src="/SkinImg/moire/abc123def456.jpg">');
  assert.equal(themeAssetHref("abc123def456.jpg"), "/SkinImg/moire/abc123def456.jpg");
});

test("에셋 매핑이 없으면 원본 주소를 그대로 둔다", () => {
  const html = '<img src="https://cdn.example.com/hero.jpg">';
  assert.equal(rewriteAssetUrls(html, new Map()), html);
});

const previewSlot = `<div class="grid best"><article data-moire-card class="card">
  <a data-moire-bind="link" href="/sample"><img data-moire-bind="image" src="https://cdn/x.jpg" alt="sample"></a>
  <h3 data-moire-bind="name">샘플 상품</h3>
  <div data-moire-bind="price" class="price">39,000원</div>
</article></div>`;

test("Adapter는 AI 카드 구조를 지키고 Cafe24 변수만 주입한다", () => {
  const module = buildProductAdapter(previewSlot, 2);
  assert.ok(module);
  assert.ok(module.includes('<div module="product_listmain_2"'));
  assert.ok(module.includes("$count = 8"));
  assert.ok(module.includes('<ul class="grid best">'));
  assert.ok(module.includes('<li id="anchorBoxId_{$product_no}" class="card">'));
  assert.ok(module.includes('href="{$link_product_detail}"'));
  assert.ok(module.includes('src="{$image_medium}"'));
  assert.ok(module.includes("{$product_name}"));
  assert.ok(!module.includes("샘플 상품"));
  assert.ok(!module.includes("https://cdn/x.jpg"));
});

test("가격 자리는 여러 줄을 내보내는 product_ListItem으로 바뀐다", () => {
  const module = buildProductAdapter(previewSlot, 1) ?? "";
  assert.ok(module.includes('<ul module="product_ListItem" class="price">'));
  assert.ok(module.includes("{$item_title}"));
  assert.ok(module.includes("{$item_content}"));
  assert.ok(!module.includes("39,000원"));
});

test("카드 표시가 없으면 Guide 원본 module로 되돌아간다", () => {
  assert.equal(buildProductAdapter('<div><p>no card</p></div>', 1), null);
  const fallback = fillProductSlots(`<div data-moire-root="a">${slot("plain")}</div>`, ["<div>GUIDE_MODULE</div>"]);
  assert.equal(fallback.filled, 1);
  assert.equal(fallback.adapted, 0);
  assert.ok(fallback.html.includes("GUIDE_MODULE"));
});

test("슬롯마다 Adapter를 쓰고 module 번호를 순서대로 매긴다", () => {
  const html = `<div data-moire-root="a"><section data-cafe24-slot="product-list">${previewSlot}</section><section data-cafe24-slot="product-list">${previewSlot}</section></div>`;
  const result = fillProductSlots(html, []);
  assert.equal(result.filled, 2);
  assert.equal(result.adapted, 2);
  assert.ok(result.html.includes('module="product_listmain_1"'));
  assert.ok(result.html.includes('module="product_listmain_2"'));
});

test("홈 레이아웃은 Cafe24 폭 제한을 해제할 표식을 단다", () => {
  const layout = buildMoireLayout(guideLayout, { rootValue: "atelier", hasMoireHeader: true });
  assert.ok(layout.includes('<main id="contents" role="main" data-moire-full="true">'));
  const bridge = buildBridgeCss('[data-moire-root="a"]{background:#fff}');
  assert.ok(bridge.includes("[data-moire-root] main#contents[data-moire-full]{max-width:none;margin:0;padding:0}"));
  assert.equal(bridge.includes("--moire-content-max"), false);
  assert.equal(bridge.includes('section[data-moire-type="section"]'), false);
  assert.equal(bridge.includes("[data-moire-root] #container{"), false);
  assert.equal(bridge.includes("#contents[data-moire-full] .inner"), false);
});

test("푸터 SNS 아이콘은 잉크가 밝을 때만 반전된다", () => {
  const dark = buildBridgeCss('[data-moire-root="a"]{background:#111}');
  assert.ok(dark.includes("--moire-footer-icon-filter:invert(1) brightness(1.8)"));
  const light = buildBridgeCss('[data-moire-root="a"]{background:#fff}');
  assert.ok(light.includes("--moire-footer-icon-filter:none"));
  assert.ok(light.includes("#footer .sns img"));
});

test("카테고리·계정은 모듈로 바뀌고 유틸 링크는 목적지만 연결된다", () => {
  const header = '<header><div data-cafe24-bind="category">C</div><button data-cafe24-bind="search">S</button><a data-cafe24-bind="mypage">M</a><a data-cafe24-bind="wishlist">W</a><div data-cafe24-bind="account">A</div></header>';
  const bound = bindCafe24Header(header);
  assert.ok(bound.html.includes('module="Layout_category"'), "카테고리는 모듈로 교체");
  assert.ok(bound.html.includes("/layout/basic/state_login.html"), "계정 블록은 Cafe24 모듈로 교체");
  assert.ok(bound.html.includes('href="/myshop/index.html"'));
  assert.ok(bound.html.includes('href="/myshop/wish_list.html"'));
  assert.ok(bound.html.includes("btnSearch eSearch"));
  assert.ok(bound.html.includes(">S<") && bound.html.includes(">M<") && bound.html.includes(">W<"), "유틸 라벨은 AI 것 유지");
  assert.deepEqual(bound.bound.sort(), ["account", "category", "mypage", "search", "wishlist"]);
});

test("Cafe24 변수는 module 블록 안에서만 치환되므로 몰 이름·로고를 Layout_LogoTop으로 감싼다", () => {
  const header = '<header><span data-cafe24-bind="mall-name">브랜드</span><img data-cafe24-bind="logo" src="/x.png" alt="brand"></header>';
  const bound = bindCafe24Header(header);
  const nameAt = bound.html.indexOf("{$mall_name}");
  const moduleAt = bound.html.lastIndexOf('module="Layout_LogoTop"', nameAt);
  assert.ok(moduleAt >= 0, "몰 이름이 Layout_LogoTop 안에 있어야 합니다");
  assert.match(bound.html, /<span module="Layout_LogoTop"[^>]*><img[^>]*src="\{\$logo\}"/);
  assert.equal((bound.html.match(/module="Layout_LogoTop"/g) ?? []).length, 2);
});

test("흰 줄 방지와 헤더 정렬 규칙이 브리지에 들어간다", () => {
  const bridge = buildBridgeCss('[data-moire-root="a"]{background:#111}');
  assert.ok(bridge.includes('[data-moire-root]:not([data-moire-page="sub"]) #container,[data-moire-root]:not([data-moire-page="sub"]) #contents'));
  assert.ok(bridge.includes("[data-moire-root] hr.layout,[data-moire-root] hr{display:none}"));
  assert.ok(bridge.includes("[data-moire-root] [data-cafe24-bind]{display:inline-flex"));
  assert.ok(bridge.includes('[data-moire-root] [data-cafe24-bind] ul{display:inline-flex'));
});

test("legacy adapter 가격 규칙만 bridge에 남고 verified Product spec은 침범하지 않는다", () => {
  const bridge = buildBridgeCss('[data-moire-root="a"]{background:#fff}');
  assert.ok(bridge.includes('[data-moire-root] .moire-products [module="product_ListItem"] *{margin:0'));
  assert.equal(bridge.includes("[data-cafe24-slot] .prdList .spec"), false);
  assert.equal(bridge.includes("[data-cafe24-slot] .prdList .description"), false);
});

test("유틸 링크는 AI 라벨을 지키고 목적지만 연결한다", () => {
  const header = '<header><a data-cafe24-bind="mypage" class="util" href="#">MY</a><a data-cafe24-bind="cart" href="#">CART</a><button data-cafe24-bind="search" class="util">SEARCH</button></header>';
  const bound = bindCafe24Header(header);
  assert.ok(bound.html.includes(">MY<"), "AI 라벨 유지");
  assert.ok(bound.html.includes(">CART<"));
  assert.ok(bound.html.includes(">SEARCH<"));
  assert.ok(bound.html.includes('href="/myshop/index.html"'));
  assert.ok(bound.html.includes('href="/order/basket.html"'));
  assert.ok(bound.html.includes('class="util btnSearch eSearch"'));
  assert.ok(!bound.html.includes("마이쇼핑"), "Cafe24 기본 라벨을 밀어넣지 않는다");
  assert.deepEqual(bound.bound.sort(), ["cart", "mypage", "search"]);
});

test("bridge는 verified 상품 카드에 layout 규칙을 적용하지 않는다", () => {
  const bridge = buildBridgeCss('[data-moire-root="a"]{background:#111}');
  assert.ok(!/\[data-moire-root\].*\.prdList/.test(bridge));
});

test("홈 본문 글자색만 테마를 따르고 세부 페이지는 Cafe24 색을 지킨다", () => {
  const bridge = buildBridgeCss('[data-moire-root="a"]{background:#111}');
  assert.ok(bridge.includes('[data-moire-root]:not([data-moire-page="sub"]) a{color:inherit}'));
  assert.ok(bridge.includes('[data-moire-root]:not([data-moire-page="sub"]) h1,'));
  assert.ok(bridge.includes('[data-moire-root]:not([data-moire-page="sub"]) td,'));
  // 세부 페이지에는 색 상속 blanket이 한 줄도 걸리지 않습니다.
  assert.equal(bridge.includes("[data-moire-root] a{color:inherit}"), false);
  assert.equal(bridge.includes("[data-moire-root] h1,"), false);
});

test("세부 페이지 본문은 밝은 지면으로 고정되고 브랜드 색은 accent로만 남는다", () => {
  const css = buildSubpageSurfaceCss();
  assert.ok(css.includes('[data-moire-root][data-moire-page="sub"] #container{background-color:#ffffff'));
  assert.ok(css.includes("color:#1b1a17"));
  assert.ok(css.includes('[data-moire-root][data-moire-page="sub"] #container [class^="btnSubmit"]{background-color:var(--molive-brand,#000000)'));
  // 세부 페이지 본문 글자를 흰색으로 덮는 규칙은 만들지 않습니다.
  assert.equal(/color:\s*(#fff|#ffffff|white)/i.test(css.replace(/--molive-brand-on,#ffffff/g, "")), false);
});
