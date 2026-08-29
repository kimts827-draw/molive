import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { creditCost, creditPlan, type CreditOperation, type CreditPlanId } from "@/lib/credits/catalog";

export class InsufficientCreditsError extends Error {
  constructor(public readonly required: number) {
    super(`Credit이 부족합니다. ${required}C가 필요합니다.`);
  }
}

export type AdminCreditOrder = {
  id: string; userId: string; userEmail: string; planId: string; amount: number; credits: number;
  depositorName: string; status: string; paymentProvider: string; createdAt: string; paidAt: string | null;
};

export type CreditUser = { userId: string; email: string; balance: number };

function firstRow(data: unknown) {
  return Array.isArray(data) ? data[0] as Record<string, unknown> | undefined : data as Record<string, unknown> | null;
}

function rpcError(error: { message?: string } | null, fallback: string) {
  if (error?.message?.includes("INSUFFICIENT_CREDITS")) return new InsufficientCreditsError(0);
  return error ?? new Error(fallback);
}

export async function getCreditBalance(userId: string) {
  const { data, error } = await createAdminClient().from("credit_balances").select("balance,reserved").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  const balance = Number(data?.balance ?? 0);
  const reserved = Number(data?.reserved ?? 0);
  return { balance, reserved, available: Math.max(0, balance - reserved) };
}

export async function reserveAiCredits(userId: string, operation: CreditOperation, projectId?: string | null) {
  const amount = creditCost(operation);
  const { data, error } = await createAdminClient().rpc("reserve_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_type: operation,
    p_idempotency_key: `${operation}:${crypto.randomUUID()}`,
    p_project_id: projectId ?? null,
  });
  if (error) {
    if (error.message.includes("INSUFFICIENT_CREDITS")) throw new InsufficientCreditsError(amount);
    throw rpcError(error, "Credit을 확인하지 못했습니다.");
  }
  const row = firstRow(data);
  if (!row?.reservation_id) throw new Error("Credit 예약을 만들지 못했습니다.");
  return { id: String(row.reservation_id), amount, available: Number(row.available ?? 0) };
}

export async function commitAiCredits(reservationId: string, userId: string, projectId?: string | null) {
  const { data, error } = await createAdminClient().rpc("commit_credit_reservation", {
    p_reservation_id: reservationId,
    p_user_id: userId,
    p_project_id: projectId ?? null,
  });
  if (error) throw error;
  return Number(data);
}

export async function releaseAiCredits(reservationId: string, userId: string) {
  const { data, error } = await createAdminClient().rpc("release_credit_reservation", { p_reservation_id: reservationId, p_user_id: userId });
  if (error && !error.message.includes("CREDIT_RESERVATION_RELEASED")) throw error;
  return error ? null : Number(data);
}

/**
 * 실행은 성공했지만 실제 적용 여부가 클라이언트에서 갈리는 AI 편집의 정산 경로입니다.
 *
 * 편집 API는 예약만 남기고 응답하며, Editor가 문서에 실제로 반영한 뒤에만 applied로 확정합니다.
 * 렌더 검증 실패처럼 변경이 롤백되면 discarded로 예약을 풀어 사용자 Credit이 소모되지 않습니다.
 * 클라이언트가 아무것도 부르지 못한 채 사라져도 예약은 30분 lease 만료로 회수되므로,
 * 어떤 경로로도 "적용되지 않은 편집에 Credit이 차감된 상태"가 남지 않습니다.
 */
export async function settleAiCredits(input: { reservationId: string; userId: string; projectId?: string | null; outcome: "applied" | "discarded" }) {
  if (input.outcome === "applied") return commitAiCredits(input.reservationId, input.userId, input.projectId ?? null);
  const balance = await releaseAiCredits(input.reservationId, input.userId);
  return balance ?? (await getCreditBalance(input.userId)).balance;
}

export async function createBankTransferOrder(userId: string, planId: CreditPlanId, depositorName: string) {
  const plan = creditPlan(planId);
  if (!plan) throw new Error("구매 플랜을 확인해 주세요.");
  const { data, error } = await createAdminClient().from("orders").insert({
    user_id: userId,
    plan_id: plan.id,
    amount: plan.price,
    credits: plan.credits,
    depositor_name: depositorName,
    payment_provider: "bank_transfer",
  }).select("id,status,created_at").single();
  if (error || !data) throw error ?? new Error("주문을 만들지 못했습니다.");
  return { id: String(data.id), status: String(data.status), createdAt: String(data.created_at) };
}

export async function listUserOrders(userId: string) {
  const { data, error } = await createAdminClient().from("orders")
    .select("id,plan_id,amount,credits,depositor_name,status,payment_provider,created_at,paid_at")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(30);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id), planId: String(row.plan_id), amount: Number(row.amount), credits: Number(row.credits),
    depositorName: String(row.depositor_name), status: String(row.status), paymentProvider: String(row.payment_provider),
    createdAt: String(row.created_at), paidAt: row.paid_at ? String(row.paid_at) : null,
  }));
}

export async function listAdminOrders(status: "pending" | "paid" | "cancelled" | null = "pending"): Promise<AdminCreditOrder[]> {
  const { data, error } = await createAdminClient().rpc("admin_list_credit_orders", { p_status: status, p_limit: 200 });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id), userId: String(row.user_id), userEmail: String(row.user_email ?? ""), planId: String(row.plan_id),
    amount: Number(row.amount), credits: Number(row.credits), depositorName: String(row.depositor_name), status: String(row.status),
    paymentProvider: String(row.payment_provider), createdAt: String(row.created_at), paidAt: row.paid_at ? String(row.paid_at) : null,
  }));
}

/** 관리자 계좌이체 승인과 향후 Toss 승인 webhook이 함께 호출하는 단일 주문 확정 경로입니다. */
export async function fulfillCreditOrder(orderId: string, approvedBy: string | null, provider: "bank_transfer" | "toss", providerPaymentKey?: string | null) {
  const { data, error } = await createAdminClient().rpc("fulfill_credit_order", {
    p_order_id: orderId,
    p_approved_by: approvedBy,
    p_payment_provider: provider,
    p_provider_payment_key: providerPaymentKey ?? null,
  });
  if (error) throw error;
  const row = firstRow(data);
  if (!row?.order_id) throw new Error("주문 Credit 지급 결과를 확인하지 못했습니다.");
  return { orderId: String(row.order_id), userId: String(row.user_id), credited: Number(row.credited), balance: Number(row.balance) };
}

export async function searchCreditUsers(query: string): Promise<CreditUser[]> {
  if (!query.trim()) return [];
  const { data, error } = await createAdminClient().rpc("admin_search_credit_users", { p_query: query.trim(), p_limit: 30 });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({ userId: String(row.user_id), email: String(row.email ?? ""), balance: Number(row.balance ?? 0) }));
}

export async function getRecentCreditLedger(userId: string, limit = 30) {
  const { data, error } = await createAdminClient().from("credit_ledger")
    .select("id,type,amount,balance_after,reason,granted_by,created_at,order_id,project_id")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function manualGrantCredits(input: { userId: string; amount: number; grantedBy: string; reason: string }) {
  const { data, error } = await createAdminClient().rpc("manual_grant_credits", {
    p_user_id: input.userId,
    p_amount: input.amount,
    p_granted_by: input.grantedBy,
    p_reason: input.reason,
    p_idempotency_key: `manual_grant:${crypto.randomUUID()}`,
  });
  if (error) throw error;
  return Number(data);
}
