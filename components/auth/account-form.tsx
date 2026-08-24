"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Provider = "google" | "kakao";

export function AccountForm({
  loginEmail,
  initialDisplayName,
  initialContactEmail,
  initialMarketingEnabled,
  connectedProviders,
}: {
  loginEmail: string;
  initialDisplayName: string;
  initialContactEmail: string;
  initialMarketingEnabled: boolean;
  connectedProviders: string[];
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [contactEmail, setContactEmail] = useState(initialContactEmail);
  const [marketingEnabled, setMarketingEnabled] = useState(initialMarketingEnabled);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault(); setBusy("profile"); setMessage(null);
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName, contactEmail, marketingEmailsEnabled: marketingEnabled }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "프로필을 저장하지 못했습니다.");
      setMessage("프로필을 저장했습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "프로필을 저장하지 못했습니다."); }
    finally { setBusy(null); }
  }

  async function setEmailPassword(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) { setMessage("비밀번호는 8자 이상 입력해 주세요."); return; }
    setBusy("password"); setMessage(null);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      setPassword(""); setMessage("이메일 비밀번호 로그인을 사용할 수 있습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "비밀번호를 설정하지 못했습니다."); }
    finally { setBusy(null); }
  }

  async function link(provider: Provider) {
    setBusy(provider); setMessage(null);
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=%2Faccount`;
      const { error } = await createClient().auth.linkIdentity({ provider, options: { redirectTo } });
      if (error) throw error;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "로그인 방법을 연결하지 못했습니다.");
      setBusy(null);
    }
  }

  return <div className="account-sections">
    <form className="account-section" onSubmit={(event) => void saveProfile(event)}><h2>프로필</h2><label>로그인 이메일<input value={loginEmail} readOnly /></label><label>이름<input required maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><label>연락용 이메일<input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="로그인 이메일과 달라도 됩니다" /></label><label className="auth-consent"><input type="checkbox" checked={marketingEnabled} onChange={(event) => setMarketingEnabled(event.target.checked)} /><span>마케팅 이메일 수신 동의</span></label><button disabled={Boolean(busy)}>{busy === "profile" ? "저장 중..." : "프로필 저장"}</button></form>
    <section className="account-section"><h2>로그인 방법 연결</h2><p>같은 검증 이메일은 자동 연결됩니다. 이메일이 다른 소셜 계정은 아래에서 현재 계정에 직접 연결하세요.</p><div className="identity-buttons"><button type="button" disabled={Boolean(busy) || connectedProviders.includes("google")} onClick={() => void link("google")}>{connectedProviders.includes("google") ? "Google 연결됨" : "Google 연결"}</button><button type="button" disabled={Boolean(busy) || connectedProviders.includes("kakao")} onClick={() => void link("kakao")}>{connectedProviders.includes("kakao") ? "Kakao 연결됨" : "Kakao 연결"}</button></div></section>
    <form className="account-section" onSubmit={(event) => void setEmailPassword(event)}><h2>이메일 비밀번호</h2><p>소셜 로그인으로 가입했어도 현재 계정에 이메일 비밀번호 로그인을 추가할 수 있습니다.</p><label>새 비밀번호<input type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8자 이상" /></label><button disabled={Boolean(busy)}>{busy === "password" ? "설정 중..." : "비밀번호 설정/변경"}</button></form>
    {message && <div className="auth-message">{message}</div>}
  </div>;
}
