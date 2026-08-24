/**
 * 일반 섹션 이미지의 실제 로드 가능 여부를 저장 전에 검증합니다.
 *
 * 상품 영역은 대상이 아닙니다. 상품 사진과 Cafe24 binding은 코드가 소유하므로 건드리지 않습니다.
 * 검증은 오탐이 더 나쁩니다. 멀쩡한 이미지를 fallback으로 바꾸면 디자인이 망가지므로
 * 확정적인 4xx만 깨진 것으로 판정하고, 네트워크 오류는 재시도 후에도 판정을 보류합니다.
 */

import {
  collectAssetReferences,
  createAssetAllowlist,
  isFreshlyCreatedImage,
  isFreshStockUrl,
  isManagedAssetUrl,
  type AssetReference,
  type AssetReferenceOrigin,
} from "./asset-policy.ts";

/** definitive는 응답이 왔지만 이미지로 그릴 수 없음이 확정된 경우입니다(재시도해도 같습니다). */
export type ImageProbeResult = { ok: boolean; httpStatus?: number; error?: string; definitive?: boolean };
export type ImageProbe = (url: string) => Promise<ImageProbeResult>;

export type ImageVerdict =
  /** 로드할 수 있습니다. */
  | "ok"
  /** src가 비었거나 asset://N이 남았거나 테마 로컬 경로처럼 지금 로드할 수 없는 참조입니다. */
  | "invalid-reference"
  /** 이번 생성/세션 자산이 아닙니다. */
  | "out-of-scope"
  /** 서버가 없다고 확정 응답했습니다. */
  | "missing"
  /** 재시도 후에도 확인하지 못했습니다. 판정을 보류하고 그대로 둡니다. */
  | "unverified";

export type ImageCheck = {
  url: string;
  where: AssetReferenceOrigin;
  label?: string;
  verdict: ImageVerdict;
  httpStatus?: number;
  detail?: string;
};

/** 판정이 확정된 실패만 고칩니다. unverified는 손대지 않습니다. */
export function isRepairableVerdict(verdict: ImageVerdict) {
  return verdict === "invalid-reference" || verdict === "out-of-scope" || verdict === "missing";
}

const DEFINITIVE_MISSING_STATUS = new Set([400, 401, 403, 404, 410, 414, 415, 451]);

function isDefinitiveFailure(result: ImageProbeResult) {
  return result.definitive === true || (result.httpStatus !== undefined && DEFINITIVE_MISSING_STATUS.has(result.httpStatus));
}

/** 상품 영역 밖의 이미지 참조만 모읍니다. */
export function generalImageReferences(html: string, css: string): AssetReference[] {
  return collectAssetReferences(html, css).filter((reference) => !reference.inProductArea);
}

function staticVerdict(url: string, allowlist: ReturnType<typeof createAssetAllowlist>): ImageVerdict | null {
  const value = url.trim();
  if (!value) return "invalid-reference";
  if (/^asset:\/\//i.test(value)) return "invalid-reference";
  if (value.startsWith("/") && !value.startsWith("//")) return "invalid-reference";
  if (isFreshlyCreatedImage(value)) return "ok";
  if (value.startsWith("data:")) return "invalid-reference";
  if (allowlist.has(value)) return null;
  if (isManagedAssetUrl(value)) return "out-of-scope";
  if (isFreshStockUrl(value)) return null;
  return "out-of-scope";
}

async function probeWithRetry(url: string, probe: ImageProbe, attempts: number): Promise<ImageProbeResult> {
  let last: ImageProbeResult = { ok: false, error: "not probed" };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      last = await probe(url);
    } catch (error) {
      last = { ok: false, error: error instanceof Error ? error.message : "unknown probe error" };
    }
    if (last.ok) return last;
    // 확정 응답이면 더 시도하지 않습니다. 전송 오류만 다시 시도합니다.
    if (isDefinitiveFailure(last)) return last;
  }
  return last;
}

/**
 * 일반 섹션 이미지의 로드 가능 여부를 URL 단위로 한 번씩만 확인합니다.
 * 같은 주소가 여러 번 쓰여도 네트워크 확인은 한 번입니다.
 */
export async function verifyGeneralImages(input: {
  html: string;
  css: string;
  allowlist: ReturnType<typeof createAssetAllowlist>;
  probe: ImageProbe;
  /** 전송 오류일 때의 총 시도 횟수입니다. 기본 2회(최초 + 재시도 1회)입니다. */
  probeAttempts?: number;
}): Promise<ImageCheck[]> {
  const references = generalImageReferences(input.html, input.css);
  const byUrl = new Map<string, AssetReference>();
  for (const reference of references) {
    const key = reference.url.trim();
    if (!byUrl.has(key) || (!byUrl.get(key)?.label && reference.label)) byUrl.set(key, reference);
  }

  const checks: ImageCheck[] = [];
  for (const [url, reference] of byUrl) {
    const decided = staticVerdict(url, input.allowlist);
    if (decided) {
      checks.push({ url, where: reference.where, label: reference.label, verdict: decided });
      continue;
    }
    const result = await probeWithRetry(url, input.probe, Math.max(1, input.probeAttempts ?? 2));
    if (result.ok) {
      checks.push({ url, where: reference.where, label: reference.label, verdict: "ok", httpStatus: result.httpStatus });
      continue;
    }
    const definitive = isDefinitiveFailure(result);
    checks.push({
      url,
      where: reference.where,
      label: reference.label,
      verdict: definitive ? "missing" : "unverified",
      httpStatus: result.httpStatus,
      detail: result.error,
    });
  }
  return checks;
}

function replaceInAttribute(html: string, attribute: "src" | "srcset", from: string, to: string) {
  const pattern = new RegExp(`(\\b${attribute}\\s*=\\s*")([^"]*)(")`, "gi");
  return html.replace(pattern, (match, open: string, value: string, close: string) => {
    // 빈 src를 고칠 때는 값이 실제로 빈 자리만 채웁니다. includes("")는 모든 값에 걸리기 때문입니다.
    if (from === "") return attribute === "src" && value.trim() === "" ? `${open}${to}${close}` : match;
    if (!value.includes(from)) return match;
    return `${open}${value.split(from).join(to)}${close}`;
  });
}

function replaceInUrlFunction(text: string, from: string, to: string) {
  return text.replace(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi, (match, _quote: string, value: string) => {
    if (value.trim() !== from.trim()) return match;
    // 대체 주소에는 괄호가 들어갈 수 있으므로 항상 따옴표로 감쌉니다. 값 안의 따옴표는 escape되어 들어옵니다.
    return `url("${to.replaceAll('"', "%22")}")`;
  });
}

/**
 * 깨진 이미지 주소 하나만 바꿉니다.
 * src/srcset/url() 안에서만 교체하므로 본문 텍스트나 링크는 건드리지 않습니다.
 */
export function replaceImageReference(source: { html: string; css: string }, from: string, to: string) {
  const html = replaceInUrlFunction(replaceInAttribute(replaceInAttribute(source.html, "src", from, to), "srcset", from, to), from, to);
  return { html, css: replaceInUrlFunction(source.css, from, to) };
}
