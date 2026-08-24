import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Code2,
  MousePointer2,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { PromptComposer } from "@/components/landing/prompt-composer";

export function LandingPage({ userEmail, persistenceEnabled, demoMode, missingEnv }: { userEmail: string | null; persistenceEnabled: boolean; demoMode: boolean; missingEnv: string[] }) {
  return (
    <main className="marketing-shell">
      {!persistenceEnabled && <div className="persistence-banner">{demoMode ? "개발 데모 모드 · 영구 저장이 비활성화돼 있습니다." : `영구 저장 설정이 완료되지 않았습니다 · ${missingEnv.join(", ")}`}</div>}
      <nav className="marketing-nav">
        <Brand />
        <div className="nav-links" aria-label="주요 메뉴">
          <a href="#product">제품</a>
          <a href="#how">작동 방식</a>
          <a href="#safety">Cafe24 보호</a>
        </div>
        <div className="nav-actions">
          <Link className="text-link" href="/editor">데모 열기</Link>
          {userEmail ? <><Link className="text-link" href="/projects">내 디자인</Link><Link className="text-link" href="/account">계정</Link><span className="nav-user" title={userEmail}>{userEmail}</span><form action="/auth/signout" method="post"><button className="nav-signout" type="submit">로그아웃</button></form></> : persistenceEnabled ? <Link className="button button-dark button-small" href="/login?next=%2F%23create">로그인 <ArrowRight size={15} /></Link> : <span className="nav-disabled">저장 설정 필요</span>}
        </div>
      </nav>

      <section className="hero-section" id="create">
        <div className="eyebrow"><Sparkles size={14} /> Cafe24를 위한 AI 디자인 스튜디오</div>
        <h1>설명하면 만들어지고,<br /><em>클릭하면 바뀝니다.</em></h1>
        <p className="hero-copy">
          브랜드를 말해 주세요. Moiré가 Cafe24의 판매 기능은 그대로 지키면서<br className="desktop-only" />
          레이아웃, 타이포그래피, 컬러와 상품 표현을 새롭게 디자인합니다.
        </p>
        <PromptComposer signedIn={Boolean(userEmail)} persistenceEnabled={persistenceEnabled} demoMode={demoMode} />
        <p className="hero-note"><Check size={13} /> HTML·FTP 작업 없이 Cafe24에 바로 연결</p>
      </section>

      <section className="product-stage" id="product" aria-label="제품 편집 화면 미리보기">
        <div className="stage-glow" />
        <div className="editor-preview-window">
          <div className="preview-topbar">
            <div className="preview-brand"><span className="brand-dot" /> ATELIER NOL</div>
            <div className="preview-page">홈 <ChevronRight size={13} /></div>
            <div className="preview-tools"><span>실행 취소</span><span>미리보기</span><b>게시</b></div>
          </div>
          <div className="preview-body">
            <aside className="preview-sidebar">
              <span className="side-title">페이지</span>
              {['Hero','New arrivals','Brand story','Newsletter'].map((item, index) => (
                <div className={index === 0 ? 'side-row active' : 'side-row'} key={item}>
                  <span className="drag-dots">⠿</span>{item}
                </div>
              ))}
              <button type="button">＋ 섹션 추가</button>
            </aside>
            <div className="preview-canvas-wrap">
              <div className="store-canvas">
                <header><b>ATELIER NOL</b><nav>Collection&nbsp;&nbsp; Studio&nbsp;&nbsp; Notes</nav><span>Bag (0)</span></header>
                <div className="store-hero selected-frame">
                  <div className="selection-label">Hero · AI 편집 가능</div>
                  <div className="store-copy">
                    <span>Object 01 / 2026</span>
                    <h2>Quiet forms<br />for daily rituals.</h2>
                    <p>오래 곁에 둘 수 있는 사물과 가구를 만듭니다.</p>
                    <button type="button">Collection 보기</button>
                  </div>
                  <div className="store-object" aria-label="제품 이미지 자리">
                    <div className="object-shadow" /><div className="chair-back" /><div className="chair-seat" /><div className="chair-leg left" /><div className="chair-leg right" />
                  </div>
                </div>
              </div>
            </div>
            <aside className="preview-inspector">
              <div className="inspector-heading"><b>Hero</b><span>•••</span></div>
              <label>배경</label><div className="color-control"><i /><span>#E7E3D7</span></div>
              <label>콘텐츠 폭</label><div className="segmented"><b>넓게</b><span>보통</span><span>좁게</span></div>
              <label>상단 여백</label><div className="range"><i /></div>
              <div className="ai-change"><Sparkles size={14} /><span>이 영역을 더 고급스럽게</span><ArrowRight size={14} /></div>
            </aside>
          </div>
        </div>
      </section>

      <section className="promise-strip">
        <div><WandSparkles /><span><b>AI가 자유롭게</b> 브랜드마다 다른 구조를 설계</span></div>
        <div><MousePointer2 /><span><b>누구나 클릭으로</b> 텍스트부터 섹션까지 수정</span></div>
        <div><ShieldCheck /><span><b>판매 기능은 Cafe24가</b> 안전하게 그대로 운영</span></div>
      </section>

      <section className="feature-section" id="how">
        <div className="section-kicker">ONE WORKFLOW, TWO WAYS TO CREATE</div>
        <h2>처음엔 대화하고,<br />그다음엔 직접 다듬으세요.</h2>
        <div className="feature-grid">
          <article className="feature-card feature-card-ai">
            <div className="feature-number">01</div>
            <div className="feature-icon"><WandSparkles /></div>
            <h3>프롬프트에서 완성된 스토어로</h3>
            <p>고정 템플릿을 고르는 대신 AI가 브랜드 자료와 요구를 읽고 섹션의 순서, 비율, 여백과 상품 표현까지 설계합니다.</p>
            <div className="mini-chat">
              <div className="mini-message">세라믹 조명 브랜드야. 갤러리처럼 여백이 많고 제품 질감이 잘 보였으면 해.</div>
              <div className="mini-progress"><Sparkles size={14} /><span>브랜드 방향을 분석하고 있어요</span><i /></div>
            </div>
          </article>
          <article className="feature-card feature-card-click">
            <div className="feature-number">02</div>
            <div className="feature-icon"><MousePointer2 /></div>
            <h3>보이는 그대로 클릭해서 수정</h3>
            <p>텍스트, 이미지, 버튼, 섹션을 화면에서 선택하세요. 코드 없이 서체, 컬러, 정렬, 배경과 여백을 바꿀 수 있습니다.</p>
            <div className="mini-inspector">
              <div><span>Title</span><b>New light for<br />quiet evenings.</b></div>
              <div className="type-controls"><span>48 px</span><span>Regular</span><span>◧</span><span>◨</span></div>
              <div className="cursor-chip"><MousePointer2 size={13} /> 직접 편집</div>
            </div>
          </article>
        </div>
      </section>

      <section className="safety-section" id="safety">
        <div className="safety-copy">
          <div className="section-kicker">COMMERCE, GUARDED BY DESIGN</div>
          <h2>디자인은 바꿔도<br />판매 엔진은 건드리지 않습니다.</h2>
          <p>Moiré는 Cafe24 기본 스킨의 모듈, 변수, 옵션, 장바구니와 주문 코드를 먼저 식별합니다. AI가 수정할 수 있는 범위를 Presentation 영역으로 제한하고 배포 전후 지문을 대조합니다.</p>
          <ul>
            <li><ShieldCheck size={18} /> 50개 Cafe24 주문 보호 파일 자동 잠금</li>
            <li><Code2 size={18} /> module·변수·필수 지시문 변경 시 즉시 차단</li>
            <li><RefreshCcw size={18} /> 배포 전 스냅샷과 즉시 롤백</li>
          </ul>
        </div>
        <div className="boundary-card">
          <div className="boundary-head"><span>배포 전 안전 검사</span><b><Check size={14} /> 통과</b></div>
          <div className="boundary-row locked"><ShieldCheck /><div><b>Commerce core</b><span>상품 · 옵션 · 장바구니 · 주문 · 결제</span></div><em>LOCKED</em></div>
          <div className="boundary-code">
            <span>module="product_listmain_1"</span>
            <span>{'{$product_no}  {$product_price}'}</span>
            <span>{'<!--@layout(...)-->'}</span>
          </div>
          <div className="boundary-row editable"><Sparkles /><div><b>Presentation layer</b><span>레이아웃 · 컬러 · 타이포 · 이미지 · 여백</span></div><em>EDITABLE</em></div>
          <div className="boundary-files"><span>index.html</span><span>c24ai-theme.css</span><span>runtime.json</span></div>
        </div>
      </section>

      <section className="flow-section">
        <div className="section-kicker">FROM IDEA TO LIVE STORE</div>
        <h2>FTP 없이, 세 단계면 충분합니다.</h2>
        <div className="flow-grid">
          <div><span>1</span><h3>브랜드 설명</h3><p>프롬프트와 로고, 상품 이미지, 컬러를 추가합니다.</p></div>
          <div><span>2</span><h3>AI 생성 & 클릭 편집</h3><p>완성된 디자인을 보면서 직접 또는 채팅으로 수정합니다.</p></div>
          <div><span>3</span><h3>Cafe24에 게시</h3><p>OAuth로 연결하고 안전 검사 후 버튼 한 번으로 적용합니다.</p></div>
        </div>
        <div className="integration-line"><span>Moiré Studio</span><i /><b>OAuth</b><i /><span>Cafe24 Store</span></div>
      </section>

      <section className="final-cta">
        <div><Sparkles size={18} /> 첫 번째 스토어를 디자인해 보세요</div>
        <h2>브랜드는 이미 당신 안에 있습니다.<br />이제 쇼핑몰로 보여주세요.</h2>
        <Link className="button button-light" href="#create">AI 스튜디오 열기 <ArrowRight size={17} /></Link>
        <p>{persistenceEnabled ? "로그인 후 자동 저장 · Cafe24 연결은 게시할 때" : "개발 데모 데이터로 체험 · 영구 저장 비활성"}</p>
      </section>

      <footer className="marketing-footer">
        <Brand />
        <p>AI design studio for Cafe24.</p>
        <div><a href="#product">제품</a><a href="#safety">안전 설계</a><a href="mailto:hello@example.com">문의</a></div>
        <span>© 2026 Moiré Studio</span>
      </footer>
    </main>
  );
}
