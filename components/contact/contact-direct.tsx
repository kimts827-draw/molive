"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

export const DIRECT_CONTACT_EMAIL = "kimts827@gmail.com";

export function ContactDirect() {
  const [message, setMessage] = useState<string | null>(null);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(DIRECT_CONTACT_EMAIL);
      setMessage("이메일 주소가 복사되었습니다.");
    } catch {
      setMessage("복사하지 못했습니다. 표시된 이메일 주소를 직접 복사해 주세요.");
    }
  }

  return <aside className="contact-direct">
    <Mail size={19} />
    <div className="contact-direct-email"><span>고객문의 이메일</span><a href={`mailto:${DIRECT_CONTACT_EMAIL}`}>{DIRECT_CONTACT_EMAIL}</a></div>
    <div className="contact-direct-actions">
      <a className="contact-mailto" href={`mailto:${DIRECT_CONTACT_EMAIL}`}>이메일로 직접 문의하기</a>
      <button type="button" onClick={() => void copyEmail()}>이메일 주소 복사</button>
    </div>
    {message ? <p className="contact-copy-message" role="status" aria-live="polite">{message}</p> : null}
  </aside>;
}
