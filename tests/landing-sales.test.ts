import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";

const landing = await readFile(new URL("../components/landing/landing-page.tsx", import.meta.url), "utf8");
const composer = await readFile(new URL("../components/landing/prompt-composer.tsx", import.meta.url), "utf8");
const resultGallery = await readFile(new URL("../components/landing/result-gallery.tsx", import.meta.url), "utf8");
const templateCatalog = await readFile(new URL("../lib/templates/catalog.ts", import.meta.url), "utf8");
const templateBoard = await readFile(new URL("../components/resources/template-board.tsx", import.meta.url), "utf8");
const templateLightbox = await readFile(new URL("../components/templates/template-lightbox.tsx", import.meta.url), "utf8");
const templateLightboxStyles = await readFile(new URL("../components/templates/template-lightbox.module.css", import.meta.url), "utf8");
const styles = await readFile(new URL("../components/landing/landing-sales.module.css", import.meta.url), "utf8");
const planCards = await readFile(new URL("../components/pricing/plan-cards.tsx", import.meta.url), "utf8");
const planCardStyles = await readFile(new URL("../components/pricing/plan-cards.module.css", import.meta.url), "utf8");
const siteInfo = await readFile(new URL("../lib/site-info.ts", import.meta.url), "utf8");
const siteFooter = await readFile(new URL("../components/site/site-footer.tsx", import.meta.url), "utf8");
const siteHeader = await readFile(new URL("../components/site/site-header.tsx", import.meta.url), "utf8");
const landingCopy = landing.replace(/<[^>]+>/g, "");

test("초보자용 판매 랜딩은 요청된 핵심 흐름을 짧은 섹션으로 제공한다", () => {
  for (const copy of [
    "10분 만에, 내 브랜드에 맞는",
    "AI라서 다 비슷할 것 같나요?",
    "보기만 하는 디자인이 아닙니다.",
    "꼭 큰 비용부터 써야 할까요?",
    "첫 번째 디자인이",
    "정답일 필요는 없습니다.",
    "HTML이나 CSS를",
    "몰라도 됩니다.",
    "상품을 다시 등록할",
    "결제하기 전에",
    "디자인을 사는 대신, 만들어보세요.",
    "내 쇼핑몰이라면",
  ]) assert.match(landingCopy, new RegExp(copy));
  assert.match(landing, /\["AI 생성", "Editor", "Download", "Installer", "Cafe24"\]/);
  assert.match(landing, /<PlanCards /);
  assert.match(planCards, /plans\.map/);
  assert.match(landing, /CREDIT_COSTS\.designGeneration/);
});

test("랜딩 v1 카피와 메뉴, 가격 사용 횟수를 요청대로 표시한다", () => {
  assert.match(landing, /heroLineFirst[^>]*>[\s\S]*?10분 만에[\s\S]*?내 브랜드에 맞는/);
  assert.match(landing, /heroLineSecond[^>]*>카페24 쇼핑몰을 만들어보세요\.<\/span>/);
  assert.match(landingCopy, /쇼핑몰을 제작하는데,꼭 큰 비용부터/);
  assert.match(landingCopy, /첫 번째 디자인이정답일 필요는/);
  assert.match(landingCopy, /HTML이나 CSS를몰라도 됩니다/);
  assert.match(planCards, /Math\.floor\(plan\.credits \/ CREDIT_COSTS\.designGeneration\)/);
  const headerMenu = siteHeader.match(/<div className="nav-links"[\s\S]*?<\/div>/)?.[0] ?? "";
  assert.match(headerMenu, />가격</);
  assert.match(headerMenu, />사용 방법</);
  assert.doesNotMatch(headerMenu, /결과 보기|Cafe24 적용/);
});

test("프롬프트 생성 기능은 유지하고 기본 버튼 문구는 생성하기로 표시한다", () => {
  assert.match(landing, /<PromptComposer/);
  assert.match(composer, /<>생성하기 <ArrowRight/);
  assert.match(composer, /fetch\("\/api\/ai\/generate"/);
  assert.match(landing, /가입 즉시 15 Credit 증정 · 디자인 1회 \+ AI 수정 5회 · 카드 등록 없음/);
});

test("업종별 실제 결과 이미지를 crop preview와 전체 보기로 제공한다", () => {
  for (const [category, filename] of [["유아동 / 베이비", "baby.png"], ["유아동 / 키즈", "kids.png"], ["패션 / 스트리트", "streetfashion-v2.png"], ["패션잡화 / 주얼리", "jewelry.png"]]) {
    assert.match(templateCatalog, new RegExp(category));
    assert.match(templateCatalog, new RegExp(`/templates/${filename}`));
  }
  assert.match(landing, /<ResultGallery \/>/);
  assert.match(landing, /href="\/templates">템플릿 더보기/);
  assert.match(resultGallery, /templateCatalog\.map/);
  assert.match(resultGallery, /sizes="\(max-width: 980px\)/);
  assert.match(resultGallery, /<TemplateLightbox/);
  assert.match(templateLightbox, /Escape/);
  assert.match(templateLightbox, /event\.target === event\.currentTarget/);
  assert.match(templateLightbox, /aria-label="전체 보기 닫기"/);
  assert.equal((resultGallery.match(/unoptimized/g) ?? []).length, 2);
  assert.match(styles, /@media \(max-width: 680px\)/);
  assert.match(styles, /\.resultPreview[^}]*aspect-ratio: 5 \/ 4/);
  assert.match(styles, /\.resultPreviewImage \{ object-fit: cover/);
  assert.match(templateLightboxStyles, /\.panel[^}]*overflow-y: auto/);
});

test("자료실 템플릿 게시판은 이미지·카테고리·브랜드 컬러·프롬프트 복사를 제공한다", () => {
  assert.match(templateBoard, /templates\.map/);
  assert.match(templateBoard, /template\.imageUrl/);
  assert.match(templateBoard, /template\.category/);
  assert.match(templateBoard, /template\.brandColor/);
  assert.match(templateBoard, /template\.prompt/);
  assert.match(templateBoard, /navigator\.clipboard\.writeText/);
  assert.match(templateBoard, /프롬프트 복사/);
  assert.match(templateBoard, /<TemplateLightbox/);
  assert.match(templateBoard, /전체보기/);
  assert.match(templateLightboxStyles, /\.image[^}]*width: 100%[^}]*height: auto/);
});

test("Cafe24 적용 비교와 Editor 수정 영역은 실제 로컬 이미지를 사용한다", () => {
  for (const imagePath of [
    "/samples/cafe24/editor.png",
    "/samples/cafe24/cafe24.png",
    "/samples/editor/editor-view.png",
  ]) assert.match(landing, new RegExp(imagePath.replaceAll("/", "\\/")));
  assert.match(landing, /MOLIVE Editor/);
  assert.match(landing, /실제 Cafe24 적용/);
  assert.equal((landing.match(/unoptimized/g) ?? []).length, 3);
  assert.match(styles, /\.compareImageFrame[^}]*aspect-ratio: 2\.1 \/ 1/);
  assert.match(styles, /\.compareImage \{ object-fit: contain/);
  assert.match(styles, /\.editorShowcaseImage[^}]*height: auto[^}]*object-fit: contain/);
});

test("가격 카드는 랜딩과 /pricing이 같은 컴포넌트·스타일을 쓰고 serif/italic을 쓰지 않는다", () => {
  const orderPanel = readFileSync(new URL("../components/pricing/order-panel.tsx", import.meta.url), "utf8");
  for (const source of [landing, orderPanel]) {
    assert.match(source, /<PlanCards /);
    assert.match(source, /components\/pricing\/plan-cards/);
  }
  assert.doesNotMatch(planCardStyles, /(?<!sans-)serif|italic|oblique/);
  assert.match(planCardStyles, /font-family: Inter, Pretendard, "Noto Sans KR", Arial, sans-serif/);
  assert.match(planCardStyles, /font-style: normal/);
  assert.doesNotMatch(styles, /\.priceGrid|\.planUsage/);
});

test("랜딩은 하나의 sans-serif 계열과 정식 Footer 설정 구조를 사용한다", () => {
  assert.match(styles, /\.salesPage[^}]*font-family:[^}]*sans-serif/);
  assert.doesNotMatch(styles, /Georgia|Times New Roman|(?:^|[^-])serif\b/);
  assert.match(styles, /\.products \{ width: min\(1180px/);
  assert.match(styles, /\.trial \{ width: min\(1180px/);
  assert.match(styles, /\.finalCta[^}]*linear-gradient\(135deg/);
  assert.match(landing, /<SiteFooter \/>/);
  assert.match(siteFooter, /siteInfo\.policies\.map\(\(policy\) => <Link/);
  assert.match(siteFooter, /© MOLIVE\. All rights reserved\./);
  assert.doesNotMatch(siteFooter, /입력 필요|준비 중/);
  for (const key of [
    "MOLIVE_BUSINESS_NAME",
    "MOLIVE_REPRESENTATIVE",
    "MOLIVE_BUSINESS_REGISTRATION_NUMBER",
    "MOLIVE_MAIL_ORDER_NUMBER",
    "MOLIVE_BUSINESS_ADDRESS",
    "MOLIVE_SUPPORT_EMAIL",
    "MOLIVE_SUPPORT_PHONE",
  ]) assert.match(siteInfo, new RegExp(key));
  for (const path of ["/terms", "/privacy", "/refund"]) assert.match(siteInfo, new RegExp(path));
  for (const businessValue of [
    "투나잇아트",
    "김태승",
    "103-47-00982",
    "제 2023-경기파주-3071 호",
    "경기도 파주시 청석로 272, 1004-F190호(동패동, 센타프라자1, 공유오피스)",
    "kimts827@gmail.com",
    "010-5105-8033",
  ]) assert.match(siteInfo, new RegExp(businessValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(siteFooter, /href=\{`mailto:\$\{siteInfo\.business\.supportEmail\}`\}/);
  assert.match(siteFooter, /siteInfo\.business\.supportPhone/);
});

test("주요 헤드카피는 중간 굵기 문장과 제한된 MOLIVE 포인트 강조를 사용한다", () => {
  assert.match(styles, /\.sectionTitle h2[^}]*font-weight: 500/);
  assert.match(styles, /\.heroLineFirst, \.heroLineSecond[^}]*font-weight: 500/);
  assert.match(styles, /\.headlineAccent[^}]*color: #655bdd[^}]*font-weight: 750/);
  assert.match(styles, /\.products \.headlineAccent[^}]*color: #c7b9ff/);
  assert.match(styles, /\.finalCta \.headlineAccent[^}]*color: white/);
  assert.match(styles, /\.footerBrand > strong[^}]*font-weight: 500/);
  assert.match(styles, /\.hero :global\(\.prompt-composer\)[^}]*width: min\(780px, 100%\)/);
  assert.match(styles, /\.hero \{ width: calc\(100% - 16px\); padding: 70px 0 82px; \}/);
  assert.match(styles, /\.finalCta a[^}]*min-height: 70px[^}]*font-size: 23px/);
  assert.match(styles, /\.finalCta small[^}]*font-size: 20px/);
  assert.ok((landing.match(/styles\.headlineAccent/g) ?? []).length <= 12);
});

test("요청된 강조 범위와 무료 Credit·가격 안내 문구를 사용한다", () => {
  assert.match(landing, />다 비슷할 것<\/span> 같나요/);
  assert.match(landing, /디자인을 사는 대신, <span className=\{styles\.headlineAccent\}>만들어보세요\.<\/span>/);
  assert.match(landing, /<SectionTitle title="자주 묻는 질문"/);
  const heroSecondLine = landing.match(/<span className=\{styles\.heroLineSecond\}>[^<]*<\/span>/)?.[0] ?? "";
  assert.match(heroSecondLine, /카페24 쇼핑몰을 만들어보세요/);
  assert.doesNotMatch(heroSecondLine, /headlineAccent/);
  assert.equal((landing.match(/가입 즉시 15 Credit 증정/g) ?? []).length, 3);
  assert.match(planCards, /쇼핑몰 디자인 생성 최대 \{Math\.floor/);
  assert.match(landing, /쇼핑몰 디자인 생성 \{CREDIT_COSTS\.designGeneration\}C · AI 수정/);
});
