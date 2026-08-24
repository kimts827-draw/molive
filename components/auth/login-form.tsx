"use client";

import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Brand } from "@/components/brand";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ enabled, missingEnv }: { enabled: boolean; missingEnv: string[] }) {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(searchParams.get("message"));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!enabled) { setMessage(`영구 저장 설정이 비활성화돼 있습니다. 필요한 환경변수: ${missingEnv.join(", ")}`); return; }
    setBusy(true); setMessage(null);
    try {
      const requestedNext = searchParams.get("next");
      const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/";
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) throw error;
      setMessage("로그인 링크를 이메일로 보냈습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "로그인 링크를 보내지 못했습니다."); }
    finally { setBusy(false); }
  }

  return <main className="auth-page"><div className="auth-card"><Brand /><h1>프로젝트에 로그인</h1><p>Supabase에 프로젝트와 Cafe24 연결 정보를 안전하게 저장합니다.</p><form onSubmit={(event) => void submit(event)}><label>이메일<input type="email" required disabled={!enabled} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label><button disabled={busy || !enabled}>{busy ? "전송 중" : enabled ? "이메일 로그인 링크 받기" : "저장 설정 필요"}</button></form>{!enabled && <div className="auth-message">개발 환경의 영구 저장이 비활성화돼 있습니다.<br />필요한 환경변수: {missingEnv.join(", ")}</div>}{message && <div className="auth-message">{message}</div>}</div></main>;
}
