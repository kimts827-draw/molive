import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ATTRIBUTION_KEY,
  ensureSessionId,
  parseUtmParams,
  persistFirstTouch,
  readFirstTouch,
  resolveFirstTouch,
} from "../lib/growth/attribution.ts";
import {
  CAMPAIGN_PRICE_GROUPS,
  DEFAULT_PRICE_GROUP,
  planPrice,
  priceGroupForCampaign,
  resolvePriceGroup,
} from "../lib/growth/pricing-config.ts";
import { CREDIT_PLANS, creditPlansFor } from "../lib/credits/catalog.ts";

const migration = await readFile(new URL("../supabase/migrations/20260904090000_growth_attribution_events.sql", import.meta.url), "utf8");
const trackRoute = await readFile(new URL("../app/api/track/route.ts", import.meta.url), "utf8");
const generateRoute = await readFile(new URL("../app/api/ai/generate/route.ts", import.meta.url), "utf8");
const creditService = await readFile(new URL("../lib/credits/service.ts", import.meta.url), "utf8");
const planCards = await readFile(new URL("../components/pricing/plan-cards.tsx", import.meta.url), "utf8");
const orderPanel = await readFile(new URL("../components/pricing/order-panel.tsx", import.meta.url), "utf8");

/** localStorage 대역. 실제 브라우저 저장소와 같은 3개 메서드만 노출한다. */
function memoryStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    map,
  };
}

test("UTM 4개를 읽고, 하나도 없으면 유입 정보 없음으로 구분한다", () => {
  assert.deepEqual(parseUtmParams("?utm_source=outreach&utm_medium=kakao&utm_campaign=g1_premade&utm_content=d047"), {
    utmSource: "outreach",
    utmMedium: "kakao",
    utmCampaign: "g1_premade",
    utmContent: "d047",
  });
  assert.equal(parseUtmParams("?ref=someone"), null);
  assert.equal(parseUtmParams(""), null);
  // 일부만 붙어 있어도 있는 것만 남긴다.
  assert.deepEqual(parseUtmParams("?utm_source=meta"), {
    utmSource: "meta", utmMedium: null, utmCampaign: null, utmContent: null,
  });
});

test("이미 저장된 첫 유입은 새 UTM이 들어와도 덮어쓰지 않는다", () => {
  const stored = JSON.stringify({
    utmSource: "outreach", utmMedium: "kakao", utmCampaign: "g1_premade", utmContent: "d047", landedAt: "2026-09-01T00:00:00.000Z",
  });
  const result = resolveFirstTouch(stored, "?utm_source=meta&utm_campaign=meta_a1&utm_content=zzz", "2026-09-04T00:00:00.000Z");
  assert.equal(result.write, false);
  assert.equal(result.attribution?.utmCampaign, "g1_premade");
  assert.equal(result.attribution?.utmContent, "d047");
});

test("링크로 들어왔다 나갔다 직접 주소로 다시 와도 첫 유입이 남는다", () => {
  const storage = memoryStorage();
  // 1. 아웃리치 링크로 첫 진입
  persistFirstTouch(storage, "?utm_source=outreach&utm_medium=kakao&utm_campaign=g1_premade&utm_content=d047", "2026-09-01T00:00:00.000Z");
  // 2. 나갔다가 UTM 없는 주소로 재진입
  persistFirstTouch(storage, "", "2026-09-02T00:00:00.000Z");
  // 3. 다른 캠페인 링크로 또 진입
  persistFirstTouch(storage, "?utm_campaign=meta_a1&utm_content=999", "2026-09-03T00:00:00.000Z");

  const kept = readFirstTouch(storage);
  assert.equal(kept?.utmCampaign, "g1_premade");
  assert.equal(kept?.utmContent, "d047", "몰 일련번호는 역추적에 쓰이므로 반드시 첫 값이 남아야 한다");
  assert.equal(kept?.landedAt, "2026-09-01T00:00:00.000Z");
});

test("UTM 없이 들어온 방문은 저장하지 않고 에러도 내지 않는다", () => {
  const storage = memoryStorage();
  assert.equal(persistFirstTouch(storage, "?utm_gibberish=1"), null);
  assert.equal(storage.map.has(ATTRIBUTION_KEY), false);
  assert.equal(readFirstTouch(storage), null);
});

test("저장소가 막힌 브라우저에서도 추적이 페이지를 깨뜨리지 않는다", () => {
  const blocked = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  };
  assert.doesNotThrow(() => persistFirstTouch(blocked, "?utm_campaign=g1_premade"));
  assert.doesNotThrow(() => readFirstTouch(blocked));
  assert.equal(typeof ensureSessionId(blocked), "string");
});

test("session_id는 브라우저마다 한 번 만들어지고 그대로 유지된다", () => {
  const storage = memoryStorage();
  const first = ensureSessionId(storage);
  assert.equal(ensureSessionId(storage), first);
  assert.ok(first.length > 0 && first.length <= 100);
});

test("가격은 설정 파일에서만 읽고, 현재는 모두 default 그룹을 본다", () => {
  assert.deepEqual(CAMPAIGN_PRICE_GROUPS, {}, "매핑이 비어 있어야 지금은 전원 동일 가격이다");
  assert.equal(priceGroupForCampaign("g1_premade"), DEFAULT_PRICE_GROUP);
  assert.equal(priceGroupForCampaign(null), DEFAULT_PRICE_GROUP);
  // 설정에서 사라진 그룹이 배정돼 있어도 결제가 멈추지 않는다.
  assert.equal(resolvePriceGroup("groupZ"), DEFAULT_PRICE_GROUP);
  assert.deepEqual(planPrice(DEFAULT_PRICE_GROUP, "standard"), { price: 29_900, credits: 80 });
  assert.deepEqual(creditPlansFor(DEFAULT_PRICE_GROUP), CREDIT_PLANS);
});

test("결제 화면에 하드코딩된 가격이 남아 있지 않다", () => {
  for (const source of [planCards, orderPanel]) {
    assert.doesNotMatch(source, /14[_,]?900|29[_,]?900|59[_,]?000/, "가격 숫자는 pricing-config에만 있어야 한다");
  }
  assert.match(planCards, /plans\.map/);
  assert.match(orderPanel, /plans\.find/);
  // 주문 금액도 사용자가 본 실험군 가격을 따라야 한다.
  assert.match(creditService, /creditPlanFor\(await priceGroupForUser\(userId\), planId\)/);
});

test("추적하는 이벤트는 6개이고 결과 이벤트는 브라우저가 만들 수 없다", async () => {
  const events = await readFile(new URL("../lib/growth/events.ts", import.meta.url), "utf8");
  assert.match(events, /"visit",\s*"signup",\s*"generate_start",\s*"generate_done",\s*"checkout_view",\s*"purchase",/);
  assert.match(events, /CLIENT_REPORTABLE_EVENTS: TrackedEvent\[\] = \["visit", "checkout_view"\]/);
  assert.match(trackRoute, /z\.enum\(CLIENT_REPORTABLE_EVENTS/);
  // 무료·유료 구분과 결제 정보가 metadata에 들어간다.
  assert.match(generateRoute, /recordUserEvent\("generate_start", user\.id, \{ credit_type: creditType/);
  assert.match(generateRoute, /recordUserEvent\("generate_done", user\.id, \{ credit_type: creditType/);
  assert.match(creditService, /recordUserEvent\("purchase"[\s\S]*plan_name[\s\S]*amount: Number\(before\.amount\)/);
});

test("events는 브라우저가 기록만 할 수 있고 읽지 못한다", () => {
  assert.match(migration, /revoke all on table public\.events from public, anon, authenticated/);
  assert.match(migration, /grant insert \(user_id, session_id, event_name, metadata\) on table public\.events to anon, authenticated/);
  assert.match(migration, /grant all on table public\.events to service_role/);
  assert.doesNotMatch(migration, /for select[\s\S]*on public\.events/);
  assert.match(migration, /create policy events_insert_anonymous[\s\S]*with check \(user_id is null\)/);
  assert.match(migration, /events_name_created_at_idx on public\.events\(event_name, created_at desc\)/);
  assert.match(migration, /events_user_id_idx on public\.events\(user_id\)/);
  assert.match(migration, /events_session_id_idx on public\.events\(session_id\)/);
});

test("profiles의 유입 컬럼 5개는 모두 nullable이라 기존 회원이 깨지지 않는다", () => {
  for (const column of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "price_group"]) {
    assert.match(migration, new RegExp(`add column ${column} text`));
    assert.doesNotMatch(migration, new RegExp(`add column ${column} text not null`));
  }
});
