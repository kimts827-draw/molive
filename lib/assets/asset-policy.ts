/**
 * 프로젝트별 이미지 세션 격리 규칙입니다.
 *
 * 생성 결과에 들어갈 수 있는 이미지는 세 종류뿐입니다.
 *  1. 이번 생성 요청에서 사용자가 첨부한 이미지(= 이번 이미지 세션에 업로드된 파일)
 *  2. 현재 프로젝트에 명시적으로 연결된 이미지(project_assets)
 *  3. 이번 생성 과정에서 새로 만든 이미지(data: URI 또는 이번 실행에서 만들어 등록한 주소)
 *
 * 이전 프로젝트/이전 세션에 저장된 이미지는 같은 계정의 것이라도 자동 재사용하지 않습니다.
 * 상품 영역과 브랜드/무드 섹션의 규칙은 아래에서 분리해 정의합니다.
 */

import type { SafetyViolation } from "../cafe24/protection.ts";

export const ASSET_BUCKET = "project-assets";

/** 브랜드/무드 섹션에서만 허용하는 신규 스톡 호스트입니다. 상품 영역에는 적용되지 않습니다. */
const FRESH_STOCK_HOSTS = new Set(["images.unsplash.com"]);

/**
 * 상품 영역 규칙: 상품 사진은 Cafe24 상품 이미지 바인딩만 소유합니다.
 * AI도 사용자도 상품 섹션 안에 사진을 넣지 않습니다(업종 불일치 이미지 유입 경로 차단).
 */
export const PRODUCT_AREA_IMAGE_POLICY = "product-area:cafe24-binding-only" as const;

/**
 * 브랜드/무드 규칙: 이번 세션 첨부 → 현재 프로젝트 연결 자산 → 이번 실행에서 만든 이미지 순으로만 씁니다.
 * 그 외 저장 자산 주소는 소유자가 같아도 사용하지 않습니다.
 */
export const BRAND_IMAGE_POLICY = "brand-area:session-scoped" as const;

export type AssetKind = "logo" | "image" | "product" | "reference" | "generated";

export type AssetAllowlistInput = {
  /** 이번 생성 요청의 첨부 이미지 주소입니다. */
  attachments?: readonly string[];
  /** 현재 프로젝트에 명시적으로 연결된 이미지 주소입니다. */
  projectAssets?: readonly string[];
  /** 이번 생성 과정에서 새로 만들어 등록한 이미지 주소입니다. */
  generated?: readonly string[];
};

export type AssetAllowlist = {
  readonly size: number;
  has(url: string): boolean;
};

export type AssetReferenceOrigin = "html-src" | "html-srcset" | "html-style" | "css-url";

export type AssetReference = {
  url: string;
  where: AssetReferenceOrigin;
  inProductArea: boolean;
  /** 이미지를 다시 만들어야 할 때 쓰는 설명입니다. img는 alt, CSS는 선택자에서 가져옵니다. */
  label?: string;
};

function assetSegment(value: string) {
  const trimmed = value.trim();
  if (!trimmed || !/^[A-Za-z0-9._-]+$/.test(trimmed)) throw new Error("이미지 세션 경로 값이 올바르지 않습니다.");
  return trimmed;
}

export function assetSessionPrefix(ownerId: string, sessionId: string) {
  return `${assetSegment(ownerId)}/sessions/${assetSegment(sessionId)}/`;
}

export function projectAssetPrefix(ownerId: string, projectId: string) {
  return `${assetSegment(ownerId)}/projects/${assetSegment(projectId)}/`;
}

export function buildAssetSessionPath(ownerId: string, sessionId: string, kind: AssetKind, fileId: string) {
  return `${assetSessionPrefix(ownerId, sessionId)}${assetSegment(kind)}-${assetSegment(fileId)}.webp`;
}

export function buildProjectAssetPath(ownerId: string, projectId: string, kind: AssetKind, fileId: string) {
  return `${projectAssetPrefix(ownerId, projectId)}${assetSegment(kind)}-${assetSegment(fileId)}.webp`;
}

function safePrefix(build: () => string) {
  try { return build(); } catch { return null; }
}

export function isAssetSessionPath(path: string, ownerId: string, sessionId: string) {
  const prefix = safePrefix(() => assetSessionPrefix(ownerId, sessionId));
  return prefix !== null && path.startsWith(prefix) && !path.includes("..");
}

export function isProjectAssetPath(path: string, ownerId: string, projectId: string) {
  const prefix = safePrefix(() => projectAssetPrefix(ownerId, projectId));
  return prefix !== null && path.startsWith(prefix) && !path.includes("..");
}

/** Supabase Storage가 서빙하는 자산 주소에서 storage path를 되돌립니다. 아니면 null입니다. */
export function managedAssetStoragePath(url: string): string | null {
  const match = url.match(new RegExp(`/storage/v\\d+/object/(?:public|sign|authenticated)/${ASSET_BUCKET}/([^?#]+)`));
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return match[1]; }
}

export function isManagedAssetUrl(url: string) {
  return managedAssetStoragePath(url) !== null;
}

export function isFreshlyCreatedImage(url: string) {
  return /^data:image\/(?:svg\+xml|png|jpeg|webp|avif|gif)[;,]/i.test(url.trim());
}

export function isFreshStockUrl(url: string) {
  try { return FRESH_STOCK_HOSTS.has(new URL(url).host); } catch { return false; }
}

/** 테마 안에서 해결되는 상대 경로는 다른 프로젝트 자산이 될 수 없으므로 검사 대상이 아닙니다. */
function isThemeLocalPath(url: string) {
  return url.startsWith("/") && !url.startsWith("//");
}

function normalizeUrl(url: string) {
  const trimmed = url.trim();
  const path = managedAssetStoragePath(trimmed);
  return path ? `${ASSET_BUCKET}:${path}` : trimmed;
}

export function createAssetAllowlist(input: AssetAllowlistInput): AssetAllowlist {
  const allowed = new Set<string>();
  for (const group of [input.attachments, input.projectAssets, input.generated]) {
    for (const url of group ?? []) {
      const trimmed = url.trim();
      if (trimmed) allowed.add(normalizeUrl(trimmed));
    }
  }
  return { size: allowed.size, has: (url: string) => allowed.has(normalizeUrl(url)) };
}

function sectionRanges(html: string) {
  const ranges: Array<{ start: number; end: number }> = [];
  const open: number[] = [];
  for (const match of html.matchAll(/<(\/?)section\b[^>]*>/gi)) {
    const index = match.index ?? 0;
    if (match[1]) {
      const start = open.pop();
      if (start !== undefined) ranges.push({ start, end: index + match[0].length });
    } else open.push(index);
  }
  return ranges;
}

/** 상품 슬롯을 품은 가장 안쪽 section 범위입니다. section이 없으면 슬롯 요소 자리만 봅니다. */
export function productAreaRanges(html: string) {
  const ranges = sectionRanges(html);
  const areas: Array<{ start: number; end: number }> = [];
  for (const slot of html.matchAll(/data-cafe24-slot\s*=\s*["']product-list["']/gi)) {
    const index = slot.index ?? 0;
    const containing = ranges.filter((range) => range.start <= index && index < range.end).sort((a, b) => b.start - a.start)[0];
    areas.push(containing ?? { start: Math.max(0, html.lastIndexOf("<", index)), end: index + slot[0].length });
  }
  return areas;
}

function inRanges(index: number, ranges: Array<{ start: number; end: number }>) {
  return ranges.some((range) => range.start <= index && index < range.end);
}

function srcsetUrls(value: string) {
  return value.split(",").map((candidate) => candidate.trim().split(/\s+/)[0]).filter(Boolean);
}

function cssUrls(value: string) {
  return [...value.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)].map((match) => match[2].trim());
}

/**
 * HTML/CSS 안의 모든 이미지 참조를 상품 영역 여부·설명과 함께 모읍니다.
 * 빈 src와 테마 로컬 경로도 그대로 돌려줍니다. 검증 단계가 그것들을 깨진 참조로 잡아야 하기 때문입니다.
 */
export function collectAssetReferences(html: string, css: string): AssetReference[] {
  const references: AssetReference[] = [];
  const productAreas = productAreaRanges(html);

  for (const tag of html.matchAll(/<img\b[^>]*>/gi)) {
    const index = tag.index ?? 0;
    const inProductArea = inRanges(index, productAreas);
    const label = tag[0].match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1]?.trim() || undefined;
    const src = tag[0].match(/\bsrc\s*=\s*["']([^"']*)["']/i);
    if (src) references.push({ url: src[1].trim(), where: "html-src", inProductArea, label });
    const srcset = tag[0].match(/\bsrcset\s*=\s*["']([^"']*)["']/i)?.[1];
    for (const candidate of srcsetUrls(srcset ?? "")) references.push({ url: candidate, where: "html-srcset", inProductArea, label });
  }

  for (const attribute of html.matchAll(/\bstyle\s*=\s*["']([^"']*)["']/gi)) {
    const index = attribute.index ?? 0;
    const inProductArea = inRanges(index, productAreas);
    for (const url of cssUrls(attribute[1])) references.push({ url, where: "html-style", inProductArea });
  }

  for (const rule of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const label = rule[1].replace(/\/\*[\s\S]*?\*\//g, "").trim().slice(0, 120) || undefined;
    for (const url of cssUrls(rule[2])) references.push({ url, where: "css-url", inProductArea: false, label });
  }

  return references;
}

/** 정책 감사 대상이 아닌 참조입니다. 빈 값과 테마 로컬 경로는 오염이 아니라 로드 문제로 다룹니다. */
export function isPolicyExemptReference(url: string) {
  return !url.trim() || isThemeLocalPath(url);
}

export type AssetAuditOptions = {
  /** 브랜드/무드 섹션에서 신규 스톡 이미지를 쓸 수 있는지 여부입니다. 상품 영역은 언제나 금지입니다. */
  allowFreshStock?: boolean;
};

/**
 * 생성 결과의 이미지 사용을 감사합니다.
 * - 상품 영역: 어떤 사진도 허용하지 않습니다(PRODUCT_AREA_IMAGE).
 * - 브랜드/무드: allowlist와 이번 실행에서 만든 이미지만 허용하고, 그 외 저장 자산은 오염으로 봅니다(FOREIGN_ASSET).
 */
export function auditGeneratedAssets(
  source: { html: string; css: string },
  allowlist: AssetAllowlist,
  options: AssetAuditOptions = {},
): SafetyViolation[] {
  const violations: SafetyViolation[] = [];
  const seen = new Set<string>();

  for (const reference of collectAssetReferences(source.html, source.css)) {
    if (isPolicyExemptReference(reference.url)) continue;
    if (reference.inProductArea) {
      const key = `product:${reference.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      violations.push({
        code: "PRODUCT_AREA_IMAGE",
        message: "상품 영역의 사진은 Cafe24 상품 이미지 바인딩만 소유합니다. 상품 섹션 안에 이미지를 직접 넣을 수 없습니다.",
        token: reference.url.slice(0, 120),
      });
      continue;
    }
    if (allowlist.has(reference.url)) continue;
    if (isFreshlyCreatedImage(reference.url)) continue;
    if (!isManagedAssetUrl(reference.url) && options.allowFreshStock !== false && isFreshStockUrl(reference.url)) continue;
    const key = `foreign:${reference.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    violations.push({
      code: "FOREIGN_ASSET",
      message: isManagedAssetUrl(reference.url)
        ? "이번 생성 세션이나 현재 프로젝트에 연결되지 않은 저장 이미지는 사용할 수 없습니다. 이전 프로젝트 이미지는 자동 재사용하지 않습니다."
        : "허용되지 않은 이미지 주소입니다. 첨부 이미지(asset://N), 현재 프로젝트 자산, 이번 생성에서 만든 이미지만 사용할 수 있습니다.",
      token: reference.url.slice(0, 120),
    });
  }
  return violations;
}

/** asset://N 참조가 이번 요청의 첨부 개수를 벗어나지 않는지 확인합니다. */
export function auditAssetReferenceTokens(source: { html: string; css: string }, attachmentCount: number): SafetyViolation[] {
  const violations: SafetyViolation[] = [];
  const seen = new Set<string>();
  for (const match of `${source.html}\n${source.css}`.matchAll(/asset:\/\/(\d+)/g)) {
    if (Number(match[1]) < attachmentCount || seen.has(match[0])) continue;
    seen.add(match[0]);
    violations.push({
      code: "ASSET_REFERENCE_OUT_OF_RANGE",
      message: `이번 요청의 첨부 이미지는 ${attachmentCount}개뿐입니다. 존재하지 않는 첨부를 참조할 수 없습니다.`,
      token: match[0],
    });
  }
  return violations;
}

export type AttachmentScopeInput = {
  ownerId: string;
  sessionId?: string | null;
  assetUrls?: readonly string[];
  assetPaths?: readonly string[];
};

export type AttachmentScopeResult = { ok: true } | { ok: false; message: string; token?: string };

/**
 * 요청으로 들어온 첨부가 전부 이번 이미지 세션의 것인지 확인합니다.
 * 이전 세션이나 다른 프로젝트의 저장 경로가 섞여 들어오면 생성을 시작하지 않습니다.
 */
export function validateAttachmentScope(input: AttachmentScopeInput): AttachmentScopeResult {
  const urls = (input.assetUrls ?? []).filter((url) => url.trim());
  const paths = (input.assetPaths ?? []).filter((path) => path.trim());
  if (!urls.length && !paths.length) return { ok: true };

  const sessionId = input.sessionId?.trim();
  if (!sessionId) return { ok: false, message: "이미지 세션 정보가 없어 첨부 이미지를 사용할 수 없습니다. 이미지를 다시 첨부해 주세요." };

  const outOfSession = "이번 생성 세션에 업로드한 이미지만 사용할 수 있습니다. 이전 프로젝트의 이미지는 자동으로 재사용되지 않습니다.";
  for (const path of paths) {
    if (!isAssetSessionPath(path, input.ownerId, sessionId)) return { ok: false, message: outOfSession, token: path };
  }
  for (const url of urls) {
    if (isFreshlyCreatedImage(url)) continue;
    const storagePath = managedAssetStoragePath(url);
    if (!storagePath) return { ok: false, message: "직접 업로드한 이미지만 첨부할 수 있습니다.", token: url.slice(0, 120) };
    if (!isAssetSessionPath(storagePath, input.ownerId, sessionId)) return { ok: false, message: outOfSession, token: storagePath };
  }
  return { ok: true };
}
