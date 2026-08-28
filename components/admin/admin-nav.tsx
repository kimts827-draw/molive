import Link from "next/link";

export function AdminNav() {
  return <nav className="admin-nav" aria-label="관리자 메뉴"><Link href="/admin/usage">사용량</Link><Link href="/admin/orders">주문 관리</Link><Link href="/admin/credits">크레딧 관리</Link><Link href="/admin/inquiries">문의</Link></nav>;
}
