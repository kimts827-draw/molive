# Cafe24 기본 스킨 분석

분석 대상은 `Guide/twonightart_s2_260815220745_d_skin4_H.tar.gz`의 `skin4`입니다. 이 문서는 생성·편집·배포 엔진이 지켜야 하는 코드 경계를 정의합니다.

## 1. 원본 구조 요약

- 전체 tar 항목: 524개
- 일반 파일: 410개
  - HTML 188개
  - CSS 184개
  - JavaScript 34개
  - JSON/XML/TXT 등 4개
- Cafe24 보호 심볼릭 링크: 50개
- 일반 HTML에서 발견된 Cafe24 `module` 사용: 910회
- 서로 다른 module 식별자: 513종
- Cafe24 지시문: layout 122회, css 279회, js 40회, import 75회

module 계열은 `product` 261회, `myshop` 222회, `board` 201회, `order` 89회, `layout` 38회, `member` 32회 순입니다. 즉 스킨 HTML은 단순 정적 마크업이 아니라 Cafe24 서버 렌더링 계약의 일부입니다.

## 2. 실제 보호 파일

압축 파일에서 아래 50개 파일은 일반 파일이 아니라 Cafe24 서버의 `/home/12r/program/resource/protected/order/ec_orderform/pc/ko_KR/`를 가리키는 심볼릭 링크입니다.

- `order/ec_orderform/**`: 주문상품, 주문자·배송지, 할인, 결제수단, 결제, 약관, 정기배송, 안전전화, 선물 등 41개
- `js/module/order/ec_orderform/**`: `orders.js`, `orders_v2.js`, `auto_resize.js` 3개
- `css/module/order/ec_orderform/**`: 원터치 주문서와 약관 스타일 6개

Windows에서 이 50개 항목의 압축 해제가 실패하는 것은 손상이 아니라, 로컬 Windows가 Cafe24 Linux 서버의 절대 경로 심볼릭 링크를 만들 수 없기 때문입니다. 원본 tar의 링크 메타데이터로 보호 여부를 확인했습니다.

## 3. 수정 경계

### A. 절대 수정 금지

- 위 50개 보호 심볼릭 링크 전체
- `js/module/**`
- `module="..."` 속성의 값과 개수
- `{$...}` Cafe24 변수의 값과 개수
- `<!--@layout(...)-->`, `<!--@css(...)-->`, `<!--@js(...)-->`, `<!--@import(...)-->`
- 상품 옵션·수량·가격·재고·장바구니·로그인·주문·결제와 연결된 form/input/select/button의 id, name, action, onclick
- Cafe24가 주입하는 상품·옵션·회원·주문 JavaScript

### B. 제한적 변경

아래 경로는 커머스 동작과 밀접하므로 HTML 구조 변경을 금지하고 별도 CSS 오버레이만 허용합니다.

- `order/**`
- `member/**`
- `myshop/**`
- `coupon/**`
- `product/detail.html`
- `product/basket_option.html`, `product/add_basket*.html`, 옵션·재고 레이어
- `js/common.js`, `layout/basic/js/**`

상품 상세의 갤러리 비율, 정보 블록의 색·간격처럼 시각적 변경은 가능하지만, 기존 노드의 id/class/module을 유지한 상태에서 스코프된 CSS로만 적용합니다.

### C. Presentation 변경 가능

- `index.html`의 브랜드·캠페인용 커스텀 영역
- `layout/basic/main.html`, `layout.html`, `navigation.html`, `footer.html`, `topbanner.html`의 비커머스 래퍼와 카피
- `layout/basic/css/main.css`, `layout.css`, `common.css`
- 별도 생성 파일 `css/c24ai-theme.css`
- `SkinImg/c24ai/**`에 추가되는 브랜드 이미지

기존 상품 module 내부는 Presentation 영역에서도 교체하지 않습니다. 대신 바깥 래퍼와 CSS Grid/Flex 규칙을 변경합니다.

## 4. 배포 안전 규칙

1. 원본 소스를 먼저 읽고 버전 스냅샷을 저장합니다.
2. AI 결과는 `<!-- C24AI:START -->`와 `<!-- C24AI:END -->` 사이에만 기록합니다.
3. 배포 전 원본과 결과의 module, Cafe24 변수, 지시문, 커머스 form 요소를 multiset으로 대조합니다.
4. 보호 토큰의 추가·삭제·개수 변경이 하나라도 있으면 배포를 중단합니다.
5. AI HTML에서 `<script>`와 인라인 이벤트 핸들러를 차단합니다.
6. CSS에서 `@import`, `expression()`, `javascript:`, `behavior`, `-moz-binding`, HTML data URL을 차단합니다.
7. Theme API 배포 전 자동 백업을 만들고 실패하면 원본을 유지합니다.
8. Runtime 배포는 JS 로드·설정 조회·DOM 마운트가 모두 성공한 뒤에만 스타일을 삽입합니다. 어느 단계에서든 실패하면 Cafe24 원본 화면을 그대로 둡니다.
9. Cafe24가 서버에서 생성·관리하는 파일(`sitemap.xml`, `sitemap0.xml.temp`)은 원본 압축본에 들어 있어도 테마 패키지에서 제외합니다. 다른 몰의 URL이 담겨 있고 디자인FTP 쓰기 권한도 없습니다.

이 규칙은 [`lib/cafe24/protection.ts`](../lib/cafe24/protection.ts)와 테스트에서 실행 가능한 정책으로 고정되어 있습니다.

## 5. 원본 홈 구조

`index.html`은 다음 Presentation/Commerce 흐름으로 구성됩니다.

1. `custom_moduleedit_1` 기반 메인 비주얼
2. `custom_moduleedit_2~4` 컬렉션 배너
3. `product_listmain_1` 상품 그리드와 `product_listmore_1`
4. `product_listmain_2` 상품 슬라이드
5. `product_listmain_3~6` 탭형 세일 상품
6. 추가 배너·SNS 영역

AI는 1, 2, 배너·SNS 영역을 대체하거나 새로 설계할 수 있습니다. 3~5는 module 블록을 유지하면서 제목, 열 수, 카드 비율, 간격, 배경과 타이포그래피를 변경합니다.

## 6. Cafe24 API 제약

- OAuth 2.0으로 연결하며 디자인 조회, 디자인 쓰기, 애플리케이션 쓰기 권한을 분리합니다.
- Scripttag API는 일반 앱 권한으로 Runtime을 설치할 수 있습니다.
- Theme Pages 쓰기 API는 Cafe24가 승인한 특정 클라이언트만 사용할 수 있습니다. 승인 전에는 Runtime/Scripttag가 기본 배포 방식입니다.
- Theme API를 사용할 수 있어도 먼저 비대표 스킨에 배포하고 미리보기한 뒤 대표 디자인으로 전환하는 운영 방식을 권장합니다.

공식 참고: [Cafe24 OAuth](https://developers.cafe24.com/docs-new/docs/guide/oauth2-authentication), [디자인 파일 쓰기](https://developers.cafe24.com/docs-new/docs/admin/post-themes-by-skin-no-pages), [Scripttag API](https://developers.cafe24.com/docs/en/api/admin/?version=2022-09-01)
