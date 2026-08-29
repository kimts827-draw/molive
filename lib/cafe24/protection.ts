import { PLAN_ATTRIBUTE_NAMES } from "../design-library/plan-attributes.ts";
import type { ProjectSource } from "@/lib/project-source";

export type ProtectionLevel = "protected" | "restricted" | "presentation";
export type SafetyViolation = { code: string; message: string; token?: string };
export type SafetyReport = { safe: boolean; path: string; level: ProtectionLevel; violations: SafetyViolation[] };
export type ProjectSourceReport = {
  safe: boolean;
  violations: SafetyViolation[];
  stats: { htmlBytes: number; cssBytes: number; editableNodes: number; sections: number; commerceSlots: number };
};

const PROTECTED_PATHS = [/^order\/ec_orderform\//, /^js\/module\/order\/ec_orderform\//, /^css\/module\/order\/ec_orderform\//, /^js\/module\//];
const RESTRICTED_PATHS = [/^order\//, /^member\//, /^myshop\//, /^coupon\//, /^product\/(detail|basket_option|add_basket|layer_option|stocklayer)/, /^js\/common\.js$/, /^layout\/basic\/js\//];
const PRESENTATION_PATHS = [/^index\.html$/, /^layout\/basic\/(main|layout|navigation|footer|topbanner)\.html$/, /^layout\/basic\/css\/(main|layout|common)\.css$/, /^css\/c24ai-[a-z0-9-]+\.css$/, /^SkinImg\/c24ai\//];
const EDITABLE_TAGS = /<(header|footer|section|h[1-6]|p|img|a|button)\b([^>]*)>/gi;
const MANAGED_REGION_PATTERN = /<!--\s*C24AI:START\s*-->[\s\S]*?<!--\s*C24AI:END\s*-->/g;

export const PROTECTED_SYMLINK_COUNT = 50;

export function normalizeThemePath(path: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || normalized.includes("\0")) throw new Error("유효하지 않은 Cafe24 테마 경로입니다.");
  return normalized.replace(/^skin\d+\//, "");
}

export function classifyThemePath(path: string): ProtectionLevel {
  const normalized = normalizeThemePath(path);
  if (PROTECTED_PATHS.some((pattern) => pattern.test(normalized))) return "protected";
  if (RESTRICTED_PATHS.some((pattern) => pattern.test(normalized))) return "restricted";
  if (PRESENTATION_PATHS.some((pattern) => pattern.test(normalized))) return "presentation";
  return "restricted";
}

function multiset(source: string, pattern: RegExp): Map<string, number> {
  const result = new Map<string, number>();
  for (const match of source.matchAll(pattern)) {
    const token = match[0].replace(/\s+/g, " ").trim();
    result.set(token, (result.get(token) ?? 0) + 1);
  }
  return result;
}

function compareMultisets(label: string, before: Map<string, number>, after: Map<string, number>): SafetyViolation[] {
  const violations: SafetyViolation[] = [];
  const tokens = new Set([...before.keys(), ...after.keys()]);
  for (const token of tokens) {
    const beforeCount = before.get(token) ?? 0;
    const afterCount = after.get(token) ?? 0;
    if (beforeCount !== afterCount) violations.push({ code: `COMMERCE_${label.toUpperCase()}_CHANGED`, message: `${label} 보호 토큰 수가 ${beforeCount}개에서 ${afterCount}개로 변경되었습니다.`, token });
  }
  return violations;
}

export function extractCommerceFingerprint(source: string) {
  return {
    modules: multiset(source, /module\s*=\s*["'][^"']+["']/gi),
    variables: multiset(source, /\{\$[^}\r\n]+\}/g),
    directives: multiset(source, /<!--\s*@(layout|css|js|import)\([^)]*\)\s*-->/gi),
    forms: multiset(source, /<(form|input|select|textarea|button)\b[^>]*(?:name|id|action|onclick)\s*=\s*["'][^"']+["'][^>]*>/gi),
    commerceIds: multiset(source, /\bid\s*=\s*["'](?:order|basket|member|product|option|quantity|total|payment)[^"']*["']/gi),
  };
}

export function validateThemeMutation(path: string, before: string, after: string): SafetyReport {
  const normalized = normalizeThemePath(path);
  const level = classifyThemePath(normalized);
  const violations: SafetyViolation[] = [];
  if (level === "protected") return { safe: false, path: normalized, level, violations: [{ code: "PROTECTED_FILE", message: "Cafe24 보호 파일은 어떤 경우에도 수정할 수 없습니다." }] };
  if (level === "restricted" && before !== after) return { safe: false, path: normalized, level, violations: [{ code: "RESTRICTED_HTML", message: "이 파일은 커머스 기능과 연결되어 HTML 변경이 제한됩니다. 별도 CSS 오버레이만 사용하세요." }] };

  const beforeFingerprint = extractCommerceFingerprint(before);
  const afterFingerprint = extractCommerceFingerprint(after);
  for (const key of Object.keys(beforeFingerprint) as Array<keyof typeof beforeFingerprint>) violations.push(...compareMultisets(key, beforeFingerprint[key], afterFingerprint[key]));

  const outsideBefore = before.replace(MANAGED_REGION_PATTERN, "");
  const outsideAfter = after.replace(MANAGED_REGION_PATTERN, "");
  if (before.includes("C24AI:START") && outsideBefore !== outsideAfter) violations.push({ code: "OUTSIDE_MANAGED_REGION", message: "MOLIVE 관리 영역 밖의 원본 코드가 변경되었습니다." });
  const generatedSource = (after.match(MANAGED_REGION_PATTERN) ?? []).join("\n");
  if (/<script\b/i.test(generatedSource) || /\son\w+\s*=/i.test(generatedSource)) violations.push({ code: "UNSAFE_SCRIPT", message: "AI 생성 HTML에는 script 또는 인라인 이벤트 핸들러를 포함할 수 없습니다." });
  return { safe: violations.length === 0, path: normalized, level, violations };
}

export function sanitizePresentationCss(css: string): string {
  const forbidden = [/@import/gi, /expression\s*\(/gi, /javascript\s*:/gi, /behavior\s*:/gi, /-moz-binding/gi, /url\s*\(\s*['"]?data:text\/html/gi, /<\/style/gi];
  if (forbidden.some((pattern) => pattern.test(css))) throw new Error("허용되지 않는 CSS 표현이 포함되어 있습니다.");
  return css;
}

function inferNodeType(tag: string, attributes: string) {
  const explicit = attributes.match(/data-moire-type\s*=\s*["']([^"']+)["']/i)?.[1];
  if (explicit) return explicit;
  if (tag === "img") return "image";
  if (tag === "a" || tag === "button") return "button";
  if (tag === "header" || tag === "footer" || tag === "section") return tag;
  return "text";
}

export function ensureEditingMetadata(html: string, idPrefix = "moire") {
  let index = 0;
  return html.replace(EDITABLE_TAGS, (_opening, rawTag: string, rawAttributes: string) => {
    const tag = rawTag.toLowerCase();
    let attributes = rawAttributes;
    if (!/\bdata-moire-id\s*=/i.test(attributes)) attributes += ` data-moire-id="${idPrefix}-${tag}-${++index}"`;
    if (!/\bdata-moire-type\s*=/i.test(attributes)) attributes += ` data-moire-type="${inferNodeType(tag, attributes)}"`;
    return `<${rawTag}${attributes}>`;
  });
}

function cssSelectors(css: string) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const selectors: string[] = [];
  for (const match of clean.matchAll(/([^{}]+)\{/g)) {
    const prelude = match[1].trim();
    if (!prelude || prelude.startsWith("@") || /^(from|to|\d+(?:\.\d+)?%)$/.test(prelude)) continue;
    selectors.push(prelude);
  }
  return selectors;
}

function htmlSafetyViolations(html: string): SafetyViolation[] {
  const violations: SafetyViolation[] = [];
  const checks: Array<[RegExp, string, string]> = [
    [/<(?:script|iframe|object|embed|base|meta|link)\b/i, "UNSAFE_HTML_TAG", "실행 또는 외부 문서 주입이 가능한 HTML 태그가 포함되어 있습니다."],
    [/\son\w+\s*=/i, "INLINE_EVENT", "인라인 이벤트 핸들러는 허용되지 않습니다."],
    [/javascript\s*:/i, "JAVASCRIPT_URL", "javascript URL은 허용되지 않습니다."],
    [/<(?:form|input|select|textarea)\b/i, "COMMERCE_CONTROL", "AI Presentation 소스는 form 또는 입력 컨트롤을 만들 수 없습니다."],
    [/module\s*=\s*["']/i, "CAFE24_MODULE_IN_SOURCE", "Cafe24 module은 AI 소스에 복사하지 않고 보호된 원본에서 마운트해야 합니다."],
    [/\{\$[^}\r\n]+\}/, "CAFE24_VARIABLE_IN_SOURCE", "Cafe24 변수는 AI 소스에서 직접 생성할 수 없습니다."],
    [/<!--\s*@(layout|css|js|import)\(/i, "CAFE24_DIRECTIVE_IN_SOURCE", "Cafe24 directive는 AI 소스에서 직접 생성할 수 없습니다."],
  ];
  for (const [pattern, code, message] of checks) if (pattern.test(html)) violations.push({ code, message });
  return violations;
}

export function validateProjectSource(source: Pick<ProjectSource, "html" | "css">): ProjectSourceReport {
  const violations = htmlSafetyViolations(source.html);
  try { sanitizePresentationCss(source.css); } catch (error) { violations.push({ code: "UNSAFE_CSS", message: error instanceof Error ? error.message : "CSS가 안전하지 않습니다." }); }
  const rootMatches = [...source.html.matchAll(/\bdata-moire-root\s*=\s*["']([^"']+)["']/gi)];
  if (rootMatches.length !== 1) violations.push({ code: "PROJECT_ROOT_COUNT", message: "Project Source에는 data-moire-root가 정확히 하나 있어야 합니다." });
  if (!/<main\b/i.test(source.html)) violations.push({ code: "PAGE_LANDMARKS", message: "페이지에 main 랜드마크가 필요합니다." });
  if (/<header\b/i.test(source.html)) violations.push({ code: "FIXED_HEADER_ONLY", message: "헤더는 고정 컴포넌트 HeaderV1이 담당합니다. header 요소를 직접 만들 수 없습니다." });
  if (/\bpocGrid__|\bpocHeader__/.test(source.html)) violations.push({ code: "FIXED_COMMERCE_ONLY", message: "상품 카드와 헤더 마크업은 고정 컴포넌트가 생성합니다. 직접 만들 수 없습니다." });

  const ids = new Map<string, number>();
  let editableNodes = 0;
  for (const match of source.html.matchAll(EDITABLE_TAGS)) {
    editableNodes += 1;
    const attrs = match[2];
    const id = attrs.match(/\bdata-moire-id\s*=\s*["']([^"']+)["']/i)?.[1];
    const type = attrs.match(/\bdata-moire-type\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!id || !type) violations.push({ code: "MISSING_EDIT_METADATA", message: `${match[1].toLowerCase()} 요소에 data-moire-id 또는 data-moire-type이 없습니다.` });
    if (id) ids.set(id, (ids.get(id) ?? 0) + 1);
  }
  for (const [id, count] of ids) if (count > 1) violations.push({ code: "DUPLICATE_EDIT_ID", message: `편집 ID ${id}가 ${count}번 사용되었습니다.`, token: id });

  const rootSelector = rootMatches[0]?.[1];
  for (const selectorGroup of cssSelectors(source.css)) {
    for (const selector of selectorGroup.split(",")) {
      if (!selector.includes("[data-moire-root")) violations.push({ code: "UNSCOPED_CSS", message: "모든 CSS 선택자는 data-moire-root 아래로 스코프되어야 합니다.", token: selector.trim() });
      if (rootSelector && /\[data-moire-root\s*=/.test(selector) && !selector.includes(rootSelector)) violations.push({ code: "WRONG_CSS_ROOT", message: "CSS root 값이 HTML의 data-moire-root와 다릅니다.", token: selector.trim() });
    }
  }

  const commerceSlots = [...source.html.matchAll(/data-cafe24-slot\s*=\s*["']product-list["']/gi)].length;
  if (commerceSlots < 1) violations.push({ code: "MISSING_PRODUCT_SLOT", message: "보호된 Cafe24 상품 모듈을 연결할 product-list 슬롯이 필요합니다." });
  return { safe: violations.length === 0, violations, stats: { htmlBytes: Buffer.byteLength(source.html), cssBytes: Buffer.byteLength(source.css), editableNodes, sections: [...source.html.matchAll(/<section\b/gi)].length, commerceSlots } };
}

export function validateNodePatch(input: { nodeId: string; rootValue: string; nodeHtml: string; nodeCss: string }) {
  const violations = htmlSafetyViolations(input.nodeHtml);
  try { sanitizePresentationCss(input.nodeCss); } catch (error) { violations.push({ code: "UNSAFE_CSS", message: error instanceof Error ? error.message : "CSS가 안전하지 않습니다." }); }
  const escaped = input.nodeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rootPattern = new RegExp(`^\\s*<[^>]+data-moire-id=["']${escaped}["']`, "i");
  if (!rootPattern.test(input.nodeHtml)) violations.push({ code: "NODE_ID_CHANGED", message: "AI 편집은 선택된 루트 data-moire-id를 유지해야 합니다." });
  for (const selector of cssSelectors(input.nodeCss)) {
    if (!selector.includes(`[data-moire-id="${input.nodeId}"]`) && !selector.includes(`[data-moire-id='${input.nodeId}']`)) violations.push({ code: "NODE_CSS_SCOPE", message: "AI 편집 CSS는 선택한 node ID에만 스코프되어야 합니다.", token: selector });
    if (!selector.includes(`[data-moire-root="${input.rootValue}"]`) && !selector.includes(`[data-moire-root='${input.rootValue}']`)) violations.push({ code: "NODE_ROOT_SCOPE", message: "AI 편집 CSS는 Project Source root 안에 스코프되어야 합니다.", token: selector });
  }
  return { safe: violations.length === 0, violations };
}

const PLAN_ATTRIBUTE_LIST = Object.values(PLAN_ATTRIBUTE_NAMES);
const PRODUCT_SLOT_PATTERN = /data-cafe24-slot/i;

function rootOpenTag(html: string) {
  return html.trim().match(/^<[^>]*>/)?.[0] ?? "";
}

function planAttributeMap(openTag: string) {
  const found = new Map<string, string>();
  for (const name of PLAN_ATTRIBUTE_LIST) {
    const value = openTag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1];
    if (value !== undefined) found.set(name, value);
  }
  return found;
}

/**
 * 노드 단위 검사만으로는 잡히지 않지만 문서 전체 계약을 깨는 변화를 막습니다.
 *
 * 상품 슬롯 유실·중복 생성과 header 생성은 Editor에서는 통과하고 ZIP/게시 단계의
 * validateProjectSource에서 터집니다. patch 단계에서 거절해야 사용자가 깨진 문서를 들고
 * 게시까지 갔다가 실패하지 않고, Credit도 소모되지 않습니다.
 *
 * new-section에서는 코드가 소유한 plan 축 속성과 section 루트 태그도 함께 지킵니다.
 */
export function validateNodePatchStructure(input: { operation: "node-edit" | "new-section"; before: string; after: string }) {
  const violations: SafetyViolation[] = [];
  const beforeSlot = PRODUCT_SLOT_PATTERN.test(input.before);
  const afterSlot = PRODUCT_SLOT_PATTERN.test(input.after);
  if (!beforeSlot && afterSlot) violations.push({ code: "PRODUCT_SLOT_CREATED", message: "상품 슬롯은 페이지에 하나뿐인 검증 영역입니다. 편집으로 새로 만들 수 없습니다." });
  if (beforeSlot && !afterSlot) violations.push({ code: "PRODUCT_SLOT_REMOVED", message: "선택 영역 안의 상품 슬롯을 없앨 수 없습니다. Cafe24 상품 진열이 사라집니다." });
  if (/<header[\s>]/i.test(input.after)) violations.push({ code: "HEADER_ELEMENT_CREATED", message: "헤더는 고정 컴포넌트 HeaderV1이 소유합니다. 편집으로 header 요소를 만들 수 없습니다." });

  if (input.operation === "new-section") {
    const afterRoot = rootOpenTag(input.after);
    if (!/^<section[\s>]/i.test(afterRoot)) violations.push({ code: "SECTION_ROOT_TAG_CHANGED", message: "새 섹션의 루트는 section 요소여야 합니다." });
    const before = planAttributeMap(rootOpenTag(input.before));
    const after = planAttributeMap(afterRoot);
    for (const [name, value] of before) {
      if (after.get(name) !== value) violations.push({ code: "PLAN_ATTRIBUTES_LOST", message: "새 섹션의 plan 축 속성은 코드가 소유합니다. 값을 그대로 유지해야 합니다.", token: name });
    }
  }
  return { safe: violations.length === 0, violations };
}

export function prepareProjectPatch(source: ProjectSource) {
  const report = validateProjectSource(source);
  if (!report.safe) throw new Error(`Project Source 보호 검사 실패: ${report.violations.map((item) => item.code).join(", ")}`);
  return { html: `<!-- C24AI:START -->\n${source.html}\n<!-- C24AI:END -->`, css: source.css };
}

export function injectManagedPresentation(original: string, managedHtml: string): string {
  const regionPattern = /<!--\s*C24AI:START\s*-->[\s\S]*?<!--\s*C24AI:END\s*-->/;
  if (regionPattern.test(original)) return original.replace(regionPattern, managedHtml);
  const layoutDirective = /<!--\s*@layout\([^)]*\)\s*-->/i;
  if (layoutDirective.test(original)) return original.replace(layoutDirective, (match) => `${match}\n${managedHtml}`);
  return `${managedHtml}\n${original}`;
}

export function inlinePresentationStyles(managedHtml: string, css: string): string {
  if (!managedHtml.includes("<!-- C24AI:START -->")) throw new Error("MOLIVE 관리 영역을 찾을 수 없습니다.");
  return managedHtml.replace("<!-- C24AI:START -->", `<!-- C24AI:START -->\n<style id="c24ai-theme-style">${sanitizePresentationCss(css)}</style>`);
}
