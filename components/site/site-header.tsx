import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Brand } from "@/components/brand";
import { ResourceDropdown } from "@/components/resources/resource-dropdown";

export function SiteHeader({ userEmail, persistenceEnabled, priceHref = "/pricing", loginNext = "/" }: { userEmail: string | null; persistenceEnabled: boolean; priceHref?: string; loginNext?: string }) {
  const loginHref = `/login?next=${encodeURIComponent(loginNext)}`;

  return <nav className="marketing-nav">
    <Brand />
    <div className="nav-links" aria-label="주요 메뉴"><Link href={priceHref}>가격</Link><Link href="/guide">사용 방법</Link><Link href="/contact">문의</Link><ResourceDropdown /></div>
    <div className="nav-actions">
      <ResourceDropdown mobile />
      <Link className="contact-mobile-link" href="/contact">문의</Link>
      {userEmail ? <><Link className="text-link" href="/projects">내 디자인</Link><Link className="text-link" href="/account">계정</Link><span className="nav-user" title={userEmail}>{userEmail}</span><form action="/auth/signout" method="post"><button className="nav-signout" type="submit">로그아웃</button></form></> : persistenceEnabled ? <Link className="button button-dark button-small" href={loginHref}>로그인 <ArrowRight size={15} /></Link> : <span className="nav-disabled">저장 설정 필요</span>}
    </div>
  </nav>;
}
