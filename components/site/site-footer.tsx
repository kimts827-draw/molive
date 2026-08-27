import Link from "next/link";
import { Brand } from "@/components/brand";
import styles from "@/components/landing/landing-sales.module.css";
import { moliveSiteInfo } from "@/lib/site-info";

export function SiteFooter() {
  const siteInfo = moliveSiteInfo();

  return <footer className={styles.footer}>
    <div className={styles.footerBrand}><Brand /><p>MOLIVE — AI Design Platform for Cafe24</p><strong>쇼핑몰을 만들고, 바꾸고, 계속 살아있게.</strong></div>
    <div className={styles.footerDetails}>
      <nav className={styles.footerLinks} aria-label="Footer 메뉴"><Link href="/guide">사용 방법</Link><Link href="/pricing">가격</Link>{siteInfo.policies.map((policy) => <Link href={policy.href} key={policy.label}>{policy.label}</Link>)}</nav>
      <dl className={styles.businessInfo}>
        <div><dt>상호</dt><dd>{siteInfo.business.name}</dd></div>
        <div><dt>대표자</dt><dd>{siteInfo.business.representative}</dd></div>
        <div><dt>사업자등록번호</dt><dd>{siteInfo.business.registrationNumber}</dd></div>
        <div><dt>통신판매업 신고번호</dt><dd>{siteInfo.business.mailOrderNumber}</dd></div>
        <div><dt>사업장 주소</dt><dd>{siteInfo.business.address}</dd></div>
        <div><dt>고객문의 이메일</dt><dd><a href={`mailto:${siteInfo.business.supportEmail}`}>{siteInfo.business.supportEmail}</a></dd></div>
      </dl>
    </div>
    <p className={styles.copyright}>© MOLIVE. All rights reserved.</p>
  </footer>;
}
