/**
 * Page Plan의 값을 생성된 HTML의 section 요소에 결정적으로 새겨 넣습니다.
 *
 * AI에게 "이 속성을 붙여라"라고 지시하고 지켰는지 검사하는 방식은 재시도를 늘립니다.
 * 대신 생성 직후 코드가 후처리로 속성을 주입하고, plan-layout-css.ts가 그 속성을 소비합니다.
 * 그래서 AI가 축을 통째로 무시해도 최소한의 geometry·색 차이는 화면에 반드시 나타납니다.
 *
 * 안정성 경계: 최상위 section과 hero 요소의 여는 태그에만 속성을 더합니다.
 * data-cafe24-slot 내부, module= 요소, header 요소에는 아무것도 쓰지 않습니다.
 */

import type { PagePlan, PagePlanSection } from "./page-plan.ts";

export const PLAN_ATTRIBUTE_NAMES = {
  plan: "data-moire-plan",
  tone: "data-moire-tone",
  container: "data-moire-container",
  columns: "data-moire-columns",
  surface: "data-moire-surface",
} as const;

/** 어떤 근거로 plan과 DOM을 이었는지. fallback 의존도를 관측해 다음 단계 판단에 씁니다. */
export type PlanAttributeMapping = { byId: number; byType: number; byAnchor: number; unmatched: number };

export type PlanAttributeResult = { html: string; mapping: PlanAttributeMapping };

type Element = {
  /** 여는 태그의 시작 인덱스 */
  start: number;
  /** 여는 태그의 `>` 인덱스 */
  openEnd: number;
  tag: string;
  attributes: string;
  /** 이 요소가 끝나는 인덱스(닫는 태그의 시작) */
  contentEnd: number;
};

const VOID_TAGS = new Set(["img", "br", "hr", "input", "meta", "link", "source", "area", "base", "col", "embed", "track", "wbr"]);

/** 여는 태그를 순서대로 훑어 최상위 요소만 남깁니다. 중첩된 section은 대상이 아닙니다. */
function topLevelElements(html: string, tags: ReadonlySet<string>): Element[] {
  const found: Element[] = [];
  const stack: { tag: string; depth: number }[] = [];
  const pattern = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let openSectionDepth = -1;
  let pending: Element | null = null;

  for (const match of html.matchAll(pattern)) {
    const closing = match[1] === "/";
    const tag = match[2].toLowerCase();
    const attributes = match[3] ?? "";
    const selfClosing = attributes.trimEnd().endsWith("/") || VOID_TAGS.has(tag);

    if (closing) {
      while (stack.length && stack[stack.length - 1].tag !== tag) stack.pop();
      const popped = stack.pop();
      if (pending && popped && popped.depth === openSectionDepth) {
        found.push({ ...pending, contentEnd: match.index });
        pending = null;
        openSectionDepth = -1;
      }
      continue;
    }
    if (selfClosing) continue;

    const depth = stack.length;
    stack.push({ tag, depth });
    if (!pending && tags.has(tag)) {
      pending = { start: match.index, openEnd: match.index + match[0].length - 1, tag, attributes, contentEnd: html.length };
      openSectionDepth = depth;
    }
  }
  if (pending) found.push(pending);
  return found;
}

function attributeValue(attributes: string, name: string) {
  return attributes.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? null;
}

/** hero는 plan.hero의 축을, 본문 섹션은 자기 plan 섹션의 축을 받습니다. */
type Axes = { plan: string; tone: string; container?: string; columns?: string; surface?: string };

function heroAxes(plan: PagePlan): Axes {
  return { plan: "hero", tone: plan.hero.tone };
}

function sectionAxes(section: PagePlanSection): Axes {
  return {
    plan: section.id,
    tone: section.tone,
    container: section.container,
    columns: section.columns?.toString(),
    surface: section.surfaceStyle,
  };
}

function writeAttributes(attributes: string, axes: Axes) {
  const pairs: [string, string | undefined][] = [
    [PLAN_ATTRIBUTE_NAMES.plan, axes.plan],
    [PLAN_ATTRIBUTE_NAMES.tone, axes.tone],
    [PLAN_ATTRIBUTE_NAMES.container, axes.container],
    [PLAN_ATTRIBUTE_NAMES.columns, axes.columns],
    [PLAN_ATTRIBUTE_NAMES.surface, axes.surface],
  ];
  let next = attributes.replace(/\s*\/\s*$/, "");
  for (const [name, value] of pairs) {
    if (value === undefined || value === "") continue;
    // 이미 같은 속성이 있으면 코드 값으로 덮어씁니다. plan이 진실입니다.
    const existing = new RegExp(`\\s*\\b${name}\\s*=\\s*["'][^"']*["']`, "gi");
    next = next.replace(existing, "");
    next += ` ${name}="${value.replace(/"/g, "&quot;")}"`;
  }
  return next;
}

/**
 * plan과 DOM section을 잇습니다. 단순 순서 매칭은 AI가 섹션을 하나 더/덜 만들면 전체가 밀리므로,
 * 확정적인 신호부터 소진하고 남은 것만 앵커 기준 순서로 잇습니다.
 *
 * 1) data-moire-plan / data-moire-id 가 plan 섹션 id와 정확히 일치
 * 2) data-moire-type="hero"
 * 3) data-cafe24-slot="product-list" 를 품은 section → featuredProducts (앵커)
 * 4) data-moire-type 의미 매칭(products)
 * 5) 앵커에서 바깥 방향으로 순서 정렬(앞쪽은 앵커 직전부터 거슬러, 뒤쪽은 앵커 직후부터)
 */
export function applyPagePlanAttributes(html: string, plan: PagePlan): PlanAttributeResult {
  const elements = topLevelElements(html, new Set(["section", "article", "aside"]));
  const heroElement = elements.find((element) => attributeValue(element.attributes, "data-moire-type") === "hero");

  const assigned = new Map<number, Axes>();
  const usedSections = new Set<string>();
  const mapping: PlanAttributeMapping = { byId: 0, byType: 0, byAnchor: 0, unmatched: 0 };

  const claim = (index: number, axes: Axes, kind: keyof PlanAttributeMapping) => {
    assigned.set(index, axes);
    if (axes.plan !== "hero") usedSections.add(axes.plan);
    mapping[kind] += 1;
  };

  // pass 1 — id 직접 일치
  const byId = new Map(plan.sections.map((section) => [section.id, section] as const));
  for (const [index, element] of elements.entries()) {
    const marker = attributeValue(element.attributes, PLAN_ATTRIBUTE_NAMES.plan) ?? attributeValue(element.attributes, "data-moire-id");
    const section = marker ? byId.get(marker) : undefined;
    if (!section || usedSections.has(section.id)) continue;
    claim(index, sectionAxes(section), "byId");
  }

  // pass 2 — hero 타입
  if (heroElement) {
    const index = elements.indexOf(heroElement);
    if (index >= 0 && !assigned.has(index)) claim(index, heroAxes(plan), "byType");
  }

  // pass 3 — 상품 슬롯 앵커
  const productSection = plan.sections.find((section) => section.type === "featuredProducts");
  let anchorIndex = -1;
  for (const [index, element] of elements.entries()) {
    const inner = html.slice(element.openEnd, element.contentEnd);
    if (!/data-cafe24-slot\s*=\s*["']product-list["']/i.test(element.attributes + inner)) continue;
    anchorIndex = index;
    if (productSection && !assigned.has(index) && !usedSections.has(productSection.id)) claim(index, sectionAxes(productSection), "byAnchor");
    break;
  }

  // pass 4 — data-moire-type 의미 매칭
  if (productSection && !usedSections.has(productSection.id)) {
    const index = elements.findIndex((element, position) => !assigned.has(position) && attributeValue(element.attributes, "data-moire-type") === "products");
    if (index >= 0) claim(index, sectionAxes(productSection), "byType");
  }

  // pass 5 — 앵커 기준 순서 정렬(fallback)
  const remainingSections = plan.sections.filter((section) => !usedSections.has(section.id));
  const remainingIndexes = elements.map((_, index) => index).filter((index) => !assigned.has(index) && index !== anchorIndex);
  const productAt = plan.sections.findIndex((section) => section.type === "featuredProducts");
  const beforeSections = remainingSections.filter((section) => plan.sections.indexOf(section) < productAt);
  const afterSections = remainingSections.filter((section) => plan.sections.indexOf(section) > productAt);
  const beforeIndexes = remainingIndexes.filter((index) => anchorIndex < 0 || index < anchorIndex);
  const afterIndexes = remainingIndexes.filter((index) => anchorIndex >= 0 && index > anchorIndex);

  // 앵커에서 바깥으로 채웁니다. 상품 슬롯 근처가 가장 믿을 만한 지점이고,
  // AI가 섹션을 더 만들었다면 그 여분은 페이지 양 끝에 남을 확률이 높기 때문입니다.
  for (let offset = 1; offset <= Math.min(beforeSections.length, beforeIndexes.length); offset += 1) {
    claim(beforeIndexes[beforeIndexes.length - offset], sectionAxes(beforeSections[beforeSections.length - offset]), "byAnchor");
  }
  for (let offset = 0; offset < Math.min(afterSections.length, afterIndexes.length); offset += 1) {
    claim(afterIndexes[offset], sectionAxes(afterSections[offset]), "byAnchor");
  }
  // 앵커가 없으면 남은 섹션을 위에서부터 순서대로 잇습니다.
  if (anchorIndex < 0) {
    const leftovers = remainingSections.filter((section) => !usedSections.has(section.id));
    const slots = remainingIndexes.filter((index) => !assigned.has(index));
    for (let offset = 0; offset < Math.min(leftovers.length, slots.length); offset += 1) {
      claim(slots[offset], sectionAxes(leftovers[offset]), "byAnchor");
    }
  }
  mapping.unmatched = elements.length - assigned.size;

  if (!assigned.size) return { html, mapping };

  // 뒤에서부터 써야 앞쪽 인덱스가 밀리지 않습니다.
  let output = html;
  for (const index of [...assigned.keys()].sort((left, right) => right - left)) {
    const element = elements[index];
    const axes = assigned.get(index) as Axes;
    output = `${output.slice(0, element.start)}<${element.tag}${writeAttributes(element.attributes, axes)}>${output.slice(element.openEnd + 1)}`;
  }
  return { html: output, mapping };
}
