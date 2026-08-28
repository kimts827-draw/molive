import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { getAdminOpenAIUsage } from "@/lib/admin/openai-usage";
import { applicationRoleFromAppMetadata } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/admin-nav";

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(value);
}

function count(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

const featureLabels = { design_generation: "디자인 생성", editor_ai: "Editor AI", preview_image: "Preview 이미지" } as const;

export default async function AdminUsagePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fadmin%2Fusage");
  if (applicationRoleFromAppMetadata(user.app_metadata as Record<string, unknown>) !== "admin") notFound();

  const { summary, byFeature, recent } = await getAdminOpenAIUsage();
  const cards = [
    ["전체 비용", money(summary.totalCostUsd)],
    ["일반 사용자 비용", money(summary.customerCostUsd)],
    ["관리자/테스트 비용", money(summary.adminCostUsd)],
    ["오늘 비용", money(summary.todayCostUsd)],
    ["이번 달 비용", money(summary.monthCostUsd)],
    ["총 생성 횟수", `${count(summary.totalGenerations)}회`],
    ["생성 1회 평균", money(summary.averageCostUsd)],
    ["최고 비용", money(summary.highestCostUsd)],
  ];

  return (
    <main className="projects-page admin-usage-page">
      <section className="projects-panel admin-usage-panel">
        <header className="projects-header"><Brand /><div><AdminNav /><Link href="/projects">내 디자인</Link><Link href="/account">계정</Link><form action="/auth/signout" method="post"><button type="submit">로그아웃</button></form></div></header>
        <div className="projects-title"><div><span>ADMIN · OPENAI</span><h1>사용량</h1><p>모든 금액은 OpenAI 응답 usage와 저장된 단가표로 계산한 예상 USD 비용입니다.</p></div></div>
        <div className="usage-cards">{cards.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
        <section className="usage-features">
          <div className="usage-section-title"><div><span>BY FEATURE</span><h2>기능별 비용</h2></div></div>
          <div className="usage-feature-cards">{byFeature.map((item) => <article key={item.usageType}><span>{featureLabels[item.usageType]}</span><strong>{money(item.totalCostUsd)}</strong><small>{count(item.totalOperations)}회 · 1회 평균 {money(item.averageCostUsd)}</small></article>)}</div>
        </section>
        <section className="usage-recent">
          <div className="usage-section-title"><div><span>RECENT OPERATIONS</span><h2>최근 작업별 비용</h2></div><small>한국 시간 기준</small></div>
          {recent.length === 0 ? <div className="projects-empty"><p>아직 기록된 OpenAI 사용량이 없습니다.</p></div> : <div className="usage-table-wrap"><table><thead><tr><th>작업 시각</th><th>구분</th><th>기능</th><th>모델</th><th>요청</th><th>토큰</th><th>프로젝트</th><th>예상 비용</th></tr></thead><tbody>{recent.map((item) => <tr key={`${item.generationId}:${item.usageType}:${item.actorType}`}><td>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(item.createdAt))}</td><td>{item.actorType === "admin" ? "관리자/테스트" : "일반 사용자"}</td><td>{featureLabels[item.usageType]}</td><td>{item.model}</td><td>{count(item.requestCount)}회</td><td><span className="usage-token-detail">입력 {count(item.inputTokens)} · 캐시 {count(item.cachedInputTokens)} · 출력 {count(item.outputTokens)}{item.imageCount ? ` · 이미지 ${count(item.imageCount)}` : ""}</span></td><td>{item.projectId ? item.projectId.slice(0, 8) : "연결 전"}</td><td><strong>{money(item.estimatedCostUsd)}</strong></td></tr>)}</tbody></table></div>}
        </section>
      </section>
    </main>
  );
}
