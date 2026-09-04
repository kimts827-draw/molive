/**
 * 유입 추적 검증용 DB 조회 도구. 실제 Supabase에 들어간 레코드를 그대로 출력한다.
 * 앱 코드를 import하지 않고 supabase-js만 쓰므로 Next 없이 단독 실행된다.
 *
 *   node tests/growth-inspect.mjs events            # 최근 이벤트 30건
 *   node tests/growth-inspect.mjs profile <이메일>  # 그 회원의 유입 정보
 *   node tests/growth-inspect.mjs session <세션id>  # 그 브라우저의 이벤트 전체
 *   node tests/growth-inspect.mjs dashboard         # 대시보드 4개 표 집계
 *   node tests/growth-inspect.mjs admin <이메일>    # 그 계정에 admin 역할 부여
 *   node tests/growth-inspect.mjs cleanup <이메일>  # 검증 계정과 이벤트 삭제
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^"|"$/g, "");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY 가 .env.local에 필요합니다.");
  process.exit(1);
}
const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

const [command, argument] = process.argv.slice(2);

function dump(title, rows) {
  console.log(`\n=== ${title} ===`);
  console.log(rows && rows.length ? JSON.stringify(rows, null, 2) : "(레코드 없음)");
}

async function userByEmail(email) {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return (data?.users ?? []).find((user) => user.email === email) ?? null;
}

if (command === "events") {
  const { data, error } = await admin.from("events")
    .select("id,user_id,session_id,event_name,metadata,created_at")
    .order("created_at", { ascending: false }).limit(Number(argument) || 30);
  if (error) throw error;
  dump(`events 최근 ${data.length}건`, data);
} else if (command === "session") {
  const { data, error } = await admin.from("events")
    .select("id,user_id,session_id,event_name,metadata,created_at")
    .eq("session_id", argument).order("created_at");
  if (error) throw error;
  dump(`session_id = ${argument}`, data);
} else if (command === "profile") {
  const user = await userByEmail(argument);
  if (!user) { console.error(`계정을 찾지 못했습니다: ${argument}`); process.exit(1); }
  const { data: profile } = await admin.from("profiles")
    .select("id,created_at,utm_source,utm_medium,utm_campaign,utm_content,price_group").eq("id", user.id).maybeSingle();
  dump(`profiles (${argument})`, [profile]);
  const { data: events } = await admin.from("events")
    .select("id,event_name,session_id,metadata,created_at").eq("user_id", user.id).order("created_at");
  dump(`events (${argument})`, events);
  const { data: orders } = await admin.from("orders")
    .select("id,plan_id,amount,credits,status,paid_at").eq("user_id", user.id);
  dump(`orders (${argument})`, orders);
  const { data: balance } = await admin.from("credit_balances").select("balance,reserved").eq("user_id", user.id).maybeSingle();
  dump(`credit_balances (${argument})`, [balance]);
} else if (command === "dashboard") {
  const [{ data: events }, { data: profiles }, { data: orders }, { data: users }] = await Promise.all([
    admin.from("events").select("id,user_id,session_id,event_name,metadata,created_at").order("created_at", { ascending: false }).limit(50000),
    admin.from("profiles").select("id,created_at,utm_campaign,utm_content,price_group"),
    admin.from("orders").select("user_id,amount,status,plan_id").eq("status", "paid"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const seoulDay = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const counters = ["visit", "signup", "generate_done", "purchase"].map((name) => {
    const rows = events.filter((row) => row.event_name === name);
    const t = rows.filter((row) => seoulDay(row.created_at) === today).length;
    const y = rows.filter((row) => seoulDay(row.created_at) === yesterday).length;
    return { event: name, 오늘: t, 어제: y, 증감: t - y };
  });
  dump("(1) 오늘의 숫자", counters);

  const subject = (row) => row.event_name === "visit"
    ? row.session_id ?? row.user_id ?? `e${row.id}`
    : row.user_id ?? row.session_id ?? `e${row.id}`;
  const stages = ["visit", "signup", "generate_start", "generate_done", "checkout_view", "purchase"];
  const byCampaign = new Map();
  for (const row of events) {
    if (!stages.includes(row.event_name)) continue;
    const campaign = row.metadata?.utm_campaign ?? "(direct)";
    const entry = byCampaign.get(campaign) ?? Object.fromEntries(stages.map((s) => [s, new Set()]));
    entry[row.event_name].add(subject(row));
    byCampaign.set(campaign, entry);
  }
  dump("(2) utm_campaign별 퍼널", [...byCampaign].map(([campaign, entry]) => ({
    캠페인: campaign, 방문: entry.visit.size, 가입: entry.signup.size,
    생성시작: entry.generate_start.size, 생성완료: entry.generate_done.size,
    결제페이지: entry.checkout_view.size, 결제: entry.purchase.size,
  })));

  const byGroup = new Map();
  for (const row of events) {
    const group = row.metadata?.price_group ?? "default";
    const entry = byGroup.get(group) ?? { 결제페이지도달: new Set(), 결제: 0, 매출합계: 0, 플랜: {} };
    if (row.event_name === "checkout_view") entry.결제페이지도달.add(subject(row));
    if (row.event_name === "purchase") {
      entry.결제 += 1;
      entry.매출합계 += Number(row.metadata?.amount ?? 0);
      const plan = row.metadata?.plan_name ?? row.metadata?.plan_id ?? "?";
      entry.플랜[plan] = (entry.플랜[plan] ?? 0) + 1;
    }
    byGroup.set(group, entry);
  }
  dump("(3) price_group별 결과", [...byGroup].map(([group, entry]) => ({
    그룹: group, 결제페이지도달: entry.결제페이지도달.size, 결제: entry.결제,
    매출합계: entry.매출합계, 플랜별분포: entry.플랜,
  })));

  const emails = new Map((users?.users ?? []).map((user) => [user.id, user.email]));
  const signedUp = new Map((users?.users ?? []).map((user) => [user.id, user.created_at]));
  const paid = new Map();
  for (const order of orders) paid.set(order.user_id, (paid.get(order.user_id) ?? 0) + Number(order.amount));
  const generated = new Map();
  const lastSeen = new Map();
  for (const row of events) {
    if (!row.user_id) continue;
    if (row.event_name === "generate_done") generated.set(row.user_id, (generated.get(row.user_id) ?? 0) + 1);
    if (!lastSeen.has(row.user_id) || row.created_at > lastSeen.get(row.user_id)) lastSeen.set(row.user_id, row.created_at);
  }
  dump("(4) 회원 목록", profiles.map((profile) => ({
    가입일: signedUp.get(profile.id) ?? profile.created_at,
    utm_content: profile.utm_content,
    utm_campaign: profile.utm_campaign,
    이메일: emails.get(profile.id) ?? "",
    price_group: profile.price_group,
    생성횟수: generated.get(profile.id) ?? 0,
    결제여부: (paid.get(profile.id) ?? 0) > 0 ? "결제" : "미결제",
    결제액: paid.get(profile.id) ?? 0,
    마지막활동: lastSeen.get(profile.id) ?? null,
  })).sort((a, b) => String(b.가입일).localeCompare(String(a.가입일))));
} else if (command === "admin") {
  const user = await userByEmail(argument);
  if (!user) { console.error(`계정을 찾지 못했습니다: ${argument}`); process.exit(1); }
  const { error } = await admin.auth.admin.updateUserById(user.id, { app_metadata: { role: "admin" } });
  if (error) throw error;
  console.log(`${argument} 에 admin 역할을 부여했습니다.`);
} else if (command === "cleanup") {
  const user = await userByEmail(argument);
  if (user) {
    await admin.from("events").delete().eq("user_id", user.id);
    await admin.auth.admin.deleteUser(user.id);
    console.log(`삭제: ${argument}`);
  } else {
    console.log(`삭제할 계정 없음: ${argument}`);
  }
} else {
  console.log(readFileSync(new URL(import.meta.url), "utf8").split("*/")[0]);
}
