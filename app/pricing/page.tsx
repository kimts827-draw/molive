import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { OrderPanel } from "@/components/pricing/order-panel";
import { bankTransferConfig } from "@/lib/credits/bank";
import { getCreditBalance, listUserOrders } from "@/lib/credits/service";
import { getCurrentUser } from "@/lib/supabase/server";
import { GrowthTracker } from "@/components/growth/growth-tracker";
import { creditPlansFor } from "@/lib/credits/catalog";
import { priceGroupForUser } from "@/lib/growth/identify";
import { DEFAULT_PRICE_GROUP } from "@/lib/growth/pricing-config";

export const metadata: Metadata = { title: "가격 및 Credit — MOLIVE", description: "MOLIVE 오픈베타 Credit 플랜" };

const statusLabel: Record<string, string> = { pending: "입금 확인 중", paid: "지급 완료", cancelled: "취소" };

export default async function PricingPage() {
  const user = await getCurrentUser();
  const [credit, orders] = user ? await Promise.all([getCreditBalance(user.id), listUserOrders(user.id)]) : [null, []];
  // 결제 화면의 가격은 언제나 배정된 실험군 설정에서 읽는다.
  const priceGroup = user ? await priceGroupForUser(user.id) : DEFAULT_PRICE_GROUP;
  return <main className="pricing-page">
    <GrowthTracker event="checkout_view" />
    <nav className="guide-nav"><Brand /><div><Link href="/">홈</Link>{user ? <><Link href="/projects">내 디자인</Link><Link href="/account">계정</Link></> : <Link href="/login?next=%2Fpricing">로그인</Link>}</div></nav>
    <section className="pricing-hero"><span>OPEN BETA CREDIT</span><h1>필요할 때 충전하고,<br /><em>AI를 사용한 만큼만.</em></h1><p>신규 회원에게 15C를 한 번 지급합니다. 직접 편집과 배포 도구는 무료입니다.</p>{credit ? <div className="credit-balance-card"><span>사용 가능 Credit</span><strong>{credit.available}C</strong>{credit.reserved ? <small>처리 중 {credit.reserved}C</small> : null}</div> : null}</section>
    <section className="pricing-content"><OrderPanel signedIn={Boolean(user)} plans={creditPlansFor(priceGroup)} bank={bankTransferConfig()} tossTestClientKey={process.env.NEXT_PUBLIC_TOSS_TEST_CLIENT_KEY?.trim() ?? ""} />
      <div className="credit-rules"><div><b>10C</b><span>전체 AI 디자인 생성 성공</span></div><div><b>1C</b><span>Editor AI 수정 성공</span></div><div><b>무료</b><span>직접 편집 · ZIP · Installer · Cafe24 적용</span></div></div>
      {user ? <section className="order-history"><div><span>MY ORDERS</span><h2>주문 내역</h2></div>{orders.length ? <div className="usage-table-wrap"><table><thead><tr><th>신청일</th><th>플랜</th><th>입금자명</th><th>금액 / Credit</th><th>상태</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt))}</td><td>{order.planId}</td><td>{order.depositorName}</td><td>{order.amount.toLocaleString("ko-KR")}원 / {order.credits}C</td><td><b>{statusLabel[order.status] ?? order.status}</b></td></tr>)}</tbody></table></div> : <p>아직 주문이 없습니다.</p>}</section> : null}
    </section>
  </main>;
}
