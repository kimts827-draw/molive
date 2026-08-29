import assert from "node:assert/strict";
import test from "node:test";
import { normalizePagePlan, type PagePlan } from "../lib/design-library/page-plan.ts";
import { composeFallbackPagePlan } from "../lib/design-library/plan-composer.ts";
import { applyPagePlanAttributes } from "../lib/design-library/plan-attributes.ts";
import { PLAN_LAYOUT_FORBIDDEN_SELECTORS, planLayoutCss } from "../lib/design-library/plan-layout-css.ts";
import { buildFooterThemeCss } from "../lib/cafe24/theme-bridge.ts";
import { isolateAiDesignCss } from "../lib/commerce/fixed-components.ts";
import { brandRamp, footerBrandBackground, type ColorStrategy } from "../lib/commerce/brand-theme.ts";

const BRIEF = "원목 가구와 조명을 파는 인테리어 스토어. 공간 제안 중심.";
const HEX = "#1B3A6B";

function planFor(strategy: ColorStrategy = "band"): PagePlan {
  const base = composeFallbackPagePlan({ prompt: BRIEF, brandName: "무담", colors: [HEX] }, 11);
  return normalizePagePlan({ ...base, palette: { brandColor: HEX, colorStrategy: strategy, surfaceFamily: "warm" } }, { brandColor: HEX, brief: BRIEF });
}

/** plan 섹션 개수에 맞춰 hero + 본문 + 상품 슬롯을 갖춘 생성 결과를 흉내 냅니다. */
function htmlFor(plan: PagePlan, options: { extraSection?: boolean; useIds?: boolean } = {}) {
  const body = plan.sections.map((section, index) => {
    const idAttribute = options.useIds ? ` data-moire-id="${section.id}"` : ` data-moire-id="node-${index}"`;
    if (section.type === "featuredProducts") {
      return `<section${idAttribute} data-moire-type="products"><h2 data-moire-id="h-${index}">진열</h2><div data-cafe24-slot="product-list"></div></section>`;
    }
    return `<section${idAttribute} data-moire-type="section"><h2 data-moire-id="h-${index}">${section.headline || section.type}</h2><p data-moire-id="p-${index}">본문</p></section>`;
  }).join("");
  const extra = options.extraSection ? '<section data-moire-id="bonus" data-moire-type="section"><p data-moire-id="bonus-p">덤</p></section>' : "";
  return `<div data-moire-root="attr-test"><main data-moire-id="main"><section data-moire-id="hero" data-moire-type="hero"><h1 data-moire-id="h1">Hero</h1></section>${body}${extra}</main></div>`;
}

function attributesOf(html: string) {
  return [...html.matchAll(/<section([^>]*)>/g)].map((match) => match[1]);
}

test("plan의 tone이 코드에 의해 section 요소에 새겨진다", () => {
  const plan = planFor();
  const { html, mapping } = applyPagePlanAttributes(htmlFor(plan), plan);
  const tones = [...html.matchAll(/data-moire-tone="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(tones.length, plan.sections.length + 1, "hero와 모든 본문 섹션이 tone을 받아야 합니다");
  assert.equal(tones[0], plan.hero.tone, "첫 section은 hero 축을 받습니다");
  assert.deepEqual(tones.slice(1), plan.sections.map((section) => section.tone));
  assert.equal(mapping.unmatched, 0);
});

test("AI가 속성을 하나도 붙이지 않아도 코드가 붙인다", () => {
  const plan = planFor();
  const bare = `<div data-moire-root="x"><main><section data-moire-type="hero"><h1>H</h1></section>${plan.sections.map((section) => (section.type === "featuredProducts" ? '<section><div data-cafe24-slot="product-list"></div></section>' : "<section><p>x</p></section>")).join("")}</main></div>`;
  const { html } = applyPagePlanAttributes(bare, plan);
  assert.equal([...html.matchAll(/data-moire-tone=/g)].length, plan.sections.length + 1);
  assert.ok(html.includes(`data-moire-plan="${plan.sections[0].id}"`));
});

test("id 직접 일치가 순서 매칭보다 먼저 쓰인다", () => {
  const plan = planFor();
  const { mapping } = applyPagePlanAttributes(htmlFor(plan, { useIds: true }), plan);
  assert.ok(mapping.byId >= plan.sections.length, `id 매칭이 우선해야 합니다: ${JSON.stringify(mapping)}`);
  assert.equal(mapping.byAnchor, 0, "id로 다 이어졌으면 fallback을 쓰지 않습니다");
});

test("section이 plan보다 하나 많아도 앵커 정렬이 어긋나지 않는다", () => {
  const plan = planFor();
  const { html, mapping } = applyPagePlanAttributes(htmlFor(plan, { extraSection: true }), plan);
  const product = attributesOf(html).find((attributes) => attributes.includes("data-moire-type=\"products\""));
  const productSection = plan.sections.find((section) => section.type === "featuredProducts");
  assert.ok(product?.includes(`data-moire-plan="${productSection?.id}"`), "상품 섹션은 앵커로 정확히 이어져야 합니다");
  // 남는 section 하나는 아무 속성도 받지 않고 그대로 통과합니다.
  assert.equal(mapping.unmatched, 1);
  const bonus = attributesOf(html).find((attributes) => attributes.includes('data-moire-id="bonus"'));
  assert.ok(bonus && !bonus.includes("data-moire-tone"), "매칭되지 않은 섹션은 건드리지 않습니다");
});

test("보호 영역에는 어떤 속성도 쓰지 않는다", () => {
  const plan = planFor();
  const { html } = applyPagePlanAttributes(htmlFor(plan), plan);
  // 상품 슬롯 wrapper 자체에는 속성이 붙지 않습니다.
  const slot = html.match(/<div data-cafe24-slot="product-list"[^>]*>/)?.[0] ?? "";
  assert.ok(!slot.includes("data-moire-tone"), slot);
  assert.ok(!slot.includes("data-moire-plan"), slot);
  assert.ok(!/<header[^>]*data-moire-tone/.test(html));
  assert.ok(!/module\s*=\s*"[^"]*"[^>]*data-moire-tone/.test(html));
});

test("plan baseline CSS는 accent만 강제하고 나머지 tone은 폴백으로 둔다", () => {
  const css = planLayoutCss(planFor("band"));
  assert.match(css, /\[data-moire-root\] \[data-moire-tone="accent"\]\{background-color:var\(--molive-brand\)/);
  assert.match(css, /:where\(\[data-moire-tone="tinted"\]\)/);
  assert.match(css, /:where\(\[data-moire-tone="dark"\]\)/);
  // accent 규칙만 :where() 밖에 있어야 합니다.
  assert.ok(!/:where\(\[data-moire-tone="accent"\]\)/.test(css));
});

test("tone 규칙은 background 축약형을 쓰지 않아 AI의 background-image를 지우지 않는다", () => {
  const css = planLayoutCss(planFor("dominant"));
  for (const declaration of css.matchAll(/\{([^}]*)\}/g)) {
    assert.ok(!/(^|;)\s*background\s*:/.test(declaration[1]), `background 축약형을 썼습니다: ${declaration[1]}`);
  }
  assert.ok(css.includes("background-color:"));
});

test("plan baseline CSS는 Header와 상품 카드 selector를 쓰지 않는다", () => {
  const css = planLayoutCss(planFor("duotone"));
  for (const selector of PLAN_LAYOUT_FORBIDDEN_SELECTORS) assert.ok(!css.includes(selector), selector);
  assert.ok(!/(^|[\s,}])(:root|html|body)\b/.test(css));
});

test("colorStrategy가 tinted 밴드의 색을 가른다", () => {
  assert.ok(planLayoutCss(planFor("duotone")).includes("var(--molive-brand-secondary-tint)"), "duotone은 2차 색을 씁니다");
  assert.ok(planLayoutCss(planFor("band")).includes("var(--molive-brand-tint)"));
  const accentOnly = planLayoutCss(planFor("accent-only"));
  assert.ok(!accentOnly.includes('data-moire-tone="tinted"'), "accent-only는 tinted를 브랜드 색으로 물들이지 않습니다");
  assert.ok(accentOnly.includes('data-moire-tone="accent"'), "그래도 본문 색면은 남습니다");
});

test("palette가 없으면 tone 규칙은 없지만 geometry 차이는 그대로 남는다", () => {
  const plan = composeFallbackPagePlan({ prompt: BRIEF }, 3);
  assert.equal(plan.palette, undefined);
  const css = planLayoutCss(plan);
  assert.ok(!css.includes("data-moire-tone"), "색이 없으면 tone 배경을 칠하지 않습니다");
  assert.ok(css.includes("data-moire-container"), "geometry는 색과 무관하게 적용됩니다");
  assert.equal(planLayoutCss(undefined), "");
});

test("container는 최소 geometry 차이를 강제하고 full-bleed만 직계 자식까지 푼다", () => {
  const plan = planFor();
  const css = planLayoutCss(plan);
  const containers = new Set(plan.sections.flatMap((section) => (section.container ? [section.container] : [])));
  assert.ok(containers.size >= 2, `한 페이지 안에서 지면이 최소 2종 교차해야 합니다: ${[...containers].join(",")}`);
  for (const value of containers) assert.ok(css.includes(`[data-moire-container="${value}"]`), value);
  if (containers.has("full-bleed")) {
    assert.match(css, /\[data-moire-container="full-bleed"\] > \*\{max-width:none/);
  }
  // 강제 축은 :where()로 감싸지 않습니다.
  assert.ok(!/:where\(\[data-moire-container/.test(css));
  // 수직 리듬과 display는 건드리지 않아 AI 레이아웃이 깨지지 않습니다.
  assert.ok(!/\[data-moire-container[^{]*\{[^}]*(display|padding-block|margin-block|grid-template)/.test(css));
});

test("columns는 강제하지 않고 변수로만 내려 준다", () => {
  const css = planLayoutCss(planFor());
  const columnRules = [...css.matchAll(/\[data-moire-columns="(\d)"\]\{([^}]*)\}/g)];
  assert.ok(columnRules.length >= 1);
  for (const rule of columnRules) assert.equal(rule[2], `--molive-columns:${rule[1]}`, "columns는 값만 내려 주고 grid를 강제하지 않습니다");
});

test("푸터는 colorStrategy에 따라 계산된 리터럴 hex를 쓰고 변수는 참조하지 않는다", () => {
  const ramp = brandRamp(HEX);
  const aiCss = '[data-moire-root="x"] footer#footer{background:#171613}';
  const branded = buildFooterThemeCss(aiCss, footerBrandBackground({ brandColor: HEX, colorStrategy: "dominant", surfaceFamily: "tinted" }));
  assert.ok(branded.includes(`background:${ramp?.brand}`), "dominant 푸터는 브랜드 색을 입습니다");
  assert.ok(!branded.includes("var(--molive-"), "푸터는 AI 루트 밖이라 변수를 참조하지 않습니다");

  const tinted = buildFooterThemeCss(aiCss, footerBrandBackground({ brandColor: HEX, colorStrategy: "band", surfaceFamily: "warm" }));
  assert.ok(tinted.includes(`background:${ramp?.tint}`), "band 푸터는 브랜드 tint를 입습니다");

  for (const strategy of ["accent-only", "duotone", "monochrome"] as const) {
    const untouched = buildFooterThemeCss(aiCss, footerBrandBackground({ brandColor: HEX, colorStrategy: strategy, surfaceFamily: "white" }));
    assert.equal(untouched, buildFooterThemeCss(aiCss), `${strategy}는 기존 푸터를 그대로 둡니다`);
    assert.ok(untouched.includes("background:#171613"), strategy);
  }
});

test("colorStrategy가 다르면 세 몰의 푸터가 서로 같지 않다", () => {
  const aiCss = '[data-moire-root="x"] footer#footer{background:#171613}';
  const footers = (["dominant", "band", "accent-only"] as const).map((strategy) =>
    buildFooterThemeCss(aiCss, footerBrandBackground({ brandColor: HEX, colorStrategy: strategy, surfaceFamily: "warm" })));
  assert.equal(new Set(footers).size, 3, "푸터 처리가 전부 같으면 다시 획일화된 것입니다");
});

test("여분 section이 앞쪽에 있어도 앵커 기준으로 정렬이 유지된다", () => {
  const plan = planFor();
  const base = htmlFor(plan);
  const withLeading = base.replace('<section data-moire-id="hero"', '<section data-moire-id="lead" data-moire-type="section"><p data-moire-id="lead-p">덤</p></section><section data-moire-id="hero"');
  const { html } = applyPagePlanAttributes(withLeading, plan);
  const product = attributesOf(html).find((attributes) => attributes.includes('data-moire-type="products"'));
  const productSection = plan.sections.find((section) => section.type === "featuredProducts");
  assert.ok(product?.includes(`data-moire-plan="${productSection?.id}"`));
  // 앵커 바로 앞뒤 섹션은 plan 순서를 그대로 따릅니다.
  const tones = [...html.matchAll(/data-moire-tone="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(tones[tones.length - 1], plan.sections[plan.sections.length - 1].tone);
});

/** CSS 셀렉터 명시도를 (id, class/attr/pseudo-class, element)로 셉니다. */
function specificity(selector: string) {
  const clean = selector.replace(/:where\([^)]*\)/g, "").replace(/::?[a-z-]+(\([^)]*\))?/g, (m) => (m.startsWith("::") ? "|E|" : "|C|"));
  return {
    id: (clean.match(/#[\w-]+/g) ?? []).length,
    cls: (clean.match(/\.[\w-]+/g) ?? []).length + (clean.match(/\[[^\]]+\]/g) ?? []).length + (clean.match(/\|C\|/g) ?? []).length,
  };
}

test("AI CSS는 baseline보다 높은 명시도로 스코프되므로 hard axis는 !important로 지켜야 한다", () => {
  // 실제 생성물에서 관찰된 형태의 AI 규칙을 그대로 통과시킵니다.
  const aiScoped = isolateAiDesignCss('[data-moire-root="shop"] .pg-manifesto{padding:155px 28px}');
  const aiSelector = aiScoped.slice(0, aiScoped.indexOf("{"));
  const ai = specificity(aiSelector);
  const baseline = specificity(`[data-moire-root] [data-moire-container="boxed"]`);
  assert.ok(ai.cls > baseline.cls, `AI(${ai.cls}) > baseline(${baseline.cls}) 이어야 이 방어가 필요합니다: ${aiSelector}`);
  assert.ok(aiSelector.includes("[data-moire-static]"), "scopeStaticSelector가 명시도를 올리는 지점입니다");
});

test("hard axis 선언에는 !important가 붙고 :where() 폴백에는 붙지 않는다", () => {
  const css = planLayoutCss(planFor("dominant"));
  const rules = [...css.matchAll(/^(?!@)([^\n{]+)\{([^}]*)\}$/gm)].map((m) => ({ sel: m[1].trim(), decl: m[2] }));
  const mediaRules = [...css.matchAll(/@media[^{]*\{([^{]+)\{([^}]*)\}\}/g)].map((m) => ({ sel: m[1].trim(), decl: m[2] }));

  const hardSelectors = [/\[data-moire-tone="accent"\]$/, /\[data-moire-container=/, /\[data-moire-surface="(card|outlined)"\]/];
  for (const rule of [...rules, ...mediaRules]) {
    const isHard = hardSelectors.some((pattern) => pattern.test(rule.sel));
    const isFallback = rule.sel.includes(":where(");
    if (isHard) {
      for (const decl of rule.decl.split(";").filter(Boolean)) {
        assert.ok(decl.includes("!important"), `hard axis인데 !important가 없습니다: ${rule.sel} { ${decl} }`);
      }
    }
    if (isFallback) {
      assert.ok(!rule.decl.includes("!important"), `폴백에 !important를 쓰면 AI 우선권이 사라집니다: ${rule.sel}`);
    }
  }
  // 관측용 columns 변수와 shell 배경은 hard가 아닙니다.
  assert.ok(!/\[data-moire-columns="\d"\]\{[^}]*!important/.test(css), "columns는 강제하지 않습니다");
});

test("강제 대상은 지정된 hard property로만 한정된다", () => {
  const css = planLayoutCss(planFor("dominant"));
  const forced = [...css.matchAll(/([a-z-]+)\s*:[^;}]*!important/g)].map((m) => m[1]);
  const allowed = new Set(["padding-inline", "max-width", "margin-inline", "background-color", "color", "border-block", "border-radius"]);
  for (const property of forced) assert.ok(allowed.has(property), `허용되지 않은 강제 property입니다: ${property}`);
  // background 축약형은 background-image를 지우므로 어떤 경우에도 쓰지 않습니다.
  assert.ok(!/(^|[{;])\s*background\s*:/.test(css), "background 축약형 금지");
});

test("shell 배경은 AI 캔버스 밖에만 걸려 AI 규칙과 겹치지 않는다", () => {
  const css = planLayoutCss(planFor());
  assert.ok(css.includes('[data-moire-root]:not([data-moire-static]){background-color:var(--molive-surface)'), css.slice(0, 200));
  // AI 루트는 항상 data-moire-static을 달고 나오므로 이 규칙에 걸리지 않습니다.
  assert.ok(!/:not\(\[data-moire-static\]\)[^{]*!important/.test(css), "shell 배경은 강제 대상이 아닙니다");
});
