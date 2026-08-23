import { billingKeyHash } from "@/lib/billing/toss";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const transmissionId = request.headers.get("tosspayments-webhook-transmission-id");
  const payload = await request.json().catch(() => null) as { eventType?: string; billingKey?: string; reason?: string } | null;
  if (!payload || payload.eventType !== "BILLING_DELETED" || !payload.billingKey) return Response.json({ received: true });
  const admin = createAdminClient();
  if (transmissionId) {
    const { error } = await admin.from("webhook_events").insert({ provider: "toss", external_id: transmissionId, event_type: payload.eventType, payload_summary: { reason: payload.reason ?? null } });
    if (error?.code === "23505") return Response.json({ received: true, duplicate: true });
  }
  const hash = billingKeyHash(payload.billingKey);
  const { data: credential } = await admin.schema("private").from("billing_credentials").select("subscription_id").eq("billing_key_hash", hash).single();
  if (credential) {
    await admin.from("subscriptions").update({ status: "canceled", canceled_at: new Date().toISOString(), next_billing_at: null }).eq("id", credential.subscription_id);
    await admin.schema("private").from("billing_credentials").delete().eq("subscription_id", credential.subscription_id);
  }
  return Response.json({ received: true });
}
