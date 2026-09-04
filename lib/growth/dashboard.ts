import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_PRICE_GROUP, resolvePriceGroup } from "@/lib/growth/pricing-config";
import {
  DIRECT_BUCKET,
  type FunnelRow,
  type GrowthDashboard,
  type MemberRow,
  type PriceGroupRow,
} from "@/lib/growth/dashboard-types";

export * from "@/lib/growth/dashboard-types";

const EVENT_FETCH_LIMIT = 50_000;

type EventRow = {
  id: number;
  user_id: string | null;
  session_id: string | null;
  event_name: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};



/** 하루 경계는 한국 시간 기준으로 자른다. */
function seoulDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

function metaText(row: EventRow, key: string): string | null {
  const value = row.metadata?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function metaNumber(row: EventRow, key: string): number {
  const value = row.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function campaignOf(row: EventRow) {
  return metaText(row, "utm_campaign") ?? DIRECT_BUCKET;
}

/** 방문은 브라우저 단위, 가입 이후 단계는 사람 단위로 센다. 퍼널이 같은 축에서 읽히도록. */
function subjectOf(row: EventRow) {
  return row.event_name === "visit"
    ? row.session_id ?? row.user_id ?? `event:${row.id}`
    : row.user_id ?? row.session_id ?? `event:${row.id}`;
}

function addTo(map: Map<string, Set<string>>, key: string, subject: string) {
  const bucket = map.get(key) ?? new Set<string>();
  bucket.add(subject);
  map.set(key, bucket);
}


export async function loadGrowthDashboard(): Promise<GrowthDashboard> {
  const admin = createAdminClient();

  const [eventsResult, profilesResult, ordersResult, usersResult] = await Promise.all([
    admin.from("events").select("id,user_id,session_id,event_name,metadata,created_at")
      .order("created_at", { ascending: false }).limit(EVENT_FETCH_LIMIT),
    admin.from("profiles").select("id,created_at,utm_campaign,utm_content,price_group"),
    admin.from("orders").select("user_id,amount,status,plan_id").eq("status", "paid"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  if (eventsResult.error) throw eventsResult.error;
  if (profilesResult.error) throw profilesResult.error;
  if (ordersResult.error) throw ordersResult.error;

  const events = (eventsResult.data ?? []) as EventRow[];
  const profiles = profilesResult.data ?? [];
  const orders = ordersResult.data ?? [];
  const authUsers = usersResult.data?.users ?? [];

  // (1) 오늘의 숫자
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const counterSpec: { key: string; label: string }[] = [
    { key: "visit", label: "방문" },
    { key: "signup", label: "가입" },
    { key: "generate_done", label: "생성 완료" },
    { key: "purchase", label: "결제" },
  ];
  // 방문만 퍼널 표와 같은 브라우저 단위로 센다. 같은 "방문"이 표마다 다른 숫자로 보이면 안 된다.
  // 나머지는 건수 그대로 센다. 한 사람이 오늘 3번 생성했다면 3이 맞는 값이다.
  const countFor = (key: string, day: string) => {
    const rows = events.filter((row) => row.event_name === key && seoulDay(row.created_at) === day);
    return key === "visit" ? new Set(rows.map(subjectOf)).size : rows.length;
  };
  const counters = counterSpec.map(({ key, label }) => {
    const todayCount = countFor(key, today);
    const yesterdayCount = countFor(key, yesterday);
    return { label, today: todayCount, yesterday: yesterdayCount, delta: todayCount - yesterdayCount };
  });

  // (2) utm_campaign별 퍼널
  const stages = ["visit", "signup", "generate_start", "generate_done", "checkout_view", "purchase"] as const;
  const stageMaps = new Map<string, Map<string, Set<string>>>(stages.map((stage) => [stage, new Map()]));
  for (const row of events) {
    const stageMap = stageMaps.get(row.event_name);
    if (!stageMap) continue;
    addTo(stageMap, campaignOf(row), subjectOf(row));
  }
  const campaignKeys = new Set<string>();
  for (const stageMap of stageMaps.values()) for (const key of stageMap.keys()) campaignKeys.add(key);
  const size = (stage: string, campaign: string) => stageMaps.get(stage)?.get(campaign)?.size ?? 0;
  const funnel: FunnelRow[] = [...campaignKeys]
    .map((campaign) => ({
      campaign,
      visit: size("visit", campaign),
      signup: size("signup", campaign),
      generateStart: size("generate_start", campaign),
      generateDone: size("generate_done", campaign),
      checkoutView: size("checkout_view", campaign),
      purchase: size("purchase", campaign),
    }))
    .sort((a, b) => b.visit - a.visit || b.signup - a.signup || a.campaign.localeCompare(b.campaign));

  // (3) price_group별 결과. 건수만 보면 판단이 뒤집히므로 매출 합계를 함께 낸다.
  const groupNames = new Set<string>([DEFAULT_PRICE_GROUP]);
  for (const row of events) groupNames.add(resolvePriceGroup(metaText(row, "price_group")));
  for (const profile of profiles) groupNames.add(resolvePriceGroup(profile.price_group as string | null));
  const priceGroups: PriceGroupRow[] = [...groupNames].sort().map((group) => {
    const reached = new Set<string>();
    let purchase = 0;
    let revenue = 0;
    const plans = new Map<string, number>();
    for (const row of events) {
      if (resolvePriceGroup(metaText(row, "price_group")) !== group) continue;
      if (row.event_name === "checkout_view") reached.add(subjectOf(row));
      if (row.event_name === "purchase") {
        purchase += 1;
        revenue += metaNumber(row, "amount");
        const planName = metaText(row, "plan_name") ?? metaText(row, "plan_id") ?? "알 수 없음";
        plans.set(planName, (plans.get(planName) ?? 0) + 1);
      }
    }
    return {
      priceGroup: group,
      checkoutView: reached.size,
      purchase,
      revenue,
      planBreakdown: [...plans].map(([planName, count]) => ({ planName, count })).sort((a, b) => b.count - a.count),
    };
  });

  // (4) 회원 목록
  const emailById = new Map(authUsers.map((user) => [user.id, user.email ?? ""]));
  const signedUpById = new Map(authUsers.map((user) => [user.id, user.created_at]));
  const generateCounts = new Map<string, number>();
  const lastActive = new Map<string, string>();
  for (const row of events) {
    if (!row.user_id) continue;
    if (row.event_name === "generate_done") generateCounts.set(row.user_id, (generateCounts.get(row.user_id) ?? 0) + 1);
    const seen = lastActive.get(row.user_id);
    if (!seen || row.created_at > seen) lastActive.set(row.user_id, row.created_at);
  }
  const paidTotals = new Map<string, number>();
  for (const order of orders) {
    const userId = String(order.user_id);
    paidTotals.set(userId, (paidTotals.get(userId) ?? 0) + Number(order.amount ?? 0));
  }

  const members: MemberRow[] = profiles.map((profile) => {
    const userId = String(profile.id);
    const paidAmount = paidTotals.get(userId) ?? 0;
    return {
      userId,
      email: emailById.get(userId) ?? "",
      signedUpAt: signedUpById.get(userId) ?? String(profile.created_at),
      utmCampaign: (profile.utm_campaign as string | null) ?? null,
      utmContent: (profile.utm_content as string | null) ?? null,
      priceGroup: resolvePriceGroup(profile.price_group as string | null),
      generateCount: generateCounts.get(userId) ?? 0,
      paid: paidAmount > 0,
      paidAmount,
      lastActiveAt: lastActive.get(userId) ?? null,
    };
  }).sort((a, b) => b.signedUpAt.localeCompare(a.signedUpAt));

  const campaigns = [...new Set(members.map((member) => member.utmCampaign ?? DIRECT_BUCKET))].sort();

  return {
    counters,
    funnel,
    priceGroups,
    members,
    campaigns,
    eventTotal: events.length,
    generatedAt: new Date().toISOString(),
  };
}
