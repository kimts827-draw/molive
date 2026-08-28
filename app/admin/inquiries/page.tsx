import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { InquiryStatusControl } from "@/components/admin/inquiry-status-control";
import { Brand } from "@/components/brand";
import { requireAdminPage } from "@/lib/admin/auth";
import { INQUIRY_CATEGORY_LABELS, INQUIRY_STATUS_LABELS } from "@/lib/inquiries/config";
import { listAdminInquiries } from "@/lib/inquiries/service";

export default async function AdminInquiriesPage({ searchParams }: { searchParams: Promise<{ id?: string | string[] }> }) {
  await requireAdminPage("/admin/inquiries");
  const { id } = await searchParams;
  const selectedId = typeof id === "string" ? id : null;
  const inquiries = await listAdminInquiries();
  const selected = selectedId ? inquiries.find((inquiry) => inquiry.id === selectedId) ?? null : null;
  const dateFormatter = new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });

  return <main className="projects-page"><section className="projects-panel admin-usage-panel">
    <header className="projects-header"><Brand /><AdminNav /></header>
    <div className="projects-title"><div><span>ADMIN · PRIVATE SUPPORT</span><h1>문의</h1><p>접수된 비공개 문의를 확인하고 처리 상태를 관리합니다.</p></div></div>
    {inquiries.length ? <div className="usage-table-wrap inquiries-table"><table><thead><tr><th>접수일</th><th>유형</th><th>제목</th><th>이메일</th><th>상태</th></tr></thead><tbody>{inquiries.map((inquiry) => <tr key={inquiry.id}><td>{dateFormatter.format(new Date(inquiry.createdAt))}</td><td>{INQUIRY_CATEGORY_LABELS[inquiry.category]}</td><td><Link href={`/admin/inquiries?id=${inquiry.id}`}>{inquiry.subject}</Link></td><td><a href={`mailto:${inquiry.email}`}>{inquiry.email}</a></td><td><span className={`inquiry-status ${inquiry.status}`}>{INQUIRY_STATUS_LABELS[inquiry.status]}</span></td></tr>)}</tbody></table></div> : <div className="projects-empty"><p>접수된 문의가 없습니다.</p></div>}
    {selected ? <article className="inquiry-detail"><header><div><span>{INQUIRY_CATEGORY_LABELS[selected.category]}</span><h2>{selected.subject}</h2><a href={`mailto:${selected.email}`}>{selected.email}</a></div><InquiryStatusControl inquiryId={selected.id} initialStatus={selected.status} /></header><dl><div><dt>접수일</dt><dd>{dateFormatter.format(new Date(selected.createdAt))}</dd></div><div><dt>사용자 연결</dt><dd>{selected.userId ?? "비로그인 문의"}</dd></div></dl><p>{selected.content}</p></article> : null}
  </section></main>;
}
