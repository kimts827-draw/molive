import assert from "node:assert/strict";
import test from "node:test";
import {
  briefAsksDarkSurface,
  briefAsksMonochrome,
  briefAsksWarmSurface,
  normalizePagePlan,
  pagePlanJsonSchema,
  pagePlanSchema,
  renderPagePlanContract,
  renderPagePlanEditContext,
  renderPaletteContract,
  type PagePlan,
} from "../lib/design-library/page-plan.ts";
import { composeFallbackPagePlan } from "../lib/design-library/plan-composer.ts";
import { PAGE_PLAN_SYSTEM_PROMPT, buildPagePlanUserPrompt } from "../lib/openai/page-plan-contract.ts";

const BRIEF = "원목 가구와 조명을 파는 인테리어 스토어. 공간 제안 중심.";
const HEX = "#1B3A6B";

function planWith(overrides: Partial<PagePlan> = {}): PagePlan {
  return { ...composeFallbackPagePlan({ prompt: BRIEF, brandName: "무담" }, 7), ...overrides };
}

test("사용자가 고른 hex는 AI 응답과 무관하게 plan.palette에 확정된다", () => {
  const aiChose = planWith({ palette: { brandColor: "#cccccc", colorStrategy: "band", surfaceFamily: "white" } });
  const fixed = normalizePagePlan(aiChose, { brandColor: HEX, brief: BRIEF });
  assert.equal(fixed.palette?.brandColor, "#1b3a6b", "사용자 hex가 그대로 확정되어야 합니다");
});

test("hex를 넣지 않으면 AI가 고른 팔레트를 그대로 둔다", () => {
  const aiChose = planWith({ palette: { brandColor: "#2F7A3D", colorStrategy: "dominant", surfaceFamily: "tinted" } });
  const fixed = normalizePagePlan(aiChose, { brief: BRIEF });
  assert.equal(fixed.palette?.brandColor, "#2f7a3d");
  assert.equal(fixed.palette?.colorStrategy, "dominant");
});

test("색이 전혀 없으면 palette를 만들지 않는다", () => {
  const fixed = normalizePagePlan(planWith({ palette: undefined }), { brief: BRIEF });
  assert.equal(fixed.palette, undefined);
});

test("hex를 넣었는데 AI가 monochrome을 고르면 accent-only로 강등한다", () => {
  const aiChose = planWith({ palette: { brandColor: "#cccccc", colorStrategy: "monochrome", surfaceFamily: "white" } });
  const fixed = normalizePagePlan(aiChose, { brandColor: HEX, brief: BRIEF });
  assert.equal(fixed.palette?.colorStrategy, "accent-only", "명시한 색이 도로 사라지면 안 됩니다");
});

test("브리프가 무채색을 명시적으로 요구하면 monochrome을 유지한다", () => {
  const brief = "흑백 모노크롬 톤의 남성 의류 편집숍.";
  const aiChose = planWith({ palette: { brandColor: "#cccccc", colorStrategy: "monochrome", surfaceFamily: "white" } });
  const fixed = normalizePagePlan(aiChose, { brandColor: HEX, brief });
  assert.equal(fixed.palette?.colorStrategy, "monochrome");
  assert.ok(briefAsksMonochrome(brief));
  assert.ok(briefAsksMonochrome("a strictly black and white lookbook shop"));
  assert.ok(!briefAsksMonochrome(BRIEF));
  assert.ok(!briefAsksMonochrome(undefined));
});

test("hex를 넣지 않았으면 monochrome을 강등하지 않는다", () => {
  const aiChose = planWith({ palette: { brandColor: "#cccccc", colorStrategy: "monochrome", surfaceFamily: "white" } });
  const fixed = normalizePagePlan(aiChose, { brief: BRIEF });
  assert.equal(fixed.palette?.colorStrategy, "monochrome");
});

test("dominant인데 지면이 순백이면 색을 무력화하므로 tinted로 눌러 준다", () => {
  const aiChose = planWith({ palette: { brandColor: HEX, colorStrategy: "dominant", surfaceFamily: "white" } });
  const fixed = normalizePagePlan(aiChose, { brandColor: HEX, brief: BRIEF });
  assert.equal(fixed.palette?.surfaceFamily, "tinted");
});

test("본문에 accent 밴드가 없으면 코드가 정확히 하나를 승격한다", () => {
  const base = planWith({ palette: { brandColor: HEX, colorStrategy: "accent-only", surfaceFamily: "white" } });
  const flat: PagePlan = { ...base, sections: base.sections.map((section) => ({ ...section, tone: "light" as const })) };
  const fixed = normalizePagePlan(flat, { brandColor: HEX, brief: BRIEF });
  const accents = fixed.sections.filter((section) => section.tone === "accent");
  assert.equal(accents.length, 1, "브랜드 색 면적이 본문에 최소 한 곳 있어야 합니다");
  assert.notEqual(accents[0].type, "featuredProducts", "상품 진열은 승격 대상이 아닙니다");
});

test("dominant는 accent 밴드를 두 개까지 승격한다", () => {
  const base = planWith({ palette: { brandColor: HEX, colorStrategy: "dominant", surfaceFamily: "tinted" } });
  const flat: PagePlan = { ...base, sections: base.sections.map((section) => ({ ...section, tone: "light" as const })) };
  const fixed = normalizePagePlan(flat, { brandColor: HEX, brief: BRIEF });
  assert.ok(fixed.sections.filter((section) => section.tone === "accent").length >= 2);
});

test("monochrome은 accent 밴드를 만들지 않는다", () => {
  const base = planWith({ palette: { brandColor: HEX, colorStrategy: "monochrome", surfaceFamily: "white" } });
  const flat: PagePlan = { ...base, sections: base.sections.map((section) => ({ ...section, tone: "light" as const })) };
  const fixed = normalizePagePlan(flat, { brief: "흑백 모노크롬 편집숍" });
  assert.equal(fixed.sections.filter((section) => section.tone === "accent").length, 0);
});

test("palette가 없는 기존 plan은 그대로 열리고 저장된다", () => {
  const legacy = { ...planWith(), palette: undefined };
  const parsed = pagePlanSchema.parse(JSON.parse(JSON.stringify(legacy)) as unknown);
  assert.equal(parsed.palette, undefined);
  const fixed = normalizePagePlan(parsed);
  assert.equal(fixed.palette, undefined);
  assert.ok(fixed.sections.length >= 3);
});

test("2단계 계약 텍스트는 브랜드 색과 코드가 선언한 변수를 함께 싣는다", () => {
  const plan = normalizePagePlan(planWith({ palette: { brandColor: HEX, colorStrategy: "band", surfaceFamily: "warm" } }), { brandColor: HEX, brief: BRIEF });
  const contract = renderPagePlanContract(plan);
  assert.ok(contract.includes("PALETTE"), "팔레트 계약이 실려야 합니다");
  assert.ok(contract.includes("#1b3a6b"), "브랜드 색 자체가 계약에 있어야 합니다");
  assert.ok(contract.includes("var(--molive-brand)"), "리터럴 hex 대신 변수를 쓰라고 알려야 합니다");
  assert.ok(contract.includes("면적"), "색을 면적으로 쓰라는 규칙이 있어야 합니다");
  // 부분 수정 컨텍스트에도 색이 남아야 편집이 색을 잃지 않습니다.
  assert.ok(renderPagePlanEditContext(plan).includes("#1b3a6b"));
});

test("duotone일 때만 2차 색을 계약에 노출한다", () => {
  const duo = renderPaletteContract({ brandColor: HEX, colorStrategy: "duotone", surfaceFamily: "white" });
  const band = renderPaletteContract({ brandColor: HEX, colorStrategy: "band", surfaceFamily: "white" });
  assert.ok(duo.includes("--molive-brand-secondary"));
  assert.ok(!band.includes("--molive-brand-secondary"));
  assert.equal(renderPaletteContract(undefined), "");
});

test("plan JSON schema는 palette를 strict required로 요구한다", () => {
  assert.ok((pagePlanJsonSchema.required as readonly string[]).includes("palette"));
  const palette = pagePlanJsonSchema.properties.palette;
  assert.equal(palette.additionalProperties, false);
  assert.deepEqual([...palette.required], ["brandColor", "colorStrategy", "surfaceFamily"]);
  assert.ok((palette.properties.colorStrategy.enum as readonly string[]).includes("dominant"));
  assert.ok((palette.properties.surfaceFamily.enum as readonly string[]).includes("tinted"));
});

test("1단계 프롬프트는 색을 면적으로 쓰라고 지시하고 monochrome 오용을 막는다", () => {
  assert.ok(PAGE_PLAN_SYSTEM_PROMPT.includes("palette:"));
  assert.ok(PAGE_PLAN_SYSTEM_PROMPT.includes("brand colour as AREA"));
  assert.ok(PAGE_PLAN_SYSTEM_PROMPT.includes("monochrome throws their colour away"));
  const withHex = buildPagePlanUserPrompt({ prompt: BRIEF, colors: [HEX] });
  assert.ok(withHex.includes(HEX));
  assert.ok(withHex.includes("do not choose monochrome"));
  const withoutHex = buildPagePlanUserPrompt({ prompt: BRIEF });
  assert.ok(!withoutHex.includes("do not choose monochrome"));
});

test("대비 경로도 사용자 hex로 palette를 만들고 monochrome을 쓰지 않는다", () => {
  const fallback = composeFallbackPagePlan({ prompt: BRIEF, brandName: "무담", colors: [HEX] });
  assert.equal(fallback.palette?.brandColor, "#1b3a6b");
  assert.notEqual(fallback.palette?.colorStrategy, "monochrome");
  assert.ok(fallback.sections.some((section) => section.tone === "accent"), "대비 경로에도 색 면적이 남아야 합니다");
  // 색을 넣지 않으면 palette도 없습니다.
  assert.equal(composeFallbackPagePlan({ prompt: BRIEF, brandName: "무담" }).palette, undefined);
});

test("브리프가 어두운 지면을 명시하고 브랜드도 매우 어두우면 warm 지면을 그대로 두지 않는다", () => {
  const brief = "감각적인 홈·리빙 라이프스타일 브랜드. 차콜과 뉴트럴 톤 중심의 세련된 편집숍 느낌으로 만들어줘.";
  const aiChose = planWith({ palette: { brandColor: "#303030", colorStrategy: "dominant", surfaceFamily: "warm" } });
  const fixed = normalizePagePlan(aiChose, { brandColor: "#303030", brief });
  assert.equal(fixed.palette?.surfaceFamily, "dark", "차콜 브리프에 아이보리 지면은 모순입니다");
  assert.ok(briefAsksDarkSurface(brief));
  assert.ok(briefAsksDarkSurface("charcoal and black interior"));
  assert.ok(!briefAsksDarkSurface("따뜻한 우드 톤"));
});

test("채도가 남은 어두운 브랜드는 dark가 아니라 cool 지면으로 눌러 준다", () => {
  const aiChose = planWith({ palette: { brandColor: "#1b3a6b", colorStrategy: "dominant", surfaceFamily: "warm" } });
  const fixed = normalizePagePlan(aiChose, { brandColor: "#1b3a6b", brief: "다크 네이비 톤의 테크 브랜드" });
  assert.equal(fixed.palette?.surfaceFamily, "cool");
});

test("따뜻한 지면을 함께 명시했으면 사용자의 말을 우선해 warm을 지킨다", () => {
  const aiChose = planWith({ palette: { brandColor: "#303030", colorStrategy: "dominant", surfaceFamily: "warm" } });
  const fixed = normalizePagePlan(aiChose, { brandColor: "#303030", brief: "차콜과 아이보리를 함께 쓰는 브랜드" });
  assert.equal(fixed.palette?.surfaceFamily, "warm");
  assert.ok(briefAsksWarmSurface("아이보리 크림 톤"));
});

test("유아·식품처럼 따뜻한 브리프는 warm 지면이 그대로 유지된다", () => {
  for (const [hex, brief] of [
    ["#D9A89A", "신생아와 유아를 위한 프리미엄 아기용품 브랜드. 더스티 피치와 아이보리 중심의 부드럽고 따뜻한 분위기로 만들어줘."],
    ["#A94F37", "프리미엄 조미식품 브랜드. 소스, 오일, 향신료를 판매하며 고급 식료품점처럼 차분하고 신뢰감 있게 만들어줘."],
  ] as const) {
    const aiChose = planWith({ palette: { brandColor: hex.toLowerCase(), colorStrategy: "band", surfaceFamily: "warm" } });
    assert.equal(normalizePagePlan(aiChose, { brandColor: hex, brief }).palette?.surfaceFamily, "warm", hex);
  }
});

test("2단계 계약은 기본 지면색을 값으로 알려 준다", () => {
  const contract = renderPaletteContract({ brandColor: "#303030", colorStrategy: "dominant", surfaceFamily: "dark" });
  assert.ok(contract.includes("var(--molive-surface)="), contract);
  assert.ok(contract.includes("var(--molive-surface-ink)="));
});
