import { ensureUserProfile, marketingConsentValues, parseProfileUpdate } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const input = parseProfileUpdate(await request.json().catch(() => null));
  if (!input) return Response.json({ error: "프로필 입력값을 확인해 주세요." }, { status: 400 });

  await ensureUserProfile(supabase, user);
  const { data: current, error: readError } = await supabase
    .from("profiles")
    .select("marketing_emails_enabled, marketing_consented_at, marketing_withdrawn_at")
    .eq("id", user.id)
    .maybeSingle();
  if (readError) return Response.json({ error: readError.message }, { status: 500 });
  if (!current) return Response.json({ error: "프로필을 찾을 수 없습니다." }, { status: 404 });

  const now = new Date().toISOString();
  const consent = marketingConsentValues(current.marketing_emails_enabled === true, input.marketingEmailsEnabled, now);
  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: input.displayName,
      contact_email: input.contactEmail,
      marketing_emails_enabled: input.marketingEmailsEnabled,
      updated_at: now,
      ...consent,
    })
    .eq("id", user.id)
    .select("display_name, contact_email, marketing_emails_enabled, marketing_consented_at, marketing_withdrawn_at")
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "프로필을 수정할 권한이 없습니다." }, { status: 403 });
  return Response.json({ profile: data });
}
