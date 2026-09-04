/**
 * First-touch 유입 정보 보관. 브라우저와 서버 양쪽에서 쓰는 순수 로직이다.
 *
 * 핵심 규칙: 저장된 값이 이미 있으면 절대 덮어쓰지 않는다.
 * 링크로 들어왔다가 나갔다가 직접 주소를 쳐서 다시 오는 경로가 흔하므로,
 * 마지막 유입이 아니라 첫 유입이 가입까지 살아남아야 한다.
 */

export const ATTRIBUTION_KEY = "molive:attribution";
export const SESSION_KEY = "molive:session-id";

export type Attribution = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  landedAt: string;
};

export const EMPTY_ATTRIBUTION: Attribution = {
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  landedAt: "",
};

function cleanValue(value: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 200);
}

/** URL 쿼리에서 UTM 4개를 읽는다. 하나도 없으면 null을 반환해 "유입 정보 없음"과 구분한다. */
export function parseUtmParams(search: string): Omit<Attribution, "landedAt"> | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  } catch {
    return null;
  }
  const parsed = {
    utmSource: cleanValue(params.get("utm_source")),
    utmMedium: cleanValue(params.get("utm_medium")),
    utmCampaign: cleanValue(params.get("utm_campaign")),
    utmContent: cleanValue(params.get("utm_content")),
  };
  const hasAny = Object.values(parsed).some((value) => value !== null);
  return hasAny ? parsed : null;
}

export function parseStoredAttribution(raw: string | null): Attribution | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Attribution>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      utmSource: cleanValue(parsed.utmSource ?? null),
      utmMedium: cleanValue(parsed.utmMedium ?? null),
      utmCampaign: cleanValue(parsed.utmCampaign ?? null),
      utmContent: cleanValue(parsed.utmContent ?? null),
      landedAt: typeof parsed.landedAt === "string" ? parsed.landedAt : "",
    };
  } catch {
    return null;
  }
}

/**
 * 저장된 값과 이번 URL을 합쳐 최종 first-touch 값을 결정한다.
 * stored가 있으면 그대로 유지하고(write=false), 없을 때만 이번 UTM을 새로 기록한다.
 */
export function resolveFirstTouch(
  storedRaw: string | null,
  search: string,
  now: string,
): { attribution: Attribution | null; write: boolean } {
  const stored = parseStoredAttribution(storedRaw);
  if (stored) return { attribution: stored, write: false };
  const incoming = parseUtmParams(search);
  if (!incoming) return { attribution: null, write: false };
  return { attribution: { ...incoming, landedAt: now }, write: true };
}

export function createSessionId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** 시크릿 모드 등 저장소가 막힌 브라우저에서도 추적이 페이지를 깨뜨리지 않는다. */
function safeGet(storage: StorageLike | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(storage: StorageLike | null, key: string, value: string) {
  try {
    storage?.setItem(key, value);
  } catch {
    // 저장이 막힌 브라우저에서는 이번 방문만 기록되고 소급 연결은 포기한다.
  }
}

export function safeRemove(storage: StorageLike | null, key: string) {
  try {
    storage?.removeItem(key);
  } catch {
    // 위와 동일.
  }
}

/** 첫 유입이면 저장하고, 이미 저장돼 있으면 그 값을 그대로 돌려준다. */
export function persistFirstTouch(storage: StorageLike | null, search: string, now = new Date().toISOString()) {
  const { attribution, write } = resolveFirstTouch(safeGet(storage, ATTRIBUTION_KEY), search, now);
  if (write && attribution) safeSet(storage, ATTRIBUTION_KEY, JSON.stringify(attribution));
  return attribution;
}

export function readFirstTouch(storage: StorageLike | null): Attribution | null {
  return parseStoredAttribution(safeGet(storage, ATTRIBUTION_KEY));
}

export function clearFirstTouch(storage: StorageLike | null) {
  safeRemove(storage, ATTRIBUTION_KEY);
}

/** 비로그인 방문을 식별하는 브라우저 고정 id. 가입 시 이전 방문을 소급 연결하는 열쇠다. */
export function ensureSessionId(storage: StorageLike | null): string {
  const existing = safeGet(storage, SESSION_KEY);
  if (existing && existing.length <= 100) return existing;
  const created = createSessionId();
  safeSet(storage, SESSION_KEY, created);
  return created;
}

/** 서버가 받은 payload를 DB 컬럼 형태로 정규화한다. */
export function attributionColumns(attribution: Attribution | null) {
  return {
    utm_source: attribution?.utmSource ?? null,
    utm_medium: attribution?.utmMedium ?? null,
    utm_campaign: attribution?.utmCampaign ?? null,
    utm_content: attribution?.utmContent ?? null,
  };
}

export function normalizeAttributionPayload(input: unknown): Attribution | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  const attribution = {
    utmSource: cleanValue(typeof value.utmSource === "string" ? value.utmSource : null),
    utmMedium: cleanValue(typeof value.utmMedium === "string" ? value.utmMedium : null),
    utmCampaign: cleanValue(typeof value.utmCampaign === "string" ? value.utmCampaign : null),
    utmContent: cleanValue(typeof value.utmContent === "string" ? value.utmContent : null),
    landedAt: typeof value.landedAt === "string" ? value.landedAt : "",
  };
  return Object.values(attribution).some((item) => item) ? attribution : null;
}
