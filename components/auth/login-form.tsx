"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Brand } from "@/components/brand";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(searchParams.get("message"));

  async function submit(event: FormEvent) {
    event.preventDefault();
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

  return <main className="auth-page"><div className="auth-card"><Link href="/"><Brand /></Link><h1>프로젝트에 로그인</h1><p>Supabase에 프로젝트와 Cafe24 연결 정보를 안전하게 저장합니다.</p><form onSubmit={(event) => void submit(event)}><label>이메일<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label><button disabled={busy}>{busy ? "전송 중" : "이메일 로그인 링크 받기"}</button></form>{message && <div className="auth-message">{message}</div>}</div></main>;
}
