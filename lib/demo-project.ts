import type { ProjectSource } from "@/lib/project-source";

export const demoProject: ProjectSource = {
  id: "demo-atelier-nol-source",
  name: "Atelier Nol — Project Source",
  updatedAt: new Date(0).toISOString(),
  architecture: {
    header: "큰 워드마크와 세로형 유틸리티 내비게이션이 캔버스 가장자리를 프레이밍",
    hero: "제품 이미지를 화면 전체에 두고 타이틀이 이미지 위를 가로지르는 오버레이 구성",
    sections: ["오버레이 이미지 Hero", "가로 제품 인덱스", "재료 선언문", "스튜디오 노트"],
    productPresentation: "세로 카드 그리드가 아니라 숫자와 제품명이 먼저 읽히는 가로형 컬렉션 인덱스",
    typography: "초대형 세리프 디스플레이와 작은 모노스페이스 메타데이터의 대비",
    footer: "큰 브랜드 서명과 두 개의 간결한 정보 열",
  },
  html: `<div data-moire-root="atelier-nol">
  <header class="nol-header" data-moire-id="nol-header" data-moire-type="header">
    <a class="nol-wordmark" href="/index.html" data-moire-id="nol-logo" data-moire-type="button">ATELIER NOL</a>
    <nav aria-label="주요 메뉴"><a href="/product/list.html" data-moire-id="nol-nav-shop" data-moire-type="navigation">COLLECTION</a><a href="/shopinfo/company.html" data-moire-id="nol-nav-story" data-moire-type="navigation">STUDIO</a><a href="/order/basket.html" data-moire-id="nol-nav-cart" data-moire-type="navigation">BAG</a></nav>
  </header>
  <main>
    <section class="nol-hero" data-moire-id="nol-hero" data-moire-type="hero">
      <img src="https://images.unsplash.com/photo-1567538096630-e0c5760a2f3e?auto=format&fit=crop&w=1800&q=86" alt="뉴트럴 톤 라운지 체어" data-moire-id="nol-hero-image" data-moire-type="image">
      <p class="nol-index" data-moire-id="nol-hero-index" data-moire-type="text">OBJECT 01 / SEOUL</p>
      <h1 data-moire-id="nol-hero-title" data-moire-type="text">Quiet forms<br>for daily rituals.</h1>
      <a class="nol-round-link" href="/product/list.html" data-moire-id="nol-hero-button" data-moire-type="button">View objects ↗</a>
    </section>
    <section class="nol-products" data-moire-id="nol-products" data-moire-type="products">
      <p data-moire-id="nol-products-label" data-moire-type="text">SELECTED OBJECTS / 2026</p>
      <div class="nol-product-index" data-cafe24-slot="product-list">
        <article><span>01</span><img src="https://images.unsplash.com/photo-1598300053650-1534a50ef1d4?auto=format&fit=crop&w=900&q=82" alt="원목 체어" data-moire-id="nol-product-image-1" data-moire-type="image"><h2 data-moire-id="nol-product-title-1" data-moire-type="text">Nol Lounge</h2><p data-moire-id="nol-product-price-1" data-moire-type="text">Cafe24 상품 가격</p></article>
        <article><span>02</span><img src="https://images.unsplash.com/photo-1532372320572-cda25653a694?auto=format&fit=crop&w=900&q=82" alt="미니멀 테이블" data-moire-id="nol-product-image-2" data-moire-type="image"><h2 data-moire-id="nol-product-title-2" data-moire-type="text">Fold Table</h2><p data-moire-id="nol-product-price-2" data-moire-type="text">Cafe24 상품 가격</p></article>
      </div>
    </section>
    <section class="nol-statement" data-moire-id="nol-statement" data-moire-type="section"><p data-moire-id="nol-statement-kicker" data-moire-type="text">MATERIAL STUDY 04</p><h2 data-moire-id="nol-statement-title" data-moire-type="text">Wood, linen, and honest marks become better with time.</h2></section>
  </main>
  <footer class="nol-footer" data-moire-id="nol-footer" data-moire-type="footer"><h2 data-moire-id="nol-footer-logo" data-moire-type="text">NOL</h2><p data-moire-id="nol-footer-address" data-moire-type="text">Seoul · objects made slowly</p><a href="/shopinfo/company.html" data-moire-id="nol-footer-link" data-moire-type="button">Read our studio note</a></footer>
</div>`,
  css: `[data-moire-root="atelier-nol"]{--ink:#171713;--paper:#e8e5db;display:block;color:var(--ink);background:var(--paper);font-family:Arial,sans-serif}
[data-moire-root="atelier-nol"] *{box-sizing:border-box}
[data-moire-root="atelier-nol"] a{color:inherit;text-decoration:none}
[data-moire-root="atelier-nol"] .nol-header{position:absolute;z-index:4;top:0;left:0;width:100%;padding:28px 34px;display:flex;justify-content:space-between;align-items:flex-start;color:white}
[data-moire-root="atelier-nol"] .nol-wordmark{font:700 13px/1 Arial,sans-serif;letter-spacing:.18em}
[data-moire-root="atelier-nol"] .nol-header nav{display:grid;gap:8px;text-align:right;font:600 9px/1 Arial,sans-serif;letter-spacing:.14em}
[data-moire-root="atelier-nol"] .nol-hero{position:relative;min-height:780px;overflow:hidden;color:white;background:#57584f}
[data-moire-root="atelier-nol"] .nol-hero>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(.65) brightness(.7)}
[data-moire-root="atelier-nol"] .nol-index{position:absolute;z-index:2;left:34px;top:46%;margin:0;font:500 9px/1 monospace;letter-spacing:.16em}
[data-moire-root="atelier-nol"] .nol-hero h1{position:absolute;z-index:2;left:7%;bottom:8%;margin:0;font:400 clamp(70px,10vw,160px)/.78 Georgia,serif;letter-spacing:-.07em}
[data-moire-root="atelier-nol"] .nol-round-link{position:absolute;z-index:2;right:6%;bottom:10%;width:116px;height:116px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.7);border-radius:50%;font-size:10px}
[data-moire-root="atelier-nol"] .nol-products{padding:105px 4vw 130px}
[data-moire-root="atelier-nol"] .nol-products>p{margin:0 0 34px;font:500 9px/1 monospace;letter-spacing:.16em}
[data-moire-root="atelier-nol"] .nol-product-index{border-top:1px solid var(--ink)}
[data-moire-root="atelier-nol"] .nol-product-index article{min-height:260px;padding:18px 0;display:grid;grid-template-columns:7% 27% 1fr auto;gap:28px;align-items:center;border-bottom:1px solid var(--ink)}
[data-moire-root="atelier-nol"] .nol-product-index img{width:100%;height:220px;object-fit:cover}
[data-moire-root="atelier-nol"] .nol-product-index h2{margin:0;font:400 clamp(36px,5vw,76px)/1 Georgia,serif;letter-spacing:-.05em}
[data-moire-root="atelier-nol"] .nol-product-index p{font-size:10px}
[data-moire-root="atelier-nol"] [data-cafe24-slot="product-list"] .prdList{margin:0;padding:0;display:grid;gap:0;list-style:none;border-top:1px solid var(--ink)}
[data-moire-root="atelier-nol"] [data-cafe24-slot="product-list"] .prdList__item{min-height:260px;padding:18px 0;display:grid;grid-template-columns:32% 1fr;gap:28px;align-items:center;border-bottom:1px solid var(--ink)}
[data-moire-root="atelier-nol"] [data-cafe24-slot="product-list"] .thumbnail img{width:100%;height:220px;object-fit:cover}
[data-moire-root="atelier-nol"] [data-cafe24-slot="product-list"] .description{font-family:Georgia,serif;font-size:24px}
[data-moire-root="atelier-nol"] .nol-statement{padding:140px 8vw;background:#a59d83}
[data-moire-root="atelier-nol"] .nol-statement p{font:500 9px/1 monospace;letter-spacing:.16em}
[data-moire-root="atelier-nol"] .nol-statement h2{max-width:1200px;margin:55px 0 0;font:400 clamp(56px,8vw,126px)/.9 Georgia,serif;letter-spacing:-.06em}
[data-moire-root="atelier-nol"] .nol-footer{padding:70px 4vw 35px;display:grid;grid-template-columns:1fr auto;align-items:end;background:var(--ink);color:var(--paper)}
[data-moire-root="atelier-nol"] .nol-footer h2{grid-column:1/-1;margin:0 0 80px;font:400 25vw/.65 Georgia,serif;letter-spacing:-.09em}
[data-moire-root="atelier-nol"] .nol-footer p,[data-moire-root="atelier-nol"] .nol-footer a{margin:0;font-size:10px}
@media(max-width:700px){[data-moire-root="atelier-nol"] .nol-hero{min-height:680px}[data-moire-root="atelier-nol"] .nol-hero h1{left:22px;bottom:18%;font-size:62px}[data-moire-root="atelier-nol"] .nol-round-link{right:22px;bottom:24px;width:90px;height:90px}[data-moire-root="atelier-nol"] .nol-product-index article{grid-template-columns:35px 1fr;gap:15px}[data-moire-root="atelier-nol"] .nol-product-index img{grid-column:2;height:260px}[data-moire-root="atelier-nol"] .nol-product-index h2,[data-moire-root="atelier-nol"] .nol-product-index p{grid-column:2}[data-moire-root="atelier-nol"] .nol-statement{padding:90px 24px}[data-moire-root="atelier-nol"] .nol-footer{grid-template-columns:1fr;gap:16px}}`,
};
