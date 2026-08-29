import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CREDIT_COSTS, CREDIT_PLANS, creditPlan } from "../lib/credits/catalog.ts";

const migration = await readFile(new URL("../supabase/migrations/20260826070957_open_beta_credits_orders.sql", import.meta.url), "utf8");
const generationRoute = await readFile(new URL("../app/api/ai/generate/route.ts", import.meta.url), "utf8");
const editorRoute = await readFile(new URL("../app/api/ai/edit/route.ts", import.meta.url), "utf8");
const settleRoute = await readFile(new URL("../app/api/ai/edit/settle/route.ts", import.meta.url), "utf8");
const editorShell = await readFile(new URL("../components/editor/editor-shell.tsx", import.meta.url), "utf8");
const adminAuth = await readFile(new URL("../lib/admin/auth.ts", import.meta.url), "utf8");
const creditService = await readFile(new URL("../lib/credits/service.ts", import.meta.url), "utf8");
const orderRoute = await readFile(new URL("../app/api/orders/route.ts", import.meta.url), "utf8");
const approveRoute = await readFile(new URL("../app/api/admin/orders/[orderId]/approve/route.ts", import.meta.url), "utf8");

test("오픈베타 Credit 플랜과 AI 차감 단가가 고정된다", () => {
  assert.deepEqual(CREDIT_PLANS.map(({ id, price, credits, recommended }) => ({ id, price, credits, recommended })), [
    { id: "starter", price: 14_900, credits: 30, recommended: false },
    { id: "standard", price: 29_900, credits: 80, recommended: true },
    { id: "studio", price: 59_000, credits: 200, recommended: false },
  ]);
  assert.equal(CREDIT_COSTS.designGeneration, 10);
  assert.equal(CREDIT_COSTS.editorAi, 1);
  assert.equal(creditPlan("standard")?.credits, 80);
  assert.equal(creditPlan("unknown"), null);
});

test("신규·기존 회원 signup bonus는 계정당 한 번만 15C 지급된다", () => {
  assert.match(migration, /credit_ledger_signup_bonus_once[\s\S]*on public\.credit_ledger\(user_id\)[\s\S]*type = 'signup_bonus'/);
  assert.match(migration, /new\.id, 15, 'signup_bonus', 'signup_bonus:' \|\| new\.id::text/);
  assert.match(migration, /from auth\.users as users/);
  assert.match(migration, /on_auth_user_credit_created/);
  assert.match(migration, /exception when others then[\s\S]*raise warning 'signup bonus grant failed[\s\S]*return new/);
});

test("balance 음수와 직접 사용자 변경을 막고 자기 데이터 SELECT만 허용한다", () => {
  assert.match(migration, /balance integer not null default 0 check \(balance >= 0\)/);
  assert.match(migration, /reserved integer not null default 0 check \(reserved >= 0 and reserved <= balance\)/);
  assert.match(migration, /revoke all on public\.credit_balances, public\.credit_ledger, public\.orders, public\.credit_reservations from public, anon, authenticated/);
  assert.match(migration, /grant select on public\.credit_balances, public\.credit_ledger, public\.orders to authenticated/);
  for (const table of ["credit_balances", "credit_ledger", "orders"]) {
    assert.match(migration, new RegExp(`${table}_select_own[\\s\\S]*auth\\.uid\\(\\)\\) = user_id`));
  }
});

test("AI는 실행 전 Credit을 예약하고 성공 시만 확정하며 실패 시 해제한다", () => {
  for (const [source, operation] of [[generationRoute, "design_generation"], [editorRoute, "editor_ai"]] as const) {
    assert.match(source, new RegExp(`creditReservation = await reserveAiCredits\\(user\\.id, "${operation}"`));
    assert.match(source, /finally[\s\S]*releaseAiCredits/);
  }
  // 생성은 결과가 곧 저장된 프로젝트라 응답 전에 확정합니다.
  assert.match(generationRoute, /commitAiCredits/);
  assert.match(generationRoute, /"design_generation"/);
  assert.match(editorRoute, /"editor_ai"/);
  assert.match(migration, /raise exception 'INSUFFICIENT_CREDITS'/);
});

test("Editor AI는 문서에 실제로 반영된 뒤에만 Credit을 확정한다", () => {
  // 편집 API는 예약만 남기고 응답합니다. 여기서 확정하면 롤백된 편집의 Credit이 그대로 사라집니다.
  assert.equal(/commitAiCredits/.test(editorRoute), false);
  assert.match(editorRoute, /let creditDeferred = false/);
  assert.match(editorRoute, /creditDeferred = Boolean\(creditReservation\)/);
  assert.match(editorRoute, /credit: creditReservation \? \{ reservationId: creditReservation\.id/);
  assert.match(editorRoute, /if \(creditReservation && !creditDeferred\)/);

  // 정산 경로가 적용/취소를 명시적으로 받아 commit 또는 release로 보냅니다.
  assert.match(settleRoute, /outcome: z\.enum\(\["applied", "discarded"\]\)/);
  assert.match(settleRoute, /settleAiCredits\(\{ reservationId, userId: user\.id, projectId, outcome \}\)/);
  assert.match(settleRoute, /CREDIT_RESERVATION_RELEASED[\s\S]*CREDIT_RESERVATION_NOT_FOUND[\s\S]*settled: "already"/);
  assert.match(creditService, /if \(input\.outcome === "applied"\) return commitAiCredits/);
  assert.match(creditService, /const balance = await releaseAiCredits/);

  // Editor는 실제 반영에 성공했을 때만 applied로 정산하고, 모든 실패 경로는 discarded로 예약을 풉니다.
  assert.match(editorShell, /await settleAiCredit\(reservationId, applied \? "applied" : "discarded"\)/);
  assert.match(editorShell, /"\/api\/ai\/edit\/settle"/);
  assert.match(editorShell, /let applied = false;[\s\S]*applied = true;[\s\S]*\} finally \{/);
});

test("만료된 예약만 원자적으로 회수하고 30분 lease로 새 예약을 만든다", () => {
  assert.match(migration, /expires_at timestamptz not null default \(now\(\) \+ interval '30 minutes'\)/);
  assert.match(migration, /with reclaimed as \([\s\S]*status = 'reserved'[\s\S]*expires_at <= now\(\)[\s\S]*returning amount/);
  assert.match(migration, /set reserved = reserved - reclaimed_amount/);
  assert.match(migration, /now\(\) \+ interval '30 minutes'/);
});

test("주문 승인과 수동 지급은 공통 원장 변경 함수와 멱등키를 사용한다", () => {
  assert.match(orderRoute, /requireApiUser\(request\)/);
  assert.match(creditService, /creditPlan\(planId\)/);
  assert.match(migration, /status text not null default 'pending'/);
  assert.match(approveRoute, /requireAdminApi\(request\)/);
  assert.match(approveRoute, /fulfillCreditOrder\(orderId, admin\.id, "bank_transfer"\)/);
  assert.match(migration, /credit_ledger_order_payment_once/);
  assert.match(migration, /'order:' \|\| target\.id::text/);
  assert.match(migration, /perform private\.apply_credit_change\([\s\S]*select credit_balances\.balance into next_balance/);
  assert.match(migration, /create or replace function public\.fulfill_credit_order/);
  assert.match(migration, /create or replace function public\.manual_grant_credits/);
  assert.match(creditService, /관리자 계좌이체 승인과 향후 Toss 승인 webhook이 함께 호출하는 단일 주문 확정 경로/);
  assert.match(creditService, /type: "manual_grant"|manual_grant_credits/);
});

test("관리자 권한은 user metadata가 아닌 app_metadata role만 사용한다", () => {
  assert.match(adminAuth, /applicationRoleFromAppMetadata/);
  assert.match(adminAuth, /app_metadata/);
  assert.doesNotMatch(adminAuth, /user_metadata/);
  assert.match(adminAuth, /ApiError\(403/);
});
