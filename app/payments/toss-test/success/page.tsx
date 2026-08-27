import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { creditPlan } from "@/lib/credits/catalog";

export const metadata: Metadata = { title: "테스트 결제 완료 — MOLIVE" };

function value(input: string | string[] | undefined) {
  return Array.isArray(input) ? input[0] : input;
}

type TossTestResultProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function TossTestSuccessPage({ searchParams }: TossTestResultProps) {
  const params = await searchParams;
  const plan = creditPlan(value(params.planId) ?? "");
  const amount = Number(value(params.amount));
  const orderId = value(params.orderId) ?? "";
  const paymentKey = value(params.paymentKey) ?? "";
  const verifiedRequest = Boolean(plan && amount === plan.price && orderId.startsWith(`MOLIVE_TEST_${plan.id}_`) && paymentKey);

  return <main className="toss-result-page">
    <nav className="guide-nav"><Brand /><div><Link href="/">홈</Link><Link href="/pricing">가격</Link></div></nav>
    <section className="toss-result-card">
      <span>TOSS PAYMENTS TEST</span>
      <h1>{verifiedRequest ? "테스트 결제 인증 완료" : "테스트 결제 결과 확인"}</h1>
      <p>카드 결제창의 테스트 인증 결과가 MOLIVE로 돌아왔습니다.</p>
      <div className="toss-result-notice">테스트 결제입니다. 실제 Credit은 지급되지 않습니다.</div>
      <div className="toss-result-detail">
        {plan ? <span>{plan.name} · {plan.price.toLocaleString("ko-KR")}원 · {plan.credits}C</span> : null}
        <span>결제 승인 API와 Credit 지급 로직은 호출하지 않았습니다.</span>
      </div>
      <Link href="/pricing">가격 페이지로 돌아가기</Link>
    </section>
  </main>;
}
