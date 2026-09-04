import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseServerConfig } from "@/lib/supabase/config";
import { DEFAULT_PRICE_GROUP, resolvePriceGroup } from "@/lib/growth/pricing-config";

/** 추적하는 이벤트 6개. 늘릴 때는 이 배열에 이름만 추가하면 된다. */
export const TRACKED_EVENTS = [
  "visit",
  "signup",
  "generate_start",
  "generate_done",
  "checkout_view",
  "purchase",
] as const;

export type TrackedEvent = (typeof TRACKED_EVENTS)[number];

/** 브라우저가 직접 보낼 수 있는 이벤트. purchase 같은 결과 이벤트는 서버만 기록한다. */
export const CLIENT_REPORTABLE_EVENTS: TrackedEvent[] = ["visit", "checkout_view"];

export type EventInput = {
  eventName: TrackedEvent;
  userId?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown>;
};

export type UserAttribution = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  priceGroup: string;
};

/**
 * 집계는 utm_campaign / price_group 기준으로만 하므로, 이벤트를 넣을 때 그 두 값을
 * metadata에 함께 박아 둔다. 나중에 프로필이 바뀌어도 당시 유입 기준 집계가 흔들리지 않고,
 * 조인 없이 events 한 테이블만 읽어 대시보드를 만들 수 있다.
 */
export async function loadUserAttribution(userId: string): Promise<UserAttribution | null> {
  if (!hasSupabaseServerConfig()) return null;
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("utm_source,utm_medium,utm_campaign,utm_content,price_group")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    utmSource: (data.utm_source as string | null) ?? null,
    utmMedium: (data.utm_medium as string | null) ?? null,
    utmCampaign: (data.utm_campaign as string | null) ?? null,
    utmContent: (data.utm_content as string | null) ?? null,
    priceGroup: resolvePriceGroup(data.price_group as string | null),
  };
}

function attributionMetadata(attribution: UserAttribution | null) {
  return {
    utm_source: attribution?.utmSource ?? null,
    utm_medium: attribution?.utmMedium ?? null,
    utm_campaign: attribution?.utmCampaign ?? null,
    utm_content: attribution?.utmContent ?? null,
    price_group: attribution?.priceGroup ?? DEFAULT_PRICE_GROUP,
  };
}

/**
 * 이벤트를 기록한다. 실패해도 예외를 던지지 않는다 — 추적이 결제나 생성 자체를 막으면 안 된다.
 * 대신 실패를 반드시 서버 로그에 남긴다. 조용히 사라지는 실패가 이 시스템의 최대 위험이다.
 */
export async function recordEvent(input: EventInput): Promise<boolean> {
  if (!hasSupabaseServerConfig()) {
    console.warn(`[growth] Supabase 설정이 없어 ${input.eventName} 이벤트를 기록하지 못했습니다.`);
    return false;
  }
  try {
    const { error } = await createAdminClient().from("events").insert({
      user_id: input.userId ?? null,
      session_id: input.sessionId ?? null,
      event_name: input.eventName,
      metadata: input.metadata ?? {},
    });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error(`[growth] ${input.eventName} 이벤트 기록 실패:`, error instanceof Error ? error.message : error);
    return false;
  }
}

/** 로그인 사용자의 이벤트. 유입 정보를 프로필에서 읽어 metadata에 함께 남긴다. */
export async function recordUserEvent(
  eventName: TrackedEvent,
  userId: string,
  metadata: Record<string, unknown> = {},
  sessionId?: string | null,
) {
  const attribution = await loadUserAttribution(userId);
  return recordEvent({
    eventName,
    userId,
    sessionId: sessionId ?? null,
    metadata: { ...attributionMetadata(attribution), ...metadata },
  });
}

export { attributionMetadata };

/**
 * 무료 크레딧 사용인지 유료 결제 사용자인지 구분한다.
 * 크레딧은 한 잔액에 섞이므로 개별 크레딧의 출처는 되짚을 수 없다.
 * 실제 판단에 필요한 것은 "결제한 사람의 생성인가"이므로 결제 이력 유무로 나눈다.
 */
export async function creditTypeForUser(userId: string): Promise<"free" | "paid"> {
  if (!hasSupabaseServerConfig()) return "free";
  try {
    const { data, error } = await createAdminClient()
      .from("orders")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "paid")
      .limit(1);
    if (error) throw error;
    return data && data.length > 0 ? "paid" : "free";
  } catch (error) {
    console.error("[growth] 결제 이력 조회 실패:", error instanceof Error ? error.message : error);
    return "free";
  }
}
