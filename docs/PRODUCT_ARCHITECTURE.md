# Moiré 제품 아키텍처

## 제품 원칙

1. AI는 고정 분위기 템플릿을 선택하지 않고 브랜드 브리프에서 정보 구조와 아트 디렉션을 설계한다.
2. 사용자는 결과 화면에서 텍스트, 이미지, 버튼과 섹션을 직접 선택해 수정한다.
3. 상품, 회원, 장바구니, 주문과 결제는 Cafe24가 계속 담당한다.

## 시스템 경계

```text
브랜드 입력
  → AI Design Service (OpenAI Responses API)
  → Project Source (AI가 직접 설계한 HTML + CSS)
  ├─ Preview iframe (Project Source 그대로 렌더링)
  ├─ Visual Editor (node patch + Undo/Redo/Versions)
  └─ Cafe24 Publisher (동일 Project Source + 보호 모듈 mount)
      → Protection Layer (Cafe24 fingerprint validation)
  ├─ Runtime Adapter → Cafe24 Scripttag (기본, fail-safe)
  └─ Theme Adapter   → Cafe24 Theme Pages (별도 승인 후)

Supabase
  ├─ Auth / Projects / Versions / activeVersion / Installations
  ├─ private.cafe24_credentials (앱 암호화 토큰)
  └─ private.billing_credentials (앱 암호화 빌링키)

Toss Payments
  → 최초 카드 인증 → 빌링키 → 서버 스케줄 결제 → 실패/재시도/해지
```

AI 서비스와 Cafe24 배포 서비스는 데이터 계약만 공유하고 독립적으로 실패합니다. AI가 실패해도 기존 배포는 유지되고, Runtime이 실패해도 Cafe24 원본 HTML과 커머스 기능이 렌더링됩니다.

## 주요 런타임

- Next.js 16 App Router + TypeScript
- OpenAI Responses API + strict JSON Schema (`store: false`)
- Supabase Auth, Postgres, Storage, RLS
- Cafe24 OAuth 2.0, Themes API, Scripttag API
- Toss Payments 자동결제 API
- Vercel Functions + Cron

## 앱 구조

```text
app/
  page.tsx                         제품 랜딩
  editor/page.tsx                  비주얼 편집기
  api/ai/generate                  전체 디자인 생성
  api/ai/edit                      선택 영역 AI 편집
  api/cafe24/oauth/*               Cafe24 OAuth
  api/cafe24/deploy                Runtime/Theme 배포 어댑터
  api/projects/*                   Project Source 초안·버전·activeVersion
  api/runtime/[installationId]     fail-safe Runtime JS와 동적 설정
  api/billing/*                    빌링키, 해지, 스케줄 결제, 웹훅
components/editor/                 캔버스, 인스펙터, 기록 UI
lib/cafe24/                        보호 정책, Project Source 검사, API 클라이언트
lib/openai/                        디자인 생성·편집
lib/project-source.ts              생성·미리보기·배포의 단일 소스 계약
lib/billing/                       Toss Payments 서버 SDK
lib/supabase/                      브라우저/서버/관리자 클라이언트
supabase/migrations/               RLS 포함 데이터 모델
```

## 디자인 생성 계약

`ProjectSource` 하나가 생성·편집·미리보기·배포의 유일한 디자인 계약입니다.

- `html`: AI가 브랜드 브리프에서 직접 설계한 header/main/footer와 임의 섹션 구조
- `css`: `data-moire-root` 아래로 완전히 스코프된 실제 반응형 스타일
- `architecture`: header, hero, 섹션 순서, 상품 표현, 타이포그래피, footer에 대한 감사용 설명. 렌더러는 이 값을 사용하지 않습니다.
- `data-moire-id`, `data-moire-type`: 클릭 편집과 선택 범위 AI patch를 위한 노드 metadata
- `data-cafe24-slot="product-list"`: 보호된 Cafe24 상품 module을 연결하는 Presentation mount

Hero나 상품 그리드 같은 고정 Section enum, 공통 React 디자인 renderer, 별도 Cafe24 HTML compiler는 생성 중심에서 제거했습니다. 전체 생성은 실제 HTML/CSS를 반환하고, 클릭 편집은 선택 노드의 값/inline CSS만 변경합니다. AI 편집은 선택 루트 ID를 유지한 `outerHTML`과 해당 ID로 스코프된 CSS만 반환합니다.

개발 모드에서는 `.moire/traces/`에 실제 system/user prompt, OpenAI 원본 응답, 정규화 전후 HTML/CSS, validator 결과와 사용량을 저장합니다. 이미지 데이터와 API key는 trace에 저장하지 않습니다.

## 배포 방식

### Runtime/Scripttag — 기본

- AI 생성 직후 Project Source를 `projects.current_document`와 초기 `site_versions`에 함께 저장합니다.
- 버전 저장은 immutable `site_versions`를 만들고 `projects.current_version_id`를 원자적으로 전환합니다.
- Cafe24에는 installation별 작은 loader URL을 최초 한 번만 설치합니다.
- loader의 config는 배포 payload가 아니라 installation → project → current_version_id → site_versions 순서로 현재 Project Source를 조회합니다.
- 새 버전과 Rollback은 ScriptTag 재설치 없이 `current_version_id` 전환만으로 반영됩니다.
- loader는 1.8초 내 설정을 받지 못하면 아무 작업도 하지 않습니다.
- 홈에서 Project Source, CSS, 보호 상품 module mount가 모두 준비된 뒤 원본 화면을 숨깁니다.
- 중간 단계가 실패하면 이동한 module을 원위치시키고 Project Source를 제거합니다.
- Runtime 중지나 CDN 장애 시 Cafe24 원본이 그대로 노출됩니다.

### Theme Pages — 승인 후

- `CAFE24_THEME_WRITE_ENABLED=true`일 때만 활성화합니다.
- 원본 `index.html`을 조회합니다.
- C24AI 관리 영역만 교체합니다.
- module·변수·지시문·커머스 form 지문을 대조합니다.
- 검증된 CSS를 C24AI 관리 영역의 스코프된 `<style>`로 함께 기록해 별도 파일 생성 실패로 인한 부분 적용을 막습니다.

Cafe24의 Theme Pages 쓰기 API는 특정 클라이언트 승인이 필요하므로, 서비스 출시 전에 Cafe24 개발센터 승인을 받아야 합니다.

## 구독 결제

- 고객별 결정적 `customerKey`를 서버에서 생성합니다.
- 결제창 인증의 `authKey`로 빌링키를 발급합니다.
- 빌링키는 AES-256-GCM으로 암호화해 `private` 스키마에 저장합니다.
- Vercel Cron이 매일 결제 예정 구독을 처리합니다.
- 성공 시 다음 결제일과 결제 내역을 기록합니다.
- 실패 시 `past_due`, 실패 횟수, 3일 뒤 재시도를 기록합니다.
- 기간 종료 해지와 `BILLING_DELETED` 이벤트를 지원합니다.

토스 자동결제는 리스크 검토와 추가 계약 후 사용할 수 있습니다. 자동결제 승인 스케줄링은 서비스가 직접 담당합니다. 공식 참고: [자동결제 가이드](https://docs.tosspayments.com/guides/v2/billing)

## 데이터와 보안

- 공개 스키마 모든 테이블에 RLS를 활성화합니다.
- 2026년 Supabase Data API 기본 노출 변경에 대응해 필요한 `authenticated` 권한만 명시적으로 GRANT합니다.
- `service_role`, OpenAI 키, Cafe24 secret, Toss secret은 서버 전용입니다.
- Cafe24 access/refresh token과 Toss billing key는 `private` 스키마 + 앱 레벨 암호화를 함께 사용합니다.
- Storefront 이미지 제공용 `project-assets` bucket은 public read이고, 업로드·수정·삭제 경로의 첫 폴더는 `auth.uid()`로 제한합니다.
- AI 요청은 프로덕션에서 인증 사용자만 허용합니다. 공개 데모는 명시적인 `AI_DEMO_PUBLIC=true`일 때만 same-origin으로 엽니다.

## 구현 순서

1. 완료 — 기본 스킨 보호 경계 분석과 실행 가능한 validator
2. 완료 — 제품 랜딩과 비주얼 편집기 핵심 상호작용
3. 완료 — OpenAI 전체 생성·선택 영역 편집 API
4. 완료 — Cafe24 OAuth, Runtime, Theme 배포 어댑터 골격
5. 완료 — Supabase RLS 데이터 모델과 Toss 자동결제 골격
6. 진행 — Supabase/Vercel/Cafe24 실제 프로젝트 자격 증명 연결
7. 다음 — Cafe24 개발센터 Theme Pages 쓰기 권한 신청
8. 다음 — 실제 Cafe24 테스트 몰에서 상품 상세·장바구니·주문 전체 회귀 테스트
9. 다음 — 사용량 차감과 요금제 UI, 실제 Cafe24 테스트 몰 product slot 회귀 테스트
10. 진행 — Vercel Preview/Production 배포와 운영 알림
