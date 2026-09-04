import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUserProfile } from "@/lib/auth/profile";
import { safeNextPath } from "@/lib/auth/redirect";
import { NEW_USER_COOKIE } from "@/lib/growth/new-user-cookie";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      const created = user ? await ensureUserProfile(supabase, user) : false;
      const response = NextResponse.redirect(new URL(next, url.origin));
      // 신규 가입일 때만 표시를 남긴다. 브라우저의 first-touch UTM을 계정에 붙이는 신호다.
      if (created) response.cookies.set(NEW_USER_COOKIE, "1", { path: "/", maxAge: 600, sameSite: "lax" });
      return response;
    }
  }
  const login = new URL("/login", url.origin);
  login.searchParams.set("message", "로그인을 완료하지 못했습니다. 다시 시도해 주세요.");
  login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}
