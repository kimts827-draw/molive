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

import { SECTION_TYPES } from "./section-registry.ts";
import type { PagePlan, PagePlanSection } from "./page-plan.ts";

export const PLAN_ATTRIBUTE_NAMES = {
  plan: "data-moire-plan",
  tone: "data-moire-tone",
  container: "data-moire-container",
  columns: "data-moire-columns",
  surface: "data-moire-surface",
  /** media-first full-bleed 섹션에서 안전 여백 밖으로 흘려보낼 미디어 묶음입니다. */
  media: "data-moire-media",
} as const;

/** 어떤 근거로 plan과 DOM을 이었는지. fallback 의존도를 관측해 다음 단계 판단에 씁니다. */
export type PlanAttributeMapping = { byId: number; byType: number; byAnchor: number; unmatched: number; edgeMedia: number };

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
type Axes = { plan: string; tone: string; container?: string; columns?: string; surface?: string; media?: string };

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
    [PLAN_ATTRIBUTE_NAMES.media, axes.media],
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


const MEDIA_TAGS = /<(?:img|picture|video)[\s>]/i;
/**
 * 제목·버튼·폼처럼 그 자체로 읽히는 콘텐츠 태그입니다. 하나라도 있으면 미디어 전용 묶음이 아닙니다.
 *
 * figcaption은 여기 없습니다. 이미지에 종속된 passive caption이라 이미지와 함께 흘러가도 되고,
 * 대신 캡션이 화면 끝에 붙지 않도록 plan-layout-css가 작은 local padding을 따로 보장합니다.
 */
const CONTENT_TAGS = /<(?:h[1-6]|p|blockquote|button|label|input|select|textarea|form|fieldset|table|dl|dt|dd|address)[\s>]/i;

/**
 * 섹션의 직계 자식만 훑습니다. 임의 깊이의 자손은 보지 않습니다.
 */
function directChildren(html: string, openEnd: number, contentEnd: number) {
  const body = html.slice(openEnd + 1, contentEnd);
  const pattern = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  const found: { start: number; openEnd: number; tag: string; attributes: string; inner: string }[] = [];
  let depth = 0;
  let pending: { start: number; openEnd: number; tag: string; attributes: string } | null = null;
  for (const match of body.matchAll(pattern)) {
    const closing = match[1] === "/";
    const tag = match[2].toLowerCase();
    const attributes = match[3] ?? "";
    const selfClosing = attributes.trimEnd().endsWith("/") || VOID_TAGS.has(tag);
    if (closing) {
      if (depth === 1 && pending) {
        found.push({ ...pending, inner: body.slice(pending.openEnd + 1, match.index) });
        pending = null;
      }
      depth -= 1;
      continue;
    }
    if (selfClosing) continue;
    if (depth === 0) pending = { start: openEnd + 1 + match.index, openEnd: match.index + match[0].length - 1, tag, attributes };
    depth += 1;
  }
  return found.map((child) => ({ ...child, openEnd: openEnd + 1 + child.openEnd }));
}


/** 태그를 걷어 낸 뒤 남는, 화면에 실제로 보이는 글자입니다. span 안의 라벨까지 잡습니다. */
function visibleText(inner: string) {
  return inner
    .replace(/<!--[\s\S]*?-->/g, "")
    // 이미지에 딸린 캡션은 본문이 아니라 사진의 일부로 봅니다.
    .replace(/<figcaption[\s>][\s\S]*?<\/figcaption>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
}

/**
 * 이 자식이 "미디어만" 담고 있는지 보수적으로 판정합니다.
 *
 * 셋을 모두 만족해야 합니다.
 * 1) 미디어를 하나 이상 담는다
 * 2) 캡션·버튼 같은 콘텐츠 태그가 하나도 없다
 * 3) 태그를 걷어 냈을 때 남는 글자가 하나도 없다
 *
 * 3) 덕분에 <span>라벨</span>처럼 태그 목록에 없는 요소로 감싼 글자도 걸러집니다.
 * 반대로 <a><img></a> 래퍼와 <figcaption>은 글자가 남지 않아 그대로 통과합니다.
 */
function isMediaOnly(inner: string) {
  if (!MEDIA_TAGS.test(inner)) return false;
  if (CONTENT_TAGS.test(inner)) return false;
  return visibleText(inner).length === 0;
}

/**
 * media-first 섹션이 full-bleed일 때, 이미지 묶음인 직계 자식만 골라 냅니다.
 *
 * 판정은 구조로만 하고, 보수적으로 봅니다(isMediaOnly).
 * 이미지만 든 묶음과 <a><img></a> 래퍼는 통과하고, 캡션·라벨·버튼이 함께 있는 묶음은 제외됩니다.
 * 임의 깊이의 img를 싸잡아 전폭으로 만들지 않습니다.
 */
function edgeMediaChildren(html: string, element: Element, section: PagePlanSection) {
  if (section.container !== "full-bleed") return [];
  if (!SECTION_TYPES[section.type]?.mediaFirst) return [];
  return directChildren(html, element.openEnd, element.contentEnd).filter((child) => isMediaOnly(child.inner));
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
  const mapping: PlanAttributeMapping = { byId: 0, byType: 0, byAnchor: 0, unmatched: 0, edgeMedia: 0 };

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


  /**
   * 섹션 여는 태그와 media-first 섹션의 미디어 자식 태그를 한 목록으로 모아
   * 뒤에서부터 한 번에 씁니다. 앞쪽 인덱스가 밀리지 않게 하려면 순서가 중요합니다.
   */
  type Edit = { start: number; openEnd: number; tag: string; attributes: string; axes: Axes };
  const edits: Edit[] = [];
  for (const index of assigned.keys()) {
    const element = elements[index];
    const axes = assigned.get(index) as Axes;
    edits.push({ start: element.start, openEnd: element.openEnd, tag: element.tag, attributes: element.attributes, axes });
    const section = axes.plan === "hero" ? undefined : plan.sections.find((item) => item.id === axes.plan);
    if (!section) continue;
    for (const child of edgeMediaChildren(html, element, section)) {
      edits.push({ start: child.start, openEnd: child.openEnd, tag: child.tag, attributes: child.attributes, axes: { plan: "", tone: "", media: "edge" } });
      mapping.edgeMedia += 1;
    }
  }

  let output = html;
  for (const edit of edits.sort((left, right) => right.start - left.start)) {
    output = `${output.slice(0, edit.start)}<${edit.tag}${writeAttributes(edit.attributes, edit.axes)}>${output.slice(edit.openEnd + 1)}`;
  }
  return { html: output, mapping };
}
