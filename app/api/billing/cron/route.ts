import { chargeBillingKey, plans, TossBillingError, type PlanId } from "@/lib/billing/toss";
import { decryptSecret } from "@/lib/security/encryption";
import { createAdminClient } from "@/lib/supabase/admin";

async function handleBillingCron(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: due, error } = await admin.from("subscriptions").select("id,user_id,plan_id,status,next_billing_at,cancel_at_period_end,payment_failure_count").lte("next_billing_at", new Date().toISOString()).in("status", ["active", "past_due"]).limit(100);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const results: Array<{ id: string; status: string }> = [];
  for (const subscription of due ?? []) {
    if (subscription.cancel_at_period_end) {
      await admin.from("subscriptions").update({ status: "canceled", next_billing_at: null }).eq("id", subscription.id);
      results.push({ id: subscription.id, status: "canceled" });
      continue;
    }
    const plan = plans[subscription.plan_id as PlanId];
    if (!plan) { results.push({ id: subscription.id, status: "invalid_plan" }); continue; }
    const { data: credential } = await admin.schema("private").from("billing_credentials").select("customer_key,billing_key_encrypted").eq("subscription_id", subscription.id).single();
    if (!credential) { results.push({ id: subscription.id, status: "missing_billing_key" }); continue; }
    const orderId = `sub_${subscription.id.replaceAll("-", "").slice(0, 18)}_${Date.now()}`;
    try {
      const payment = await chargeBillingKey(decryptSecret(credential.billing_key_encrypted), { customerKey: credential.customer_key, amount: plan.amount, orderId, orderName: `${plan.name} 30일 구독` });
      const nextDate = new Date(Date.now() + plan.intervalDays * 86400_000);
      await admin.from("billing_payments").insert({ subscription_id: subscription.id, user_id: subscription.user_id, order_id: orderId, payment_key: payment.paymentKey, amount: payment.totalAmount, status: payment.status, approved_at: payment.approvedAt ?? new Date().toISOString(), raw_summary: { method: payment.method, card: payment.card } });
      await admin.from("subscriptions").update({ status: "active", current_period_start: new Date().toISOString(), current_period_end: nextDate.toISOString(), next_billing_at: nextDate.toISOString(), payment_failure_count: 0 }).eq("id", subscription.id);
      results.push({ id: subscription.id, status: "paid" });
    } catch (error) {
      const code = error instanceof TossBillingError ? error.code : "INTERNAL_ERROR";
      await admin.from("billing_payments").insert({ subscription_id: subscription.id, user_id: subscription.user_id, order_id: orderId, amount: plan.amount, status: "FAILED", failure_code: code, failure_message: error instanceof Error ? error.message.slice(0, 300) : "결제 실패" });
      await admin.from("subscriptions").update({ status: "past_due", payment_failure_count: (subscription.payment_failure_count ?? 0) + 1, next_billing_at: new Date(Date.now() + 3 * 86400_000).toISOString() }).eq("id", subscription.id);
      results.push({ id: subscription.id, status: `failed:${code}` });
    }
  }
  return Response.json({ processed: results.length, results });
}

export const GET = handleBillingCron;
export const POST = handleBillingCron;
