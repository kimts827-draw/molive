import "server-only";
import { createHash } from "node:crypto";

const TOSS_API = "https://api.tosspayments.com/v1";

function authorization() {
  const secret = process.env.TOSS_SECRET_KEY;
  if (!secret) throw new Error("TOSS_SECRET_KEY가 설정되지 않았습니다.");
  return `Basic ${Buffer.from(`${secret}:`).toString("base64")}`;
}

async function tossRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${TOSS_API}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: authorization(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { code?: string; message?: string };
    throw new TossBillingError(response.status, payload.code ?? "TOSS_ERROR", payload.message ?? "토스페이먼츠 요청에 실패했습니다.");
  }
  return response.json() as Promise<T>;
}

export class TossBillingError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export type BillingIssue = { mId: string; customerKey: string; billingKey: string; card?: { issuerCode?: string; number?: string; cardType?: string } };
export type BillingPayment = { paymentKey: string; orderId: string; orderName: string; status: string; totalAmount: number; approvedAt?: string; method?: string; card?: { issuerCode?: string; number?: string } };

export function issueBillingKey(authKey: string, customerKey: string) {
  return tossRequest<BillingIssue>("/billing/authorizations/issue", { authKey, customerKey });
}

export function chargeBillingKey(billingKey: string, input: { customerKey: string; amount: number; orderId: string; orderName: string; customerEmail?: string }) {
  return tossRequest<BillingPayment>(`/billing/${encodeURIComponent(billingKey)}`, input);
}

export function billingKeyHash(billingKey: string) { return createHash("sha256").update(billingKey).digest("hex"); }

export function customerKeyForUser(userId: string) {
  const secret = process.env.TOSS_CUSTOMER_KEY_SECRET || process.env.CAFE24_OAUTH_STATE_SECRET;
  if (!secret) throw new Error("TOSS_CUSTOMER_KEY_SECRET가 설정되지 않았습니다.");
  return `moire_${createHash("sha256").update(`${secret}:${userId}`).digest("base64url").slice(0, 40)}`;
}

export const plans = {
  starter: { id: "starter", name: "Moiré Starter", amount: 29000, intervalDays: 30 },
  pro: { id: "pro", name: "Moiré Pro", amount: 79000, intervalDays: 30 },
} as const;

export type PlanId = keyof typeof plans;
