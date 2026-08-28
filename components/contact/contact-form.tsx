"use client";

import { useState } from "react";
import { INQUIRY_CATEGORIES, type InquiryCategory } from "@/lib/inquiries/config";

export function ContactForm({ initialEmail }: { initialEmail: string }) {
  const [category, setCategory] = useState<InquiryCategory>("service");
  const [email, setEmail] = useState(initialEmail);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function submitInquiry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, email, subject, content }),
      });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "문의를 접수하지 못했습니다.");
      setSubject("");
      setContent("");
      setMessage({ kind: "success", text: payload.message ?? "문의가 접수되었습니다." });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "문의를 접수하지 못했습니다." });
    } finally {
      setBusy(false);
    }
  }

  return <form className="contact-form" onSubmit={(event) => void submitInquiry(event)}>
    <label>문의 유형<select value={category} onChange={(event) => setCategory(event.target.value as InquiryCategory)}>{INQUIRY_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <label>이메일<input type="email" required maxLength={320} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <label>제목<input required maxLength={160} value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
    <label>내용<textarea required maxLength={5000} rows={9} value={content} onChange={(event) => setContent(event.target.value)} /></label>
    <button type="submit" disabled={busy}>{busy ? "접수 중..." : "문의하기"}</button>
    {message ? <p className={`contact-message ${message.kind}`} role="status">{message.text}</p> : null}
  </form>;
}
