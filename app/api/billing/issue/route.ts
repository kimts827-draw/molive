import { z } from "zod";
import { errorResponse, requireApiUser } from "@/lib/api/auth";
import { billingKeyHash, customerKeyForUser, issueBillingKey, plans, type PlanId } from "@/lib/billing/toss";
import { encryptSecret } from "@/lib/security/encryption";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ authKey: z.string().min(10).max(500), customerKey: z.string().min(5).max(300), planId: z.enum(["starter", "pro"]) });

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const input = schema.parse(await request.json());
    if (input.customerKey !== customerKeyForUser(user.id)) return Response.json({ error: "customerKey가 현재 사용자와 일치하지 않습니다." }, { status: 403 });
    const issued = await issueBillingKey(input.authKey, input.customerKey);
    const plan = plans[input.planId as PlanId];
    const admin = createAdminClient();
    const { data: subscription, error } = await admin.from("subscriptions").upsert({ user_id: user.id, plan_id: plan.id, status: "active", current_period_start: new Date().toISOString(), current_period_end: new Date(Date.now() + plan.intervalDays * 86400_000).toISOString(), next_billing_at: new Date(Date.now() + plan.intervalDays * 86400_000).toISOString(), cancel_at_period_end: false }, { onConflict: "user_id" }).select("id").single();
    if (error || !subscription) throw error ?? new Error("구독을 저장하지 못했습니다.");
    const { error: credentialError } = await admin.schema("private").from("billing_credentials").upsert({ subscription_id: subscription.id, customer_key: input.customerKey, billing_key_encrypted: encryptSecret(issued.billingKey), billing_key_hash: billingKeyHash(issued.billingKey), card_summary: issued.card ?? null }, { onConflict: "subscription_id" });
    if (credentialError) throw credentialError;
    return Response.json({ subscriptionId: subscription.id, status: "active", card: issued.card ?? null });
  } catch (error) { return errorResponse(error); }
}
