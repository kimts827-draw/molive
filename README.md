# MOLIVE — AI Design Platform for Cafe24

프롬프트로 Cafe24 쇼핑몰 디자인을 만들고, 화면을 클릭해 수정한 뒤, Cafe24의 커머스 기능을 보존한 채 게시하는 SaaS의 초기 동작 버전입니다.

## 포함된 기능

- Instant의 제품 중심 정보 구조를 재해석한 SaaS 랜딩
- AI가 직접 만든 임의 HTML/CSS를 그대로 렌더링하는 Project Source
- `data-moire-id/type` 화면 선택 기반 비주얼 편집기
- 텍스트, 이미지 URL, 버튼, 정렬, 크기, 굵기, 섹션 배경·폭·여백 편집
- 섹션 순서 변경, 복제, 숨김, 삭제
- Undo/Redo, 수동 버전 저장과 복원
- 고정 섹션/Variant 없이 OpenAI가 전체 architecture와 HTML/CSS를 직접 생성
- 선택 node의 HTML/CSS 범위만 변경하는 AI 편집 API
- 개발 모드 OpenAI 요청·원본 응답·검증 결과 trace (`.moire/traces/`)
- Cafe24 보호 토큰 fingerprint validator
- Cafe24 OAuth, Runtime/Scripttag, 제한형 Theme Pages 배포
- Supabase RLS 스키마, 비공개 자격 증명 저장 구조
- Toss Payments 빌링키, 자동결제 Cron, 실패·해지·내역 구조

## 로컬 실행

```bash
npm install
npm run dev
```

`http://localhost:3000`에서 랜딩, `/editor`에서 편집기를 확인합니다. 비밀값은 커밋하지 말고 [`.env.example`](.env.example)의 이름만 기준으로 로컬/Vercel에 설정합니다.

영구 프로젝트 저장에는 다음 세 환경변수가 모두 필요합니다. 하나라도 없으면 프로덕션에서는 생성이 중단되고, 개발환경에서 세 값이 모두 없을 때만 화면에 명시된 메모리 데모 모드로 동작합니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` — 서버 전용이며 브라우저에 노출하면 안 됩니다.

원격 DB에는 `supabase db push` 후 `projects`, `site_versions`, `create_project_with_version`, `create_site_version_and_activate` 및 관련 RLS/GRANT가 적용됐는지 Supabase Dashboard 또는 migration 목록에서 직접 확인해야 합니다.

```bash
npm run typecheck
npm test
npm run build
```

## 실제 연동 전 필요한 작업

1. Supabase 프로젝트를 연결하고 `supabase db push`로 migration을 적용합니다. `project-assets`는 storefront 이미지 제공용 public bucket이며 업로드/변경은 사용자 UUID 폴더 RLS로 제한됩니다.
2. Supabase Auth의 Site URL을 실제 HTTPS origin으로 설정하고 Redirect URL에 `${NEXT_PUBLIC_APP_URL}/auth/callback`을 등록합니다.
3. Supabase Auth에서 Email/Password, Google, Kakao provider와 Manual Identity Linking을 활성화합니다. Google/Kakao의 provider callback은 Supabase Dashboard에 표시되는 `https://<project-ref>.supabase.co/auth/v1/callback`을 사용합니다.
4. 관리자 사용자는 별도 계정을 만들지 않고 Supabase 서버 관리 API에서 해당 사용자의 `app_metadata.role`을 `admin`으로 설정합니다. `user_metadata`나 `profiles`는 관리자 권한 판정에 사용하지 않습니다.
5. Cafe24 Developers에서 앱을 등록하고 OAuth Redirect URI를 `${NEXT_PUBLIC_APP_URL}/api/cafe24/oauth/callback`과 정확히 일치시킵니다.
6. Runtime 배포에는 `mall.read_application`, `mall.write_application` 권한이 필요합니다. 테마 직접 쓰기를 켤 때만 디자인 읽기/쓰기 권한을 추가합니다.
7. Cafe24 앱 API 버전은 현재 코드 기본값과 같은 `2026-03-01`로 설정합니다.
8. Theme Pages 쓰기 API 사용을 Cafe24 개발센터에 별도로 신청합니다.
9. Vercel의 Production 환경 변수에 필수값을 등록한 뒤 배포합니다.

## MOLIVE Installer

FileZilla 없이 테마를 Cafe24 디자인FTP의 스킨 폴더에 설치하는 데스크톱 앱은 [`installer/`](installer/README.md)에 있습니다. 웹앱과 의존성을 공유하지 않는 별도 Electron 프로젝트입니다.

웹의 Installer 다운로드는 EXE를 Next.js `public`에 넣지 않고 `/api/installer/download`가 외부 HTTPS 파일로 리디렉션합니다. 현재 배포 버전과 Setup EXE URL은 로컬/Vercel의 서버 환경변수로 관리합니다.

- `INSTALLER_VERSION=0.1.0`
- `INSTALLER_DOWNLOAD_URL=https://<storage-host>/<path>/MOLIVE-Installer-Setup-0.1.0.exe`

일반 사용자 UI에는 Setup EXE만 연결하며 portable 빌드는 노출하지 않습니다. 새 버전 배포 시 외부 Storage에 Setup EXE를 올리고 위 두 값만 갱신하면 됩니다.

구조와 제약은 [Cafe24 스킨 분석](docs/CAFE24_SKIN_ANALYSIS.md)과 [제품 아키텍처](docs/PRODUCT_ARCHITECTURE.md)에 정리되어 있습니다.
