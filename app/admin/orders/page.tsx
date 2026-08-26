import { Brand } from "@/components/brand";
import { AdminNav } from "@/components/admin/admin-nav";
import { OrderApproveButton } from "@/components/admin/order-approve-button";
import { requireAdminPage } from "@/lib/admin/auth";
import { listAdminOrders } from "@/lib/credits/service";

export default async function AdminOrdersPage() {
  await requireAdminPage("/admin/orders");
  const orders = await listAdminOrders("pending");
  return <main className="projects-page"><section className="projects-panel admin-usage-panel"><header className="projects-header"><Brand /><AdminNav /></header><div className="projects-title"><div><span>ADMIN · BANK TRANSFER</span><h1>주문 관리</h1><p>입금내역과 일치하는 주문만 확인해 주세요. 재승인해도 중복 지급되지 않습니다.</p></div></div>{orders.length ? <div className="usage-table-wrap"><table><thead><tr><th>신청시간</th><th>사용자</th><th>플랜</th><th>금액 / Credit</th><th>입금자명</th><th>처리</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(order.createdAt))}</td><td>{order.userEmail}</td><td>{order.planId}</td><td>{order.amount.toLocaleString("ko-KR")}원 / {order.credits}C</td><td><b>{order.depositorName}</b></td><td><OrderApproveButton orderId={order.id} /></td></tr>)}</tbody></table></div> : <div className="projects-empty"><p>확인할 pending 주문이 없습니다.</p></div>}</section></main>;
}
