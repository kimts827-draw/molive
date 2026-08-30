import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { commerceCss, renderHeaderV1, resolveLegacyComposition, type HeaderVariant } from "../lib/commerce/fixed-components.ts";
import { HEADER_STRUCTURES } from "../lib/design-library/variants.ts";
import { INDUSTRY_PROFILES } from "../lib/design-library/industry.ts";
import { resolveEditorIntent } from "../lib/editor/style-intent.ts";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

/** Cafe24 기본 스킨 상단 레이아웃(reference/cafe24-headers)과 MOLIVE variant의 대응입니다. */
const CAFE24_TOP_MAP = [
  { top: "Top1", token: "layout00", name: "1단 기본형", variant: "split-utility" },
  { top: "Top2", token: "layout01", name: "1단 로고 중앙형", variant: "logo-center-row" },
  { top: "Top3", token: "layout04", name: "2단 좌측형", variant: "stacked-left" },
  { top: "Top4", token: "layout02", name: "2단 혼합형", variant: "stacked-split" },
  { top: "Top5", token: "layout03", name: "2단 중앙형", variant: "centered-brand" },
] as const;

const ALL_VARIANTS: HeaderVariant[] = ["split-utility", "logo-center-row", "stacked-left", "stacked-split", "centered-brand", "overlay-minimal"];
const NEW_VARIANTS: HeaderVariant[] = ["logo-center-row", "stacked-left", "stacked-split"];
const css = commerceCss();

/** variant 블록만 잘라 냅니다. 공통 선언을 건드렸는지 확인할 때 씁니다. */
function variantBlock(variant: HeaderVariant) {
  return css
    .split("\n")
    .filter((line) => line.includes(`.pocHeader--${variant}`) && !line.startsWith("@media"))
    .join("\n");
}

test("Cafe24 Top1~5가 6개 Header variant로 모두 대응된다", () => {
  assert.equal(new Set(CAFE24_TOP_MAP.map((row) => row.variant)).size, CAFE24_TOP_MAP.length);
  for (const row of CAFE24_TOP_MAP) {
    assert.ok(ALL_VARIANTS.includes(row.variant as HeaderVariant), row.top);
    assert.ok(HEADER_STRUCTURES[row.variant as keyof typeof HEADER_STRUCTURES], row.variant);
  }
  // Top6(layout05 슬라이딩 메뉴 노출형)은 Side Header 작업에서 다루므로 아직 없습니다.
  assert.equal(ALL_VARIANTS.length, 6);
  assert.equal(Object.keys(HEADER_STRUCTURES).length, 6);
});

test("6종 모두 같은 Header DOM과 Cafe24 binding을 그대로 쓴다", () => {
  // 현재 legacy Header는 장바구니 수량 module(Layout_orderBasketcount)을 쓰지 않습니다. 이번 배치 변경의 범위 밖입니다.
  const contracts = ["Layout_LogoTop", "Layout_category", "Layout_statelogoff", "Layout_stateLogon"];
  const nodes = ["pocHeader__logo", "pocHeader__category", "pocHeader__util", "btnSearch eSearch", "/member/login.html", "/member/agreement.html", "/myshop/order/list.html", "/order/basket.html", "{$link_product_list}", "{$name_or_img_tag}", "{$action_logout}"];
  const shapes = new Set<string>();
  for (const variant of ALL_VARIANTS) {
    const cafe24 = renderHeaderV1("cafe24", variant);
    const preview = renderHeaderV1("preview", variant);
    assert.ok(cafe24.includes(`data-header-variant="${variant}"`), variant);
    assert.ok(preview.includes(`data-header-variant="${variant}"`), variant);
    for (const contract of [...contracts, ...nodes]) assert.ok(cafe24.includes(contract), `${variant}: ${contract}`);
    assert.ok(!/\{\$/.test(preview), `${variant}: Preview binding`);
    // variant 토큰만 빼면 6종의 마크업이 완전히 같아야 합니다.
    shapes.add(cafe24.replaceAll(variant, "__V__"));
  }
  assert.equal(shapes.size, 1, "Header DOM은 variant와 무관하게 하나여야 합니다.");
});

test("신규 3종은 Cafe24 원본 배치를 그대로 옮긴다", () => {
  // Top2 layout01: 내비 좌 · 로고 중앙 · 유틸 우 (불투명)
  assert.match(css, /\.pocHeader--logo-center-row \.pocHeader__inner\{display:grid;grid-template-columns:1fr auto 1fr/);
  assert.match(css, /\.pocHeader--logo-center-row \.pocHeader__logo\{grid-column:2;justify-self:center\}/);
  assert.match(css, /\.pocHeader--logo-center-row \.pocHeader__category\{grid-column:1;grid-row:1;justify-self:start\}/);
  assert.match(css, /\.pocHeader--logo-center-row \.pocHeader__util\{grid-column:3;grid-row:1;justify-self:end\}/);
  // Top3 layout04: 로고 좌 + 유틸 우 / 내비 좌
  assert.match(css, /\.pocHeader--stacked-left \.pocHeader__inner\{[^}]*grid-template-areas:"logo utility" "category category"/);
  assert.match(css, /\.pocHeader--stacked-left \.pocHeader__logo\{grid-area:logo;justify-self:start\}/);
  assert.match(css, /\.pocHeader--stacked-left \.pocHeader__category\{grid-area:category;justify-self:start\}/);
  assert.match(css, /\.pocHeader--stacked-left \.pocHeader__util\{grid-area:utility;justify-self:end;align-self:center\}/);
  // Top4 layout02: 로고 중앙 / 유틸 좌 + 내비 우
  assert.match(css, /\.pocHeader--stacked-split \.pocHeader__inner\{[^}]*grid-template-areas:"logo logo" "utility category"/);
  assert.match(css, /\.pocHeader--stacked-split \.pocHeader__logo\{grid-area:logo;justify-self:center\}/);
  assert.match(css, /\.pocHeader--stacked-split \.pocHeader__util\{grid-area:utility;justify-self:start;align-self:center\}/);
  assert.match(css, /\.pocHeader--stacked-split \.pocHeader__category\{grid-area:category;justify-self:end\}/);
});

test("신규 variant는 placement 속성만 선언하고 utility 치수는 건드리지 않는다", () => {
  const placement = new Set(["display", "grid-template-columns", "grid-template-areas", "grid-column", "grid-row", "grid-area", "justify-self", "align-self", "gap", "row-gap", "padding"]);
  for (const variant of NEW_VARIANTS) {
    const block = variantBlock(variant);
    assert.ok(block.length > 0, variant);
    for (const declaration of block.matchAll(/\{([^}]*)\}/g)) {
      for (const rule of declaration[1].split(";").filter(Boolean)) {
        const property = rule.split(":")[0].trim();
        assert.ok(placement.has(property), `${variant}: placement 밖의 속성 ${property}`);
      }
    }
    // 아이콘 크기·hit area·간격·수직정렬·line-height는 공통 선언이 소유합니다.
    for (const forbidden of [".pocHeader__item", ".pocHeader__state{", ".pocHeader__search", ".pocHeader__cart", ".pocHeader__order", "line-height", "font-size", "letter-spacing", "height:"]) {
      assert.ok(!block.includes(forbidden), `${variant}: ${forbidden}는 variant가 바꾸면 안 됩니다.`);
    }
  }
});

test("utility 공통 안정값과 배경·tone·overlay 계약은 그대로다", () => {
  assert.match(css, /\.pocHeader__util\{display:flex;align-items:center;gap:18px\}/);
  assert.match(css, /\.pocHeader__state\{display:flex;align-items:center;gap:18px\}/);
  assert.match(css, /\.pocHeader__item\{display:inline-flex;align-items:center;font:600 12px\/1 [^;]*;letter-spacing:\.06em/);
  assert.match(css, /\.pocHeader__logo img\{display:block;height:28px;width:auto\}/);
  assert.match(css, /\.pocHeader__categoryList\{display:flex;align-items:center;gap:20px/);
  assert.match(css, /\.pocHeader__inner\{display:flex;align-items:center;gap:32px[^}]*width:calc\(100% - 64px\)[^}]*max-width:1280px/);
  // overlay는 신규 variant가 아니라 overlay-minimal만 갖습니다.
  assert.match(css, /#header\.pocHeader--overlay-minimal\{position:absolute[^}]*background:transparent/);
  for (const variant of NEW_VARIANTS) assert.ok(!variantBlock(variant).includes("transparent"), variant);
  // 배경색은 header 공통 선언이 소유합니다.
  assert.match(css, /#header\.pocHeader\{[^}]*background:#ffffff/);
});

test("모바일에서는 6종이 같은 헤더로 접힌다", () => {
  const mobile = css.slice(css.indexOf("@media (max-width:767px)"));
  assert.ok(mobile.includes(".pocHeader__category{display:none}"));
  assert.ok(mobile.includes(".pocHeader__order,.pocHeader__state{display:none}"));
  for (const variant of ["centered-brand", "overlay-minimal", ...NEW_VARIANTS]) {
    assert.ok(mobile.includes(`.pocHeader--${variant} .pocHeader__inner`), `${variant}: 모바일 열 구성`);
  }
  // 2단 variant는 모바일에서 한 줄(로고 좌 · 유틸 우)로 접힙니다.
  for (const variant of ["centered-brand", "stacked-left", "stacked-split"]) {
    assert.ok(mobile.includes(`.pocHeader--${variant} .pocHeader__inner`), variant);
  }
  assert.match(mobile, /grid-template-areas:"logo utility";row-gap:0;padding:16px 0/);
  // 로고는 좌, 유틸은 우로 통일됩니다.
  for (const variant of ["logo-center-row", "stacked-split"]) {
    assert.ok(mobile.includes(`.pocHeader--${variant} .pocHeader__logo`), `${variant}: 로고 좌측 정렬`);
    assert.ok(mobile.includes(`.pocHeader--${variant} .pocHeader__util`), `${variant}: 유틸 우측 정렬`);
  }
});

test("저장된 architecture와 알 수 없는 값 처리는 그대로다", () => {
  for (const variant of ALL_VARIANTS) {
    assert.equal(resolveLegacyComposition({ header: variant }).headerVariant, variant);
  }
  assert.equal(resolveLegacyComposition({ header: "layout05" }).headerVariant, "split-utility");
  assert.equal(resolveLegacyComposition({}).headerVariant, "split-utility");
  assert.throws(() => renderHeaderV1("cafe24", "layout05" as HeaderVariant), /지원하지 않는 HeaderV1 variant/);
});

test("Editor는 6종을 모두 노출하고 AI 후보 풀에도 신규 3종이 들어간다", async () => {
  const editor = await read("components/editor/editor-shell.tsx");
  for (const variant of ALL_VARIANTS) {
    assert.ok(editor.includes(`value: "${variant}"`), `Editor 선택지 ${variant}`);
  }
  const pooled = new Set(Object.values(INDUSTRY_PROFILES).flatMap((profile) => profile.headerPool));
  for (const variant of NEW_VARIANTS) assert.ok(pooled.has(variant as never), `AI 후보 풀 ${variant}`);
  const generator = await read("lib/openai/site-generator.ts");
  for (const variant of ALL_VARIANTS) assert.ok(generator.includes(variant), `site-generator enum ${variant}`);
});

test("Editor 한국어 요청이 6종으로 결정적으로 갈린다", () => {
  const node = { tagName: "header", type: "header", isHeader: true };
  const cases: [string, HeaderVariant][] = [
    ["헤더를 두 줄 좌측으로", "stacked-left"],
    ["헤더 두 줄 혼합형으로 바꿔줘", "stacked-split"],
    ["헤더를 두 줄로", "centered-brand"],
    ["헤더 한 줄인데 로고는 가운데로", "logo-center-row"],
    ["헤더를 가운데 정렬로", "centered-brand"],
    ["헤더를 한 줄로", "split-utility"],
    ["헤더를 투명하게 겹쳐줘", "overlay-minimal"],
  ];
  for (const [prompt, expected] of cases) {
    const intent = resolveEditorIntent({ prompt, node });
    assert.equal(intent?.kind, "header-variant", prompt);
    assert.equal(intent?.kind === "header-variant" ? intent.variant : null, expected, prompt);
  }
});

test("Preview와 ZIP이 같은 Header CSS·같은 variant를 쓴다", async () => {
  const preview = await read("lib/editor/preview-document.ts");
  const theme = await read("lib/cafe24/theme-package.ts");
  // 두 경로 모두 같은 함수에 같은 인자를 넘깁니다. 헤더 CSS는 하나의 출처만 갖습니다.
  for (const source of [preview, theme]) {
    assert.match(source, /commerceCss\((?:document|source)\.commerce, composition\.headerVariant\)/);
    assert.match(source, /headerTextToneCss\((?:document|source)\.headerTextTone \?\? "dark"\)/);
    // 로고·띠배너 CSS는 값이 있을 때만, 두 경로 모두 같은 조건으로 실립니다.
    assert.match(source, /headerPresentation \? .*headerPresentationCss\((?:document|source)\.headerPresentation\).*: ""/);
    assert.match(source, /resolveLegacyComposition\((?:document|source)\.architecture\)/);
    assert.match(source, /renderProjectHeaderV1\("(?:preview|cafe24)", (?:document|source|exportSource)\)/);
  }
  // 같은 variant면 두 target의 Header 마크업이 Cafe24 변수 치환만 빼고 완전히 같습니다.
  const PREVIEW_BINDINGS: ReadonlyArray<readonly [string, string]> = [
    ["{$link_product_list}", "/product/list.html?cate_no=24"],
    ["{$name_or_img_tag}", "SHOP"],
    ["{$action_logout}", "/index.html"],
  ];
  for (const variant of ALL_VARIANTS) {
    const preview = renderHeaderV1("preview", variant, "BRAND");
    let bound = renderHeaderV1("cafe24", variant, "BRAND");
    for (const [token, value] of PREVIEW_BINDINGS) bound = bound.replaceAll(token, value);
    assert.equal(preview, bound, variant);
  }
});
