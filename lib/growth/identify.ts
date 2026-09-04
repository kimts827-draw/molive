import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { attributionColumns, type Attribution } from "@/lib/growth/attribution";
import { priceGroupForCampaign, resolvePriceGroup } from "@/lib/growth/pricing-config";
import { recordUserEvent } from "@/lib/growth/events";

export type IdentifyResult = {
  linkedEvents: number;
  priceGroup: string;
  utmCampaign: string | null;
  utmContent: string | null;
  signupRecorded: boolean;
  attributionWritten: boolean;
};

/**
 * 가입 직후 한 번 실행된다. 여러 번 불려도 안전하도록 모든 단계가 멱등이다.
 *
 * 1. 프로필에 first-touch UTM과 price_group을 기록한다. 이미 값이 있으면 건드리지 않는다.
 * 2. 같은 브라우저(session_id)의 이전 비로그인 이벤트에 user_id를 소급 연결한다.
 *    이 단계가 빠지면 방문에서 가입으로 이어지는 전환율을 계산할 수 없다.
 * 3. signup 이벤트를 계정당 한 번만 남긴다.
 */
export async function identifySignup(input: {
  userId: string;
  sessionId: string | null;
  attribution: Attribution | null;
}): Promise<IdentifyResult> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("utm_source,utm_medium,utm_campaign,utm_content,price_group")
    .eq("id", input.userId)
    .maybeSingle();

  const alreadyAttributed = Boolean(
    profile
    && (profile.utm_source || profile.utm_medium || profile.utm_campaign || profile.utm_content),
  );
  const assignedGroup = profile?.price_group as string | null | undefined;

  let utmCampaign = (profile?.utm_campaign as string | null) ?? null;
  let utmContent = (profile?.utm_content as string | null) ?? null;
  // 한 번 배정된 그룹은 고정이다. 같은 사용자가 매번 다른 가격을 보면 실험이 무의미해진다.
  let priceGroup = assignedGroup ? resolvePriceGroup(assignedGroup) : priceGroupForCampaign(input.attribution?.utmCampaign ?? null);
  let attributionWritten = false;

  if (!alreadyAttributed || !assignedGroup) {
    const patch: Record<string, unknown> = {};
    if (!alreadyAttributed && input.attribution) {
      Object.assign(patch, attributionColumns(input.attribution));
      utmCampaign = input.attribution.utmCampaign;
      utmContent = input.attribution.utmContent;
    }
    // UTM 없이 들어온 회원도 그룹은 배정한다. 이래야 가격 실험 집계에서 빠지지 않는다.
    if (!assignedGroup) patch.price_group = priceGroup;
    if (Object.keys(patch).length > 0) {
      const { error } = await admin.from("profiles").update(patch).eq("id", input.userId);
      if (error) {
        // UTM 저장 실패는 조용히 넘어가면 안 된다. 100건 발송 후에야 알게 되는 종류의 실패다.
        console.error("[growth] 프로필 유입 정보 저장 실패:", error.message);
      } else {
        attributionWritten = "utm_campaign" in patch || "utm_source" in patch;
        priceGroup = resolvePriceGroup((patch.price_group as string) ?? priceGroup);
      }
    }
  }

  let linkedEvents = 0;
  if (input.sessionId) {
    const { data, error } = await admin
      .from("events")
      .update({ user_id: input.userId })
      .eq("session_id", input.sessionId)
      .is("user_id", null)
      .select("id");
    if (error) console.error("[growth] 방문 기록 소급 연결 실패:", error.message);
    else linkedEvents = data?.length ?? 0;
  }

  const { data: existingSignup } = await admin
    .from("events")
    .select("id")
    .eq("user_id", input.userId)
    .eq("event_name", "signup")
    .limit(1);

  let signupRecorded = false;
  if (!existingSignup || existingSignup.length === 0) {
    signupRecorded = await recordUserEvent("signup", input.userId, {}, input.sessionId);
  }

  return { linkedEvents, priceGroup, utmCampaign, utmContent, signupRecorded, attributionWritten };
}

/** 로그인 사용자의 확정된 가격 실험군. 결제 화면이 보여줄 가격표를 고른다. */
export async function priceGroupForUser(userId: string): Promise<string> {
  try {
    const { data } = await createAdminClient().from("profiles").select("price_group").eq("id", userId).maybeSingle();
    return resolvePriceGroup(data?.price_group as string | null);
  } catch {
    return resolvePriceGroup(null);
  }
}
