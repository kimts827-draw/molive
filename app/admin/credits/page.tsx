import Link from "next/link";
import { Brand } from "@/components/brand";
import { AdminNav } from "@/components/admin/admin-nav";
import { CreditGrantForm } from "@/components/admin/credit-grant-form";
import { requireAdminPage } from "@/lib/admin/auth";
import { getRecentCreditLedger, searchCreditUsers } from "@/lib/credits/service";

export default async function AdminCreditsPage({ searchParams }: PageProps<"/admin/credits">) {
  await requireAdminPage("/admin/credits");
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q : "";
  const selectedId = typeof query.user === "string" ? query.user : "";
  const users = await searchCreditUsers(q);
  const selected = users.find((user) => user.userId === selectedId) ?? null;
  const ledger = selected ? await getRecentCreditLedger(selected.userId) : [];
  return <main className="projects-page"><section className="projects-panel admin-usage-panel"><header className="projects-header"><Brand /><AdminNav /></header><div className="projects-title"><div><span>ADMIN · CREDIT</span><h1>크레딧 관리</h1><p>이메일로 사용자를 찾고 지급 사유와 함께 Credit을 추가합니다.</p></div></div><form className="admin-search" method="get"><input name="q" type="search" defaultValue={q} placeholder="사용자 이메일 검색" /><button>검색</button></form>{users.length ? <div className="credit-user-list">{users.map((user) => <Link className={user.userId === selectedId ? "active" : ""} key={user.userId} href={`/admin/credits?q=${encodeURIComponent(q)}&user=${user.userId}`}><span>{user.email}</span><b>{user.balance}C</b></Link>)}</div> : q ? <div className="projects-empty"><p>검색 결과가 없습니다.</p></div> : null}{selected ? <section className="credit-admin-detail"><div className="credit-current"><span>{selected.email}</span><strong>{selected.balance}C</strong></div><CreditGrantForm userId={selected.userId} /><div className="usage-table-wrap"><table><thead><tr><th>일시</th><th>유형</th><th>변경</th><th>잔액</th><th>사유</th></tr></thead><tbody>{ledger.map((entry) => <tr key={String(entry.id)}><td>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(String(entry.created_at)))}</td><td>{String(entry.type)}</td><td>{Number(entry.amount) > 0 ? "+" : ""}{String(entry.amount)}C</td><td>{String(entry.balance_after)}C</td><td>{String(entry.reason ?? "-")}</td></tr>)}</tbody></table></div></section> : null}</section></main>;
}
