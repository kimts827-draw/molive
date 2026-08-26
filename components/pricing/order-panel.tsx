"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle } from "lucide-react";
import { CREDIT_PLANS, type CreditPlanId } from "@/lib/credits/catalog";

type BankConfig = { bankName: string; accountNumber: string; accountHolder: string; available: boolean };

export function OrderPanel({ signedIn, bank }: { signedIn: boolean; bank: BankConfig }) {
  const router = useRouter();
  const [selected, setSelected] = useState<CreditPlanId | null>(null);
  const [depositorName, setDepositorName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const plan = CREDIT_PLANS.find((item) => item.id === selected) ?? null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!plan || !depositorName.trim() || busy) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: plan.id, depositorName: depositorName.trim() }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "주문을 신청하지 못했습니다.");
      setMessage("입금 완료 신청을 접수했습니다. 관리자가 확인하면 Credit이 지급됩니다.");
      setDepositorName(""); setSelected(null); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "주문을 신청하지 못했습니다."); }
    finally { setBusy(false); }
  }

  return <>
    <div className="pricing-grid">{CREDIT_PLANS.map((item) => <article className={`pricing-card${item.recommended ? " recommended" : ""}`} key={item.id}>
      {item.recommended ? <span className="pricing-recommend">추천</span> : null}
      <div><span>{item.name}</span><h2>{item.price.toLocaleString("ko-KR")}원</h2><strong>{item.credits}C</strong></div>
      <ul><li><Check size={14} /> AI 디자인 {Math.floor(item.credits / 10)}회 이상</li><li><Check size={14} /> 직접 편집·ZIP·Installer 무료</li></ul>
      {signedIn ? <button type="button" onClick={() => { setSelected(item.id); setMessage(null); }}>이 플랜 구매</button> : <Link href="/login?next=%2Fpricing">로그인 후 구매</Link>}
    </article>)}</div>
    {signedIn && plan ? <form className="bank-order-panel" onSubmit={(event) => void submit(event)}>
      <div><span>BANK TRANSFER</span><h2>{plan.name} · {plan.price.toLocaleString("ko-KR")}원 · {plan.credits}C</h2><p>아래 계좌로 이체한 뒤 실제 입금자명을 입력해 신청해 주세요.</p></div>
      <dl><div><dt>은행</dt><dd>{bank.bankName || "설정 필요"}</dd></div><div><dt>계좌번호</dt><dd>{bank.accountNumber || "설정 필요"}</dd></div><div><dt>예금주</dt><dd>{bank.accountHolder || "설정 필요"}</dd></div></dl>
      <label>입금자명<input required maxLength={80} value={depositorName} onChange={(event) => setDepositorName(event.target.value)} placeholder="실제 입금자명" /></label>
      <div><button type="button" className="bank-cancel" onClick={() => setSelected(null)}>취소</button><button disabled={!bank.available || busy || !depositorName.trim()}>{busy ? <><LoaderCircle className="spin" size={14} /> 신청 중</> : "입금 완료 신청"}</button></div>
    </form> : null}
    {message ? <div className="pricing-message">{message}</div> : null}
  </>;
}
