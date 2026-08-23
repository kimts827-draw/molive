import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  BASE_LAYOUT_PATH,
  buildPocFiles,
  buildPocHeader,
  buildPocIndex,
  buildPocLayout,
  HEADER_V1,
  INDEX_PATH,
  POC_CSS,
  POC_CSS_PATH,
  POC_HEADER_PATH,
  POC_LAYOUT_PATH,
  productGridV1,
} from "../lib/cafe24/poc/theme-poc.ts";

const guideLayout = await readFile(`Guide/skin4/${BASE_LAYOUT_PATH}`, "utf8");

test("HeaderV1은 logo·category·search·login-state·order·cart 순서를 고정한다", () => {
  const header = buildPocHeader();
  const order = ["pocHeader__logo", "pocHeader__category", "pocHeader__search", "pocHeader__state", "pocHeader__order", "pocHeader__cart"];
  let cursor = -1;
  for (const slot of order) {
    const at = header.indexOf(slot);
    assert.ok(at > cursor, `${slot}이 정해진 순서에 없습니다`);
    cursor = at;
  }
});

test("HeaderV1의 Cafe24 변수는 모두 module 블록 안에 있다", () => {
  const header = buildPocHeader();
  for (const [variable, moduleName] of [["{$logo}", "Layout_LogoTop"], ["{$mall_name}", "Layout_LogoTop"], ["{$link_product_list}", "Layout_category"], ["{$action_logout}", "Layout_stateLogon"]] as const) {
    const at = header.indexOf(variable);
    const moduleAt = header.lastIndexOf(`module="${moduleName}"`, at);
    assert.ok(moduleAt >= 0 && moduleAt < at, `${variable}가 ${moduleName} 밖에 있습니다`);
  }
});

test("ProductGridV1은 image·상품명·정가·판매가만 노출한다", () => {
  const grid = productGridV1(1, 8);
  for (const needle of ['module="product_listmain_1"', "$count = 8", "{$image_medium}", "{$product_name}", "{$disp_product_price}", "{$product_sale_price}"]) {
    assert.ok(grid.includes(needle), needle);
  }
  assert.ok(!grid.includes("product_ListItem"), "행 수가 가변인 모듈은 쓰지 않는다");
  assert.ok(!grid.includes("{$item_content}"));
  assert.ok(!grid.includes("{$mileage_value}"));
  assert.ok(!grid.includes("prdList"), "Cafe24 기본 상품 클래스를 쓰지 않는다");
  assert.equal((grid.match(/<li id="anchorBoxId_\{\$product_no\}"/g) ?? []).length, 1, "반복 단위는 li 하나");
});

test("alt에는 속성 안전한 {$seo_alt_tag}만 쓴다", () => {
  const grid = productGridV1(1, 8);
  assert.ok(grid.includes('alt="{$seo_alt_tag}"'));
  assert.ok(!grid.includes('alt="{$product_name}"'), "{$product_name}은 마크업을 포함할 수 있어 속성값에 못 쓴다");
  assert.ok(!/alt="\{\$(?!seo_alt_tag)/.test(grid));
});

test("진단 단계에서는 링크를 쓰지 않는다", () => {
  const grid = productGridV1(1, 8);
  assert.equal((grid.match(/<a /g) ?? []).length, 0, "변수 출력만 확인하므로 anchor 없음");
});

test("요소를 숨기는 display 제어 class를 쓰지 않는다", () => {
  const grid = productGridV1(1, 8);
  assert.ok(!grid.includes("|display"), "Cafe24의 .displaynone이 붙어 텍스트가 통째로 사라진다");
  assert.ok(!grid.includes("{$product_name_display}"));
  assert.ok(!grid.includes("{$product_price_display}"));
  assert.ok(!grid.includes("{$product_sale_display}"));
});

test("텍스트 세 값이 각각 단순한 div로 출력된다", () => {
  const grid = productGridV1(1, 8);
  assert.ok(grid.includes('<div class="pocGrid__name">{$product_name}</div>'));
  assert.ok(grid.includes('<div class="pocGrid__original">{$disp_product_price}</div>'));
  assert.ok(grid.includes('<div class="pocGrid__sale">{$product_sale_price}</div>'));
});

test("ProductGridV1 CSS는 3~4열 고정이다", () => {
  assert.ok(POC_CSS.includes(".pocGrid__list{margin:0 -12px;padding:0;list-style:none;text-align:left;font-size:0;line-height:0}"));
  assert.ok(POC_CSS.includes(".pocGrid__list>li{display:inline-block;width:25%;"), "Guide PC grid4와 같은 inline-block 25% 반복 규칙을 쓴다");
  assert.ok(POC_CSS.includes("@media (min-width:768px) and (max-width:1024px){.pocGrid__list>li{width:33.33%}}"));
  assert.ok(POC_CSS.includes("@media (max-width:1024px){.pocGrid__list>li{width:50%}}"));
  assert.ok(!POC_CSS.includes(".prdList"), "Cafe24 기본 구조를 복원하지 않는다");
});

test("index.html은 POC 레이아웃을 쓰고 그리드만 담는다", () => {
  const index = buildPocIndex();
  assert.ok(index.startsWith(`<!--@layout(/${POC_LAYOUT_PATH})-->`));
  assert.ok(index.includes('data-poc-grid="v1"'));
  assert.ok(!index.includes("data-moire-root"), "AI 생성 HTML을 쓰지 않는다");
});

test("POC 레이아웃은 Cafe24 헤더를 POC 헤더로 교체하고 CSS를 싣는다", () => {
  const layout = buildPocLayout(guideLayout);
  assert.ok(layout.includes(`<!--@css(/${POC_CSS_PATH})-->`));
  assert.ok(layout.includes(`<!--@import(/${POC_HEADER_PATH})-->`));
  assert.ok(!layout.includes('<header id="header">'));
  assert.ok(layout.includes("<!--@contents-->"));
  assert.ok(!layout.includes("moire-bridge.css"), "브리지 CSS를 쓰지 않는다");
});

test("기준 레이아웃이 없거나 헤더 블록을 못 찾으면 fallback 없이 실패한다", () => {
  assert.throws(() => buildPocFiles(new Map()), /main\.html이 없습니다/);
  assert.throws(() => buildPocLayout("<html><body>no head</body></html>"), /<\/head>/);
  assert.throws(() => buildPocLayout("<html><head></head><body>no header</body></html>"), /헤더 블록을 찾지 못했습니다/);
});

test("POC는 index·헤더·레이아웃·CSS 네 파일만 덮어쓴다", () => {
  const files = buildPocFiles(new Map([[BASE_LAYOUT_PATH, Buffer.from(guideLayout, "utf8")]]));
  assert.deepEqual([...files.keys()].sort(), [POC_CSS_PATH, INDEX_PATH, POC_HEADER_PATH, POC_LAYOUT_PATH].sort());
});

test("HeaderV1은 Cafe24 기본 헤더 마크업을 재사용하지 않는다", () => {
  assert.ok(!HEADER_V1.includes("topArea__logo"));
  assert.ok(!HEADER_V1.includes("navigation__util"));
  assert.ok(!HEADER_V1.includes("@import(/layout/basic/navigation.html)"));
  assert.ok(!HEADER_V1.includes("@import(/layout/basic/state_login.html)"));
});

test("기본 판매가에는 취소선을 넣지 않는다", () => {
  const original = POC_CSS.slice(POC_CSS.indexOf(".pocGrid__original{"), POC_CSS.indexOf("}", POC_CSS.indexOf(".pocGrid__original{")));
  assert.ok(!original.includes("line-through"), "{$disp_product_price}는 기본 판매가라 취소선을 넣지 않는다");
});

test("값이 없는 가격/이름 요소는 자리를 차지하지 않는다", () => {
  assert.ok(POC_CSS.includes(".pocGrid__original:empty,.pocGrid__sale:empty,.pocGrid__name:empty{display:none}"));
});

test("검증되지 않은 소비자가 변수를 넣지 않는다", () => {
  const grid = productGridV1(1, 8);
  for (const guess of ["{$product_price}", "{$Productcustom}", "{$product_custom_price}", "{$txt_product_price_ref}"]) {
    assert.ok(!grid.includes(guess), `${guess}는 product_listmain에서 확인되지 않았다`);
  }
});
