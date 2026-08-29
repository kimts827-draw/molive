import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  ACHROMATIC_SATURATION,
  RESERVED_MOIRE_VARIABLES,
  brandRamp,
  brandThemeCss,
  contrastRatio,
  deriveSecondary,
  footerBrandBackground,
  onColor,
  parseHex,
  SURFACE_FAMILIES,
  resolveProjectPalette,
  rgbToHsl,
  surfaceTokens,
  type BrandPalette,
} from "../lib/commerce/brand-theme.ts";
import { commerceCss } from "../lib/commerce/fixed-components.ts";
import { buildEditorPreviewDocument } from "../lib/editor/preview-document.ts";
import type { ProjectSource } from "../lib/project-source.ts";

function palette(overrides: Partial<BrandPalette> = {}): BrandPalette {
  return { brandColor: "#0044ff", colorStrategy: "band", surfaceFamily: "white", ...overrides };
}

test("brand color 변수는 입력 hex를 그대로 싣고 전용 namespace만 쓴다", () => {
  const css = brandThemeCss(palette({ brandColor: "#0044FF" }));
  assert.match(css, /--molive-brand:#0044ff/);
  for (const name of ["--molive-brand-strong", "--molive-brand-tint", "--molive-brand-soft", "--molive-brand-on", "--molive-neutral-ink", "--molive-line", "--molive-raised", "--molive-radius"]) {
    assert.ok(css.includes(`${name}:`), name);
  }
  // 신규 변수는 전부 --molive- prefix여야 합니다.
  for (const declared of css.matchAll(/(--[a-z0-9-]+)\s*:/gi)) {
    assert.ok(declared[1].startsWith("--molive-"), `예상 밖의 변수 선언: ${declared[1]}`);
  }
});

test("brand 변수는 [data-moire-root]에만 선언하고 전역 selector를 쓰지 않는다", () => {
  const css = brandThemeCss(palette());
  const selectors = [...css.matchAll(/^([^{@\n/][^{]*)\{/gm)].map((match) => match[1].trim());
  assert.deepEqual(selectors, ["[data-moire-root]"]);
  assert.doesNotMatch(css, /(^|[\s,}])(:root|html|body)\b/);
});

test("brand theme은 theme-bridge가 소유한 기존 --moire-* 변수를 건드리지 않는다", () => {
  const css = brandThemeCss(palette());
  for (const reserved of RESERVED_MOIRE_VARIABLES) {
    assert.ok(!css.includes(reserved), `예약 변수를 재선언했습니다: ${reserved}`);
  }
  // Header/상품 카드 selector에는 어떤 규칙도 쓰지 않습니다.
  for (const selector of [".pocHeader", ".prdList", ".thumbnail", ".ec-base-product", ".moireProductSection"]) {
    assert.ok(!css.includes(selector), selector);
  }
});

test("brand theme을 붙여도 HeaderV1 CSS는 한 글자도 달라지지 않는다", () => {
  const tokens = { variant: "minimal" as const, ink: "#171713", surface: "#ffffff", accent: "#0044ff" };
  const before = commerceCss(tokens, "split-utility");
  brandThemeCss(palette({ brandColor: "#0044ff" }));
  const after = commerceCss(tokens, "split-utility");
  assert.equal(after, before);
  // Header는 브랜드 변수를 읽지 않으므로 값이 바뀌어도 참조가 생기지 않습니다.
  assert.ok(!before.includes("--molive-"));
});

test("브랜드 색이 없거나 hex가 아니면 아무 CSS도 만들지 않는다", () => {
  assert.equal(brandThemeCss(null), "");
  assert.equal(brandThemeCss(undefined), "");
  assert.equal(brandThemeCss(palette({ brandColor: "blue" })), "");
  assert.equal(brandThemeCss(palette({ brandColor: "" })), "");
});

test("3자리 hex와 6자리 hex를 같은 색으로 읽는다", () => {
  assert.deepEqual(parseHex("#04f"), parseHex("#0044ff"));
  assert.equal(parseHex("#0044ff")?.b, 255);
  assert.equal(parseHex("nope"), null);
});

test("텍스트 색은 WCAG 대비가 큰 쪽으로 결정된다", () => {
  assert.equal(onColor("#0044ff"), "#ffffff");
  assert.equal(onColor("#ffe600"), "#141310");
  const brand = parseHex("#0044ff");
  const chosen = parseHex(onColor("#0044ff"));
  assert.ok(brand && chosen && contrastRatio(brand, chosen) >= 4.5);
});

test("duotone secondary는 결정적이고 hue를 150도 돌리며 채도·명도를 범위 안으로 눌러 준다", () => {
  const first = deriveSecondary("#0044ff");
  assert.equal(first, deriveSecondary("#0044ff"), "같은 입력은 항상 같은 결과여야 합니다");
  const source = rgbToHsl(parseHex("#0044ff")!);
  const derived = rgbToHsl(parseHex(first!)!);
  const rotation = ((derived.h - source.h) + 360) % 360;
  assert.ok(Math.abs(rotation - 150) <= 2, `hue 회전이 150도가 아닙니다: ${rotation}`);
  assert.ok(derived.s >= 0.18 && derived.s <= 0.72, `채도 clamp 위반: ${derived.s}`);
  assert.ok(derived.l >= 0.38 && derived.l <= 0.62, `명도 clamp 위반: ${derived.l}`);
});

test("무채색 입력은 hue 회전 대신 명도를 벌린 중성색으로 파생한다", () => {
  const grey = "#888888";
  assert.ok(rgbToHsl(parseHex(grey)!).s < ACHROMATIC_SATURATION);
  const secondary = deriveSecondary(grey);
  const derived = rgbToHsl(parseHex(secondary!)!);
  assert.ok(derived.s < ACHROMATIC_SATURATION, "무채색은 채도를 만들지 않습니다");
  assert.ok(Math.abs(derived.l - rgbToHsl(parseHex(grey)!).l) > 0.2, "명도가 벌어져야 합니다");
  assert.equal(deriveSecondary("nope"), null);
});

test("colorStrategy가 푸터 브랜드 적용을 가른다", () => {
  const ramp = brandRamp("#0044ff")!;
  assert.equal(footerBrandBackground(palette({ colorStrategy: "dominant" })), ramp.brand);
  assert.equal(footerBrandBackground(palette({ colorStrategy: "band" })), ramp.tint);
  for (const strategy of ["accent-only", "duotone", "monochrome"] as const) {
    assert.equal(footerBrandBackground(palette({ colorStrategy: strategy })), null, strategy);
  }
  assert.equal(footerBrandBackground(null), null);
});

test("램프는 밝기 순서를 지켜 밴드와 본색이 서로 구분된다", () => {
  const ramp = brandRamp("#0044ff")!;
  const lightness = (hex: string) => rgbToHsl(parseHex(hex)!).l;
  assert.ok(lightness(ramp.tint) > lightness(ramp.soft));
  assert.ok(lightness(ramp.soft) > lightness(ramp.brand));
  assert.ok(lightness(ramp.brand) > lightness(ramp.strong));
  assert.ok(lightness(ramp.raised) > lightness(ramp.line));
  assert.equal(brandRamp("nope"), null);
});

test("palette가 없는 기존 프로젝트는 commerce.accent를 브랜드 색으로 읽되 푸터를 바꾸지 않는다", () => {
  const legacy = resolveProjectPalette({ commerce: { accent: "#B5321F" } });
  assert.equal(legacy?.brandColor, "#b5321f");
  assert.equal(legacy?.colorStrategy, "accent-only");
  assert.equal(footerBrandBackground(legacy), null, "기존 프로젝트의 푸터 외형은 그대로여야 합니다");
  assert.equal(resolveProjectPalette({ commerce: { accent: "not-a-color" } }), null);
  assert.equal(resolveProjectPalette(null), null);
});

test("page plan의 palette가 있으면 commerce.accent보다 우선한다", () => {
  const resolved = resolveProjectPalette({
    commerce: { accent: "#b5321f" },
    pagePlan: { palette: { brandColor: "#0044ff", colorStrategy: "dominant", surfaceFamily: "tinted" } },
  });
  assert.equal(resolved?.brandColor, "#0044ff");
  assert.equal(resolved?.colorStrategy, "dominant");
});

const brandedSource = {
  id: "brand-theme-preview",
  name: "Brand Theme Preview",
  html: '<main data-moire-id="main" data-moire-type="section"><h1 data-moire-id="h" data-moire-type="text">Brand</h1><section data-moire-id="p" data-moire-type="products" data-cafe24-slot="product-list"></section></main>',
  css: '[data-moire-root="brand-theme"] main{color:#123456}',
  architecture: { header: "split-utility", hero: "full-bleed", sections: ["cta/statement-text — 지금"], productPresentation: "grid-four", typography: "sans", footer: "ink" },
  commerce: { accent: "#0044ff", radius: "12px" },
  updatedAt: "2026-08-29T00:00:00.000Z",
} as unknown as ProjectSource;

test("Preview 문서는 브랜드 변수를 AI CSS 뒤에 실어 준다", () => {
  const preview = buildEditorPreviewDocument(brandedSource);
  assert.ok(preview.srcDoc.includes("--molive-brand:#0044ff"), "브랜드 색이 Preview에 실려야 합니다");
  assert.ok(preview.srcDoc.includes("--molive-radius:12px"), "commerce.radius가 브랜드 반경으로 이어져야 합니다");
  // AI CSS보다 뒤에 와야 동률 명시도에서 코드가 이깁니다.
  assert.ok(preview.srcDoc.indexOf("--molive-brand:") > preview.srcDoc.indexOf("main{color:#123456}"));
  // Header와 상품 카드는 브랜드 변수를 읽지 않습니다.
  assert.ok(!/\.pocHeader[^{]*\{[^}]*--molive-/.test(preview.srcDoc));
  assert.ok(!/\.prdList[^{]*\{[^}]*--molive-/.test(preview.srcDoc));
});

test("Cafe24 export도 같은 브랜드 CSS를 protected 레이어 맨 뒤에 담는다", async () => {
  // theme-package는 @/lib alias를 써서 test 러너가 직접 import할 수 없으므로 조합 계약을 소스로 검증합니다.
  // moire-commerce.css가 moire.css(AI CSS) 뒤에 실린다는 cascade는 theme-package.test.ts가 따로 고정합니다.
  const source = await readFile(new URL("../lib/cafe24/theme-package.ts", import.meta.url), "utf8");
  assert.ok(source.includes('from "@/lib/commerce/brand-theme"'), "브랜드 테마를 export 경로가 import해야 합니다");
  assert.ok(source.includes('from "@/lib/design-library/plan-layout-css"'), "plan baseline도 export 경로가 import해야 합니다");
  const composeAt = source.indexOf("const protectedCss =");
  assert.ok(composeAt > 0, "protectedCss 조합을 찾지 못했습니다");
  const compose = source.slice(composeAt, composeAt + 700);
  const footerAt = compose.indexOf("buildFooterThemeCss(rawThemeCss");
  const brandAt = compose.indexOf("brandThemeCss(palette");
  const planAt = compose.indexOf("planLayoutCss(source.pagePlan)");
  assert.ok(footerAt > 0 && brandAt > footerAt, "브랜드 변수는 푸터 뒤에 와야 합니다");
  assert.ok(planAt > brandAt, "plan baseline은 브랜드 변수를 읽으므로 그 뒤에 와야 합니다");
  assert.ok(compose.includes("radius: source.commerce?.radius"), "Preview와 같은 radius를 넘겨야 합니다");
  assert.ok(compose.includes("footerBrandBackground(palette)"), "푸터는 colorStrategy 분기를 타야 합니다");
});

test("surfaceFamily는 다섯 값이 실제로 다른 base surface를 만든다", () => {
  const surfaces = SURFACE_FAMILIES.map((family) => surfaceTokens(family, "#303030").surface);
  assert.equal(new Set(surfaces).size, SURFACE_FAMILIES.length, `지면이 겹치면 축이 죽습니다: ${surfaces.join(", ")}`);
  const lightness = (hex: string) => rgbToHsl(parseHex(hex)!).l;
  assert.ok(lightness(surfaceTokens("dark", "#303030").surface) < 0.3, "dark는 어두운 지면이어야 합니다");
  assert.ok(lightness(surfaceTokens("white", "#303030").surface) > 0.95);
  // 지면 위 글자는 지면과 대비가 서야 합니다.
  for (const family of SURFACE_FAMILIES) {
    const tokens = surfaceTokens(family, "#a94f37");
    assert.ok(contrastRatio(parseHex(tokens.surface)!, parseHex(tokens.surfaceInk)!) >= 4.5, family);
  }
});

test("brandThemeCss가 surfaceFamily 토큰을 실제로 내보낸다", () => {
  const warm = brandThemeCss(palette({ brandColor: "#a94f37", surfaceFamily: "warm" }));
  const dark = brandThemeCss(palette({ brandColor: "#303030", surfaceFamily: "dark" }));
  assert.ok(warm.includes(`--molive-surface:${surfaceTokens("warm", "#a94f37").surface}`));
  assert.ok(dark.includes(`--molive-surface:${surfaceTokens("dark", "#303030").surface}`));
  assert.ok(warm.includes("--molive-surface-ink:"));
  // 기존 Header/카드 토큰 namespace는 그대로입니다.
  for (const reserved of RESERVED_MOIRE_VARIABLES) assert.ok(!dark.includes(reserved), reserved);
});
