"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreditGrantForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState("15");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/admin/credits/grant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, amount: Number(amount), reason }) });
      const payload = await response.json() as { balance?: number; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Credit을 지급하지 못했습니다.");
      setReason(""); setMessage(`지급 완료 · 현재 ${payload.balance}C`); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Credit을 지급하지 못했습니다."); }
    finally { setBusy(false); }
  }
  return <form className="credit-grant-form" onSubmit={(event) => void submit(event)}><label>지급 Credit<input type="number" min="1" max="100000" required value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>지급 사유<input minLength={2} maxLength={300} required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="오픈베타 보상 등" /></label><button disabled={busy}>{busy ? "지급 중" : "수동 Credit 지급"}</button>{message ? <small>{message}</small> : null}</form>;
}
