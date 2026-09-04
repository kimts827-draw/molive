import { z } from "zod";
import { normalizeAttributionPayload } from "@/lib/growth/attribution";
import { CLIENT_REPORTABLE_EVENTS, recordEvent, recordUserEvent, attributionMetadata } from "@/lib/growth/events";
import { priceGroupForCampaign } from "@/lib/growth/pricing-config";
import { hasSupabaseServerConfig } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";

const schema = z.object({
  // 결제·가입처럼 결과를 뜻하는 이벤트는 브라우저가 만들 수 없다. 서버 경로에서만 기록된다.
  event: z.enum(CLIENT_REPORTABLE_EVENTS as [string, ...string[]]),
  sessionId: z.string().min(1).max(100),
  attribution: z.unknown().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * 비로그인 방문을 포함한 브라우저 발생 이벤트 수신구.
 * 브라우저는 events 테이블에 직접 접근하지 않고 이 라우트만 호출한다.
 */
export async function POST(request: Request) {
  if (!hasSupabaseServerConfig()) {
    return Response.json({ ok: false, error: "tracking_disabled" }, { status: 503 });
  }
  let parsed: z.infer<typeof schema>;
  try {
    parsed = schema.parse(await request.json());
  } catch {
    return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const event = parsed.event as "visit" | "checkout_view";
  const user = await getCurrentUser();

  if (user) {
    // 가입할 때 브라우저의 UTM은 계정으로 옮기고 지운다. 그래서 로그인 이후의 이벤트는
    // 클라이언트가 보낸 값이 아니라 프로필에 확정된 유입 정보를 기준으로 기록해야 한다.
    // 이걸 빠뜨리면 결제페이지 단계만 (direct)로 새어 퍼널 전환율이 깨진다.
    const recorded = await recordUserEvent(event, user.id, parsed.metadata ?? {}, parsed.sessionId);
    return Response.json({ ok: recorded }, { status: recorded ? 200 : 500 });
  }

  const attribution = normalizeAttributionPayload(parsed.attribution);
  const priceGroup = priceGroupForCampaign(attribution?.utmCampaign ?? null);
  const recorded = await recordEvent({
    eventName: event,
    userId: null,
    sessionId: parsed.sessionId,
    metadata: {
      ...attributionMetadata({
        utmSource: attribution?.utmSource ?? null,
        utmMedium: attribution?.utmMedium ?? null,
        utmCampaign: attribution?.utmCampaign ?? null,
        utmContent: attribution?.utmContent ?? null,
        priceGroup,
      }),
      ...(parsed.metadata ?? {}),
    },
  });

  return Response.json({ ok: recorded, priceGroup }, { status: recorded ? 200 : 500 });
}
