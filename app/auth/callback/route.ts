import { createClient } from "@/lib/supabase/server";
import { ensureUserProfile } from "@/lib/auth/profile";
import { safeNextPath } from "@/lib/auth/redirect";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await ensureUserProfile(supabase, user);
      return Response.redirect(new URL(next, url.origin));
    }
  }
  const login = new URL("/login", url.origin);
  login.searchParams.set("message", "로그인을 완료하지 못했습니다. 다시 시도해 주세요.");
  login.searchParams.set("next", next);
  return Response.redirect(login);
}
