/**
 * plan-attributes.ts가 주입한 속성을 실제 픽셀로 바꾸는 코드 소유 baseline CSS입니다.
 *
 * AI CSS 뒤에 emit되지만 소스 순서만으로는 이기지 못합니다. isolateAiDesignCss의
 * scopeStaticSelector가 모든 AI 셀렉터에 [data-moire-static]를 덧붙여 명시도를 최소 (0,3,0)으로
 * 올리는 반면 여기의 셀렉터는 (0,2,0)이기 때문입니다. 실제 생성 검증에서 AI의
 * `[data-moire-static][data-moire-root="…"] .cls` 규칙이 container padding을 이기는 것이 확인됐습니다.
 *
 * 셀렉터를 더 복잡하게 만들어 명시도 경쟁을 하는 대신, plan이 코드 소유로 확정한
 * hard property에만 제한적으로 !important를 씁니다(HARD_AXIS). AI CSS는 계약상
 * !important를 쓸 수 없으므로(CSS_IMPORTANT_FORBIDDEN) 이 경계는 한쪽 방향으로만 작동합니다.
 * - tone=accent 의 background-color/color 는 강제입니다. 브랜드 색 면적을 반드시 남기는 자리입니다.
 * - container padding-inline, full-bleed 직계 자식의 max-width/margin-inline,
 *   surfaceStyle=card/outlined 도 강제입니다.
 * - tone light/tinted/dark 는 :where()로 감싼 명시도 0의 폴백이며 !important를 쓰지 않습니다.
 *   AI가 그 섹션 배경을 직접 디자인했으면 AI가 이깁니다.
 *
 * 색은 항상 `background` 축약형이 아니라 `background-color`로 씁니다.
 * 축약형은 background-image를 none으로 초기화해 AI가 깔아 둔 사진과 그라디언트를 지웁니다.
 *
 * 안정성 경계: [data-moire-root] 스코프 밖으로 나가지 않고,
 * .pocHeader* / .prdList* / .thumbnail / .ec-base-product selector는 한 번도 쓰지 않습니다.
 */

import type { PagePlan } from "./page-plan.ts";
import { PLAN_ATTRIBUTE_NAMES } from "./plan-attributes.ts";

const ROOT = "[data-moire-root]";
const { tone, container, surface } = PLAN_ATTRIBUTE_NAMES;

/**
 * plan이 코드 소유로 확정한 hard property에만 붙입니다.
 * 폴백(:where()) 규칙에는 절대 쓰지 않습니다 — 그쪽은 AI에게 우선권을 주기로 한 자리입니다.
 */
const HARD = " !important";

/** 선언 목록의 모든 값에 !important를 답니다. background 축약형은 쓰지 않습니다. */
function hard(declarations: string) {
  return declarations
    .split(";")
    .filter((entry) => entry.trim())
    .map((entry) => `${entry.trim()}${HARD}`)
    .join(";");
}

/** tone별 배경 계약입니다. accent만 강제, 나머지는 폴백입니다. */
const TONE_RULES = [
  { value: "accent", enforced: true, declarations: "background-color:var(--molive-brand);color:var(--molive-brand-on)" },
  { value: "tinted", enforced: false, declarations: "background-color:var(--molive-brand-tint)" },
  { value: "dark", enforced: false, declarations: "background-color:var(--molive-neutral-ink);color:var(--molive-neutral-ink-on)" },
  // light는 surfaceFamily가 정한 base surface를 씁니다. AI가 배경을 직접 쓰면 그쪽이 이깁니다.
  { value: "light", enforced: false, declarations: "background-color:var(--molive-surface);color:var(--molive-surface-ink)" },
] as const;

/**
 * duotone은 2차 색이 tinted 밴드를 맡아 두 색이 번갈아 나오게 합니다.
 * accent-only와 monochrome은 tinted를 브랜드 색으로 물들이지 않습니다.
 */
function tintedBackground(plan: PagePlan) {
  const strategy = plan.palette?.colorStrategy;
  if (strategy === "duotone") return "var(--molive-brand-secondary-tint)";
  if (strategy === "accent-only" || strategy === "monochrome") return null;
  return "var(--molive-brand-tint)";
}

/**
 * AI 캔버스 바깥의 shell 배경입니다.
 * `#wrap[data-moire-root]`는 AI가 절대 셀렉터로 잡지 않는 요소(모든 AI 셀렉터는 [data-moire-static]를
 * 달고 나오므로)라서, surfaceFamily가 어긋남 없이 닿는 유일한 면입니다.
 */
function shellSurfaceCss() {
  return `${ROOT}:not([data-moire-static]){background-color:var(--molive-surface);color:var(--molive-surface-ink)}`;
}

function toneCss(plan: PagePlan) {
  const rules: string[] = [shellSurfaceCss()];
  for (const rule of TONE_RULES) {
    if (rule.value === "tinted") {
      const background = tintedBackground(plan);
      if (!background) continue;
      rules.push(`${ROOT} :where([${tone}="tinted"]){background-color:${background}}`);
      continue;
    }
    if (rule.enforced) {
      // accent는 AI가 같은 섹션에 background-color를 선언했더라도 브랜드 색면이 남아야 합니다.
      rules.push(`${ROOT} [${tone}="${rule.value}"]{${hard(rule.declarations)}}`);
      continue;
    }
    rules.push(`${ROOT} :where([${tone}="${rule.value}"]){${rule.declarations}}`);
  }
  return rules;
}

/**
 * container별 inline measure입니다.
 *
 * 강제되는 최소 geometry 차이는 "가로 폭"뿐입니다. display·grid·수직 리듬은 건드리지 않아
 * AI가 짠 레이아웃이 깨질 경로를 만들지 않습니다. AI가 안쪽에 자기 컨테이너를 두었더라도
 * 폭이 좁아질 뿐이라 안전합니다. full-bleed만 직계 자식의 max-width를 풀어야 실제로 전폭이 됩니다.
 */
const CONTAINER_RULES: Record<string, (root: string) => string[]> = {
  boxed: (root) => [`${root} [${container}="boxed"]{${hard("padding-inline:max(24px,calc((100% - 1200px) / 2))")}}`],
  wide: (root) => [`${root} [${container}="wide"]{${hard("padding-inline:max(24px,calc((100% - 1560px) / 2))")}}`],
  asymmetric: (root) => [`${root} [${container}="asymmetric"]{${hard("padding-inline:clamp(24px,9vw,200px) clamp(24px,3vw,56px)")}}`],
  "full-bleed": (root) => [
    `${root} [${container}="full-bleed"]{${hard("padding-inline:0")}}`,
    `${root} [${container}="full-bleed"],${root} [${container}="full-bleed"] > *{${hard("max-width:none;margin-inline:0")}}`,
  ],
};

/**
 * 좁은 화면에서는 어떤 지면이든 같은 안전 여백으로 되돌립니다.
 * 데스크톱 규칙이 !important라 이쪽도 같은 무게여야 모바일에서 뒤집힙니다.
 */
const CONTAINER_MOBILE = `@media all and (max-width:767px){${ROOT} [${container}]:not([${container}="full-bleed"]){${hard("padding-inline:20px")}}}`;

/**
 * 표면 표현입니다. tone이 배경색을 맡으므로 여기서는 카드와 괘선만 다룹니다.
 * photoField는 사진 자산이 필요해 계약 텍스트로만 전달하고 CSS로 강제하지 않습니다.
 */
const SURFACE_RULES: Record<string, (root: string) => string[]> = {
  outlined: (root) => [`${root} [${surface}="outlined"]{${hard("border-block:1px solid var(--molive-line)")}}`],
  card: (root) => [`${root} [${surface}="card"] > *{${hard("background-color:var(--molive-raised);border-radius:var(--molive-radius)")}}`],
};

function geometryCss(plan: PagePlan) {
  const rules: string[] = [];
  const containers = new Set(plan.sections.flatMap((section) => (section.container ? [section.container] : [])));
  for (const value of containers) rules.push(...(CONTAINER_RULES[value]?.(ROOT) ?? []));
  if (containers.size) rules.push(CONTAINER_MOBILE);

  const surfaces = new Set(plan.sections.flatMap((section) => (section.surfaceStyle ? [section.surfaceStyle] : [])));
  for (const value of surfaces) rules.push(...(SURFACE_RULES[value]?.(ROOT) ?? []));

  // columns는 카드 컨테이너가 섹션의 임의 깊이 자손이라 코드가 도달할 수 없습니다.
  // 값만 변수로 내려 주고 계약이 repeat(var(--molive-columns),1fr) 사용을 지시합니다(강제 아님).
  const columns = new Set(plan.sections.flatMap((section) => (section.columns ? [section.columns] : [])));
  for (const value of columns) rules.push(`${ROOT} [data-moire-columns="${value}"]{--molive-columns:${value}}`);
  return rules;
}

/**
 * plan이 결정한 축을 소비하는 baseline CSS입니다.
 * palette가 없는 프로젝트는 브랜드 변수가 선언되지 않으므로 tone 규칙도 만들지 않습니다.
 */
export function planLayoutCss(plan: PagePlan | undefined | null) {
  if (!plan) return "";
  // tone은 브랜드 변수를 읽으므로 palette가 있을 때만, geometry는 색과 무관하므로 항상 만듭니다.
  const rules = [...(plan.palette ? toneCss(plan) : []), ...geometryCss(plan)];
  if (!rules.length) return "";
  return `/* MOLIVE page plan baseline. plan이 정한 축을 코드가 직접 소비합니다. */\n${rules.join("\n")}`;
}

/** 테스트와 감사에서 쓰는, 이 모듈이 절대 건드리지 않는 selector 목록입니다. */
export const PLAN_LAYOUT_FORBIDDEN_SELECTORS = [".pocHeader", ".prdList", ".thumbnail", ".ec-base-product", ".moireProductSection", ".description", ".likeButton"] as const;

export { container, surface };
