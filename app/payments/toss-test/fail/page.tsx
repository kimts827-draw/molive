import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";

export const metadata: Metadata = { title: "테스트 결제 실패 — MOLIVE" };

function value(input: string | string[] | undefined) {
  return Array.isArray(input) ? input[0] : input;
}

type TossTestResultProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function TossTestFailPage({ searchParams }: TossTestResultProps) {
  const params = await searchParams;
  const code = value(params.code);
  const message = value(params.message);

  return <main className="toss-result-page">
    <nav className="guide-nav"><Brand /><div><Link href="/">홈</Link><Link href="/pricing">가격</Link></div></nav>
    <section className="toss-result-card">
      <span>TOSS PAYMENTS TEST</span>
      <h1>테스트 결제가 완료되지 않았습니다.</h1>
      <p>결제창을 닫았거나 테스트 인증 과정에서 문제가 발생했습니다.</p>
      <div className="toss-result-notice">실제 결제와 Credit 지급은 진행되지 않았습니다.</div>
      {code || message ? <div className="toss-result-detail">{code ? <span>오류 코드: {code}</span> : null}{message ? <span>{message}</span> : null}</div> : null}
      <Link href="/pricing">다시 시도하기</Link>
    </section>
  </main>;
}
