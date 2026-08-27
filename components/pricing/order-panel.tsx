"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { CREDIT_PLANS, type CreditPlanId } from "@/lib/credits/catalog";
import { PlanCards } from "@/components/pricing/plan-cards";

type BankConfig = { bankName: string; accountNumber: string; accountHolder: string; available: boolean };
type PaymentMethod = "bank" | "card";

export function OrderPanel({ signedIn, bank, tossTestClientKey }: { signedIn: boolean; bank: BankConfig; tossTestClientKey: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<CreditPlanId | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank");
  const [depositorName, setDepositorName] = useState("");
  const [busy, setBusy] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);
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

  async function requestTestCardPayment() {
    if (!plan || cardBusy) return;
    if (!tossTestClientKey) {
      setMessage("TossPayments 테스트 클라이언트 키가 설정되지 않았습니다.");
      return;
    }
    setCardBusy(true); setMessage(null);
    try {
      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
      const tossPayments = await loadTossPayments(tossTestClientKey);
      const payment = tossPayments.payment({ customerKey: `molive-test-${crypto.randomUUID()}` });
      const orderId = `MOLIVE_TEST_${plan.id}_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
      const resultPath = `/payments/toss-test`;
      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: plan.price },
        orderId,
        orderName: `MOLIVE ${plan.name} ${plan.credits} Credit 테스트`,
        successUrl: `${window.location.origin}${resultPath}/success?planId=${plan.id}`,
        failUrl: `${window.location.origin}${resultPath}/fail?planId=${plan.id}`,
        card: { flowMode: "DEFAULT", useEscrow: false },
      });
    } catch (error) {
      const paymentError = error as { code?: string; message?: string };
      setMessage(paymentError.code === "USER_CANCEL" || paymentError.code === "PAY_PROCESS_CANCELED"
        ? "카드결제를 취소했습니다."
        : paymentError.message ?? "테스트 결제창을 열지 못했습니다.");
      setCardBusy(false);
    }
  }

  return <>
    <PlanCards action={(item) => signedIn
      ? <button type="button" onClick={() => { setSelected(item.id); setPaymentMethod("bank"); setMessage(null); }}>선택하기 <ArrowRight size={15} /></button>
      : <Link href="/login?next=%2Fpricing">선택하기 <ArrowRight size={15} /></Link>} />
    {signedIn && plan ? <section className="purchase-panel">
      <div className="payment-method-switch" aria-label="결제 방법 선택">
        <button type="button" className={paymentMethod === "bank" ? "active" : ""} aria-pressed={paymentMethod === "bank"} onClick={() => { setPaymentMethod("bank"); setMessage(null); }}>계좌이체</button>
        <button type="button" className={paymentMethod === "card" ? "active" : ""} aria-pressed={paymentMethod === "card"} onClick={() => { setPaymentMethod("card"); setMessage(null); }}>카드결제 <small>테스트</small></button>
      </div>
      {paymentMethod === "bank" ? <form className="bank-order-panel" onSubmit={(event) => void submit(event)}>
        <div><span>BANK TRANSFER</span><h2>{plan.name} · {plan.price.toLocaleString("ko-KR")}원 · {plan.credits}C</h2><p>아래 계좌로 이체한 뒤 실제 입금자명을 입력해 신청해 주세요.</p></div>
        <dl><div><dt>은행</dt><dd>{bank.bankName || "설정 필요"}</dd></div><div><dt>계좌번호</dt><dd>{bank.accountNumber || "설정 필요"}</dd></div><div><dt>예금주</dt><dd>{bank.accountHolder || "설정 필요"}</dd></div></dl>
        <label>입금자명<input required maxLength={80} value={depositorName} onChange={(event) => setDepositorName(event.target.value)} placeholder="실제 입금자명" /></label>
        <div><button type="button" className="bank-cancel" onClick={() => setSelected(null)}>취소</button><button disabled={!bank.available || busy || !depositorName.trim()}>{busy ? <><LoaderCircle className="spin" size={14} /> 신청 중</> : "입금 완료 신청"}</button></div>
      </form> : <div className="toss-test-panel">
        <div><span>TOSS PAYMENTS TEST</span><h2>{plan.name} · {plan.price.toLocaleString("ko-KR")}원 · {plan.credits}C</h2><p>심사용 테스트 카드결제입니다. 결제 인증 후에도 실제 결제 승인과 Credit 지급은 진행되지 않습니다.</p></div>
        <div><button type="button" className="bank-cancel" onClick={() => setSelected(null)}>취소</button><button type="button" disabled={cardBusy || !tossTestClientKey} onClick={() => void requestTestCardPayment()}>{cardBusy ? <><LoaderCircle className="spin" size={14} /> 결제창 여는 중</> : "테스트 카드결제"}</button></div>
      </div>}
    </section> : null}
    {message ? <div className="pricing-message">{message}</div> : null}
  </>;
}
