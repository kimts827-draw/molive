"use client";

import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import { ensureUserProfile } from "@/lib/auth/profile";
import { safeNextPath } from "@/lib/auth/redirect";
import { readRememberedEmail, updateRememberedEmail } from "@/lib/auth/remembered-email";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";
type OAuthProvider = "google" | "kakao";

export function LoginForm({ enabled, missingEnv }: { enabled: boolean; missingEnv: string[] }) {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState(searchParams.get("message"));

  const next = safeNextPath(searchParams.get("next"));
  const callbackUrl = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  useEffect(() => {
    try {
      const savedEmail = readRememberedEmail(window.localStorage);
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberEmail(true);
      }
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  }, []);

  function disabledMessage() {
    setMessage(`영구 저장 설정이 비활성화돼 있습니다. 필요한 환경변수: ${missingEnv.join(", ")}`);
  }

  async function oauth(provider: OAuthProvider) {
    if (!enabled) { disabledMessage(); return; }
    setBusy(provider); setMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: callbackUrl() } });
      if (error) throw error;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "소셜 로그인을 시작하지 못했습니다.");
      setBusy(null);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!enabled) { disabledMessage(); return; }
    if (password.length < 8) { setMessage("비밀번호는 8자 이상 입력해 주세요."); return; }
    setBusy(mode); setMessage(null);
    try {
      const supabase = createClient();
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.user) throw new Error("로그인 사용자를 확인하지 못했습니다.");
        try { updateRememberedEmail(window.localStorage, email, rememberEmail); } catch { /* Login must not depend on local storage. */ }
        await ensureUserProfile(supabase, data.user);
        window.location.assign(next);
        return;
      }

      const preferences = { displayName, contactEmail: contactEmail || null, marketingEmailsEnabled: marketingOptIn };
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: callbackUrl(),
          data: {
            profile_display_name: displayName.trim(),
            profile_contact_email: contactEmail.trim().toLowerCase(),
            profile_marketing_opt_in: marketingOptIn,
          },
        },
      });
      if (error) throw error;
      if (data.session && data.user) {
        await ensureUserProfile(supabase, data.user, preferences);
        window.location.assign(next);
        return;
      }
      setMessage("가입 확인 이메일을 보냈습니다. 확인 후 원래 작업으로 돌아옵니다. 기존 소셜 계정이라면 해당 방식으로 로그인해 계정 설정에서 비밀번호를 추가해 주세요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "로그인을 완료하지 못했습니다.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="auth-page"><div className="auth-card auth-card-wide"><Brand /><h1>프로젝트에 로그인</h1><p>로그인하면 프로젝트가 자동 저장되고 다른 기기에서도 이어서 편집할 수 있습니다.</p>
      <div className="oauth-buttons">
        <button type="button" className="oauth-button google" disabled={Boolean(busy) || !enabled} onClick={() => void oauth("google")}>{busy === "google" ? "연결 중..." : "Google로 계속하기"}</button>
        <button type="button" className="oauth-button kakao" disabled={Boolean(busy) || !enabled} onClick={() => void oauth("kakao")}>{busy === "kakao" ? "연결 중..." : "Kakao로 계속하기"}</button>
      </div>
      <div className="auth-divider"><span>또는 이메일</span></div>
      <div className="auth-tabs"><button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setMessage(null); }}>로그인</button><button type="button" className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setMessage(null); }}>회원가입</button></div>
      <form onSubmit={(event) => void submit(event)}>
        {mode === "signup" && <label>이름<input type="text" required maxLength={80} disabled={!enabled} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="이름 또는 브랜드 담당자명" /></label>}
        <label>로그인 이메일<input type="email" required disabled={!enabled} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <label>비밀번호<input type="password" required minLength={8} disabled={!enabled} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8자 이상" /></label>
        {mode === "login" && <label className="auth-consent auth-remember"><input type="checkbox" checked={rememberEmail} onChange={(event) => setRememberEmail(event.target.checked)} /><span>이메일 저장</span></label>}
        {mode === "signup" && <><label>연락용 이메일 <span className="optional">선택</span><input type="email" disabled={!enabled} value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="로그인 이메일과 달라도 됩니다" /></label><label className="auth-consent"><input type="checkbox" checked={marketingOptIn} onChange={(event) => setMarketingOptIn(event.target.checked)} /><span>제품 업데이트와 마케팅 이메일 수신에 동의합니다. 선택 사항이며 계정 설정에서 철회할 수 있습니다.</span></label></>}
        <button disabled={Boolean(busy) || !enabled}>{busy === mode ? "처리 중..." : mode === "login" ? "이메일로 로그인" : "이메일로 회원가입"}</button>
      </form>
      <p className="identity-note">동일한 인증 이메일의 Google·Kakao 계정은 Supabase가 하나의 사용자로 자동 연결합니다.</p>
      {!enabled && <div className="auth-message">개발 환경의 영구 저장이 비활성화돼 있습니다.<br />필요한 환경변수: {missingEnv.join(", ")}</div>}{message && <div className="auth-message">{message}</div>}
    </div></main>
  );
}
