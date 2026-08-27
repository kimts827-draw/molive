import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Check,
  Image as ImageIcon,
  LayoutTemplate,
  PackageCheck,
  Palette,
  RefreshCcw,
  ShoppingBag,
  Sparkles,
  Type,
  WandSparkles,
} from "lucide-react";
import { PromptComposer } from "@/components/landing/prompt-composer";
import { ResultGallery } from "@/components/landing/result-gallery";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { CREDIT_COSTS, CREDIT_PLANS } from "@/lib/credits/catalog";
import styles from "./landing-sales.module.css";

const editFeatures = [
  { label: "글자 수정", icon: Type },
  { label: "색상 변경", icon: Palette },
  { label: "이미지 교체", icon: ImageIcon },
  { label: "레이아웃 조정", icon: LayoutTemplate },
  { label: "AI 수정", icon: WandSparkles },
] as const;

const faqs = [
  ["AI가 만든 디자인을 직접 바꿀 수 있나요?", "네. 글자, 색상, 이미지, 크기 등을 직접 바꿀 수 있습니다."],
  ["Cafe24 상품을 다시 등록해야 하나요?", "아니요. 기존 상품을 그대로 사용합니다."],
  ["코딩을 알아야 하나요?", "아니요. 코드를 직접 수정할 필요가 없습니다."],
  ["마음에 들지 않으면 다시 만들 수 있나요?", "네. 보유 Credit 안에서 다시 생성할 수 있습니다."],
  ["다운로드 횟수 제한이 있나요?", "없습니다. 한 번 만든 디자인은 계속 수정하고 다시 다운로드할 수 있습니다."],
  ["Cafe24에 다시 적용하면 추가 비용이 있나요?", "없습니다."],
  ["현재 결제는 어떻게 하나요?", "오픈베타 기간에는 계좌이체로 이용할 수 있습니다."],
] as const;

function SectionTitle({ title, description }: { title: ReactNode; description?: string }) {
  return <header className={styles.sectionTitle}>
    <h2>{title}</h2>
    {description ? <p>{description}</p> : null}
  </header>;
}

function EditorShowcase() {
  return <div className={styles.editorShowcase} aria-label="MOLIVE Editor 화면 예시">
    <Image className={styles.editorShowcaseImage} src="/samples/editor/editor-view.png" alt="MOLIVE Editor 편집 화면" width={1915} height={909} unoptimized sizes="(max-width: 680px) calc(100vw - 16px), (max-width: 980px) calc(100vw - 32px), 1360px" />
  </div>;
}

export function LandingPage({ userEmail, creditBalance, persistenceEnabled, demoMode, missingEnv }: { userEmail: string | null; creditBalance: number | null; persistenceEnabled: boolean; demoMode: boolean; missingEnv: string[] }) {
  const startHref = userEmail ? "#create" : "/login?next=%2F%23create";
  return (
    <main className={`marketing-shell ${styles.salesPage}`}>
      {!persistenceEnabled ? <div className="persistence-banner">{demoMode ? "개발 데모 모드 · 영구 저장이 비활성화돼 있습니다." : `영구 저장 설정이 완료되지 않았습니다 · ${missingEnv.join(", ")}`}</div> : null}
      <SiteHeader userEmail={userEmail} persistenceEnabled={persistenceEnabled} priceHref="#price" loginNext="/#create" />

      <section className={styles.hero} id="create">
        <div className="eyebrow"><Sparkles size={14} /> AI DESIGN PLATFORM FOR CAFE24</div>
        <h1><span className={styles.heroLineFirst}><span className={styles.headlineAccent}>10분 만에</span>, 내 브랜드에 맞는</span><span className={styles.heroLineSecond}>카페24 쇼핑몰을 만들어보세요.</span></h1>
        <p>브랜드와 상품을 설명하면 AI가 쇼핑몰 디자인을 만듭니다.<br />마음에 드는 부분은 직접 바꾸고, Cafe24에 적용할 수 있어요.</p>
        <PromptComposer signedIn={Boolean(userEmail)} creditBalance={creditBalance} persistenceEnabled={persistenceEnabled} demoMode={demoMode} />
        <p className={styles.creditNote}><Check size={13} /> 가입 즉시 15 Credit 증정 · 디자인 1회 + AI 수정 5회 · 카드 등록 없음</p>
        <p className={styles.heroSupport}>기성 디자인을 고르는 대신,<br /><b>내 브랜드에 맞는 디자인을 직접 만들어보세요.</b></p>
      </section>

      <section className={`${styles.section} ${styles.results}`} id="results">
        <SectionTitle title={<>AI라서 <span className={styles.headlineAccent}>다 비슷할 것</span> 같나요?</>} description="아래는 MOLIVE에서 실제로 만든 쇼핑몰 디자인입니다." />
        <ResultGallery />
      </section>

      <section className={`${styles.section} ${styles.apply}`} id="apply">
        <SectionTitle title={<><span className={styles.headlineAccent}>보기만 하는</span> 디자인이 아닙니다.</>} description={"Editor에서 원하는 부분을 바꾼 뒤\n실제 Cafe24 스킨에 적용할 수 있습니다."} />
        <div className={styles.applySteps}>{["AI 생성", "Editor", "Download", "Installer", "Cafe24"].map((step, index) => <div key={step}><span>{String(index + 1).padStart(2, "0")}</span><b>{step}</b>{index < 4 ? <ArrowRight size={16} /> : null}</div>)}</div>
        <div className={styles.applyCompare}>
          <article><span>MOLIVE Editor</span><div className={styles.compareImageFrame}><Image className={styles.compareImage} src="/samples/cafe24/editor.png" alt="MOLIVE Editor Preview" fill unoptimized sizes="(max-width: 980px) calc(100vw - 68px), 560px" /></div></article>
          <div><ArrowRight /><span>그대로 적용</span></div>
          <article><span>실제 Cafe24 적용</span><div className={styles.compareImageFrame}><Image className={styles.compareImage} src="/samples/cafe24/cafe24.png" alt="실제 Cafe24 적용 결과" fill unoptimized sizes="(max-width: 980px) calc(100vw - 68px), 560px" /></div></article>
        </div>
      </section>

      <section className={`${styles.section} ${styles.cost}`}>
        <SectionTitle title={<>쇼핑몰을 제작하는데,<br />꼭 <span className={styles.headlineAccent}>큰 비용</span>부터 써야 할까요?</>} />
        <div className={styles.costTable} role="table" aria-label="쇼핑몰 제작 방법 비용 비교">
          <article><span>Cafe24 기성 디자인</span><strong>평균 20~25만원</strong><ul><li>브랜드 맞춤 제한</li><li>다른 디자인은 추가 구매</li></ul></article>
          <article><span>자사몰 제작 외주</span><strong>최소 200만원부터</strong><ul><li>원하는 디자인 가능</li><li>수정할 때 다시 소통</li></ul></article>
          <article className={styles.costMolive}><span>MOLIVE</span><strong>14,900원부터</strong><ul><li>내 브랜드에 맞게 생성</li><li>다시 생성하고 직접 수정</li><li>Cafe24 적용 가능</li></ul></article>
        </div>
      </section>

      <section className={`${styles.section} ${styles.edit}`}>
        <SectionTitle title={<>첫 번째 디자인이<br /><span className={styles.headlineAccent}>정답</span>일 필요는 없습니다.</>} description={"다른 분위기로 다시 만들고,\n마음에 드는 결과를 직접 수정하세요."} />
        <div className={styles.editFeatureList}>{editFeatures.map(({ label, icon: Icon }) => <div key={label}><Icon size={17} /><span>{label}</span></div>)}</div>
        <EditorShowcase />
        <p className={styles.editEmphasis}><RefreshCcw size={18} /> 생성은 시작일 뿐입니다.</p>
      </section>

      <section className={`${styles.section} ${styles.how}`} id="how">
        <SectionTitle title={<>HTML이나 CSS를<br /><span className={styles.headlineAccent}>몰라도 됩니다.</span></>} />
        <ol>{["쇼핑몰을 설명하세요", "AI가 디자인을 만듭니다", "원하는 부분을 수정하세요", "Cafe24에 적용하세요"].map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><b>{step}</b></li>)}</ol>
      </section>

      <section className={`${styles.section} ${styles.products}`}>
        <div><span>YOUR PRODUCTS, AS THEY ARE</span><h2>상품을 <span className={styles.headlineAccent}>다시 등록할</span><br />필요도 없습니다.</h2><p>기존 Cafe24 상품은 그대로 사용합니다.<br />디자인만 바꾸면 상품 이미지와 정보가 자동으로 연결됩니다.</p></div>
        <div className={styles.productVisual}><div><ShoppingBag size={25} /><b>기존 상품</b></div><ArrowRight /><div><Sparkles size={25} /><b>새 디자인</b></div><PackageCheck className={styles.productCheck} /></div>
      </section>

      <section className={`${styles.section} ${styles.trial}`}>
        <div><Sparkles /><span>15C FREE</span></div><h2>결제하기 전에<br /><span className={styles.headlineAccent}>직접 만들어보세요.</span></h2><p>가입 즉시 15 Credit 증정</p><strong>디자인 1회 생성 + AI 수정 5회</strong><Link href={startHref}>무료로 시작하기 <ArrowRight size={17} /></Link><small>카드 등록 없음</small>
      </section>

      <section className={`${styles.section} ${styles.price}`} id="price">
        <SectionTitle title={<>디자인을 사는 대신, <span className={styles.headlineAccent}>만들어보세요.</span></>} />
        <div className={styles.priceGrid}>{CREDIT_PLANS.map((plan) => <article className={plan.recommended ? styles.priceRecommended : undefined} key={plan.id}>{plan.recommended ? <span>추천</span> : null}<small>{plan.name}</small><h3>{plan.price.toLocaleString("ko-KR")}원</h3><strong>{plan.credits} Credit</strong><div className={styles.planUsage}><b>쇼핑몰 디자인 생성 최대 {Math.floor(plan.credits / CREDIT_COSTS.designGeneration)}회</b><p>또는 AI 수정에 자유롭게 사용</p></div><Link href="/pricing">선택하기 <ArrowRight size={15} /></Link></article>)}</div>
        <div className={styles.priceNotes}><p>쇼핑몰 디자인 생성 {CREDIT_COSTS.designGeneration}C · AI 수정 {CREDIT_COSTS.editorAi}C</p><p>직접 수정 · 다운로드 · Cafe24 적용은 추가 Credit 없음</p></div>
      </section>

      <section className={`${styles.section} ${styles.faq}`}>
        <SectionTitle title="자주 묻는 질문" />
        <div>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span>＋</span></summary><p>{answer}</p></details>)}</div>
      </section>

      <section className={styles.finalCta}>
        <Sparkles size={19} /><h2><span className={styles.headlineAccent}>내 쇼핑몰이라면</span><br />어떻게 만들어질까요?</h2><p>브랜드와 원하는 느낌을 설명해보세요.<br />MOLIVE가 첫 번째 디자인을 만들어드립니다.</p><Link href={startHref}>무료로 시작하기 <ArrowRight size={17} /></Link><small>가입 즉시 15 Credit 증정</small>
      </section>

      <SiteFooter />
    </main>
  );
}
