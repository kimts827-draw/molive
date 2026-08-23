import { errorResponse, requireApiUser } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const admin = createAdminClient();
    const { data, error } = await admin.from("subscriptions").update({ cancel_at_period_end: true, canceled_at: new Date().toISOString() }).eq("user_id", user.id).in("status", ["active", "past_due"]).select("id,status,current_period_end").single();
    if (error || !data) return Response.json({ error: "활성 구독을 찾을 수 없습니다." }, { status: 404 });
    return Response.json({ subscription: data, message: "현재 이용 기간이 끝나면 구독이 해지됩니다." });
  } catch (error) { return errorResponse(error); }
}
