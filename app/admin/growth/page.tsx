import { Brand } from "@/components/brand";
import { AdminNav } from "@/components/admin/admin-nav";
import { GrowthMemberTable } from "@/components/admin/growth-member-table";
import styles from "@/components/admin/growth.module.css";
import { requireAdminPage } from "@/lib/admin/auth";
import { loadGrowthDashboard } from "@/lib/growth/dashboard";
import { conversionPercent, type FunnelRow } from "@/lib/growth/dashboard-types";

export const dynamic = "force-dynamic";

function Delta({ value }: { value: number }) {
  const tone = value > 0 ? styles.deltaUp : value < 0 ? styles.deltaDown : styles.deltaFlat;
  const text = value > 0 ? `+${value}` : value < 0 ? String(value) : "±0";
  return <span className={`${styles.delta} ${tone}`}>어제 대비 {text}</span>;
}

/** 전 단계 대비 전환율. 어디서 뚝 끊기는지가 이 표의 목적이다. */
function Stage({ value, previous }: { value: number; previous?: number }) {
  const rate = previous === undefined ? null : conversionPercent(value, previous);
  return <>
    {value}
    {rate === null ? null : <span className={`${styles.rate} ${rate < 20 ? styles.drop : ""}`}>{rate}%</span>}
  </>;
}

function FunnelCells({ row }: { row: FunnelRow }) {
  return <>
    <td>{row.visit}</td>
    <td><Stage value={row.signup} previous={row.visit} /></td>
    <td><Stage value={row.generateStart} previous={row.signup} /></td>
    <td><Stage value={row.generateDone} previous={row.generateStart} /></td>
    <td><Stage value={row.checkoutView} previous={row.generateDone} /></td>
    <td><Stage value={row.purchase} previous={row.checkoutView} /></td>
  </>;
}

export default async function AdminGrowthPage() {
  await requireAdminPage("/admin/growth");
  const { counters, funnel, priceGroups, members, campaigns, eventTotal } = await loadGrowthDashboard();

  return <main className="projects-page">
    <section className="projects-panel admin-usage-panel">
      <header className="projects-header"><Brand /><AdminNav /></header>
      <div className="projects-title"><div><span>ADMIN · ACQUISITION</span><h1>유입·전환</h1><p>어디서 온 사람이 어디까지 갔는지만 봅니다. 기록된 이벤트 {eventTotal.toLocaleString("ko-KR")}건 · 한국 시간 기준.</p></div></div>

      <section className="usage-features">
        <div className="usage-section-title"><div><span>TODAY</span><h2>오늘의 숫자</h2></div></div>
        <div className="usage-cards">{counters.map((counter) => <article key={counter.label}>
          <span>{counter.label}</span>
          <strong>{counter.today}</strong>
          <Delta value={counter.delta} />
        </article>)}</div>
      </section>

      <section className="usage-recent">
        <div className="usage-section-title"><div><span>FUNNEL BY CAMPAIGN</span><h2>utm_campaign별 퍼널</h2></div><small>방문은 브라우저, 이후 단계는 사람 기준</small></div>
        {funnel.length === 0
          ? <div className="projects-empty"><p>아직 기록된 유입이 없습니다.</p></div>
          : <div className="usage-table-wrap"><table>
            <thead><tr><th>캠페인</th><th>방문</th><th>가입</th><th>생성시작</th><th>생성완료</th><th>결제페이지</th><th>결제</th></tr></thead>
            <tbody>{funnel.map((row) => <tr key={row.campaign}><td><b>{row.campaign}</b></td><FunnelCells row={row} /></tr>)}</tbody>
          </table></div>}
      </section>

      <section className="usage-recent">
        <div className="usage-section-title"><div><span>PRICE EXPERIMENT</span><h2>price_group별 결과</h2></div><small>건수만 보면 판단이 뒤집힙니다</small></div>
        <div className="usage-table-wrap"><table>
          <thead><tr><th>그룹</th><th>결제페이지 도달</th><th>결제</th><th>매출합계</th><th>플랜별 분포</th></tr></thead>
          <tbody>{priceGroups.map((row) => <tr key={row.priceGroup}>
            <td><b>{row.priceGroup}</b></td>
            <td>{row.checkoutView}</td>
            <td><Stage value={row.purchase} previous={row.checkoutView} /></td>
            <td><strong>{row.revenue.toLocaleString("ko-KR")}원</strong></td>
            <td className={styles.groupPlans}>{row.planBreakdown.length
              ? row.planBreakdown.map((plan) => `${plan.planName} ${plan.count}`).join(" / ")
              : "—"}</td>
          </tr>)}</tbody>
        </table></div>
      </section>

      <section className="usage-recent">
        <div className="usage-section-title"><div><span>MEMBERS</span><h2>회원 목록</h2></div><small>미결제 필터가 다음 연락 명단입니다</small></div>
        <GrowthMemberTable members={members} campaigns={campaigns} />
      </section>
    </section>
  </main>;
}
