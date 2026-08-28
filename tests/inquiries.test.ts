import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { INQUIRY_CATEGORIES, INQUIRY_STATUS_LABELS } from "../lib/inquiries/config.ts";

const migration = await readFile(new URL("../supabase/migrations/20260828041137_inquiries.sql", import.meta.url), "utf8");
const publicRoute = await readFile(new URL("../app/api/inquiries/route.ts", import.meta.url), "utf8");
const adminRoute = await readFile(new URL("../app/api/admin/inquiries/[inquiryId]/route.ts", import.meta.url), "utf8");
const contactPage = await readFile(new URL("../app/contact/page.tsx", import.meta.url), "utf8");
const contactForm = await readFile(new URL("../components/contact/contact-form.tsx", import.meta.url), "utf8");
const contactDirect = await readFile(new URL("../components/contact/contact-direct.tsx", import.meta.url), "utf8");
const adminPage = await readFile(new URL("../app/admin/inquiries/page.tsx", import.meta.url), "utf8");

test("문의 유형과 상태 값이 고정된다", () => {
  assert.deepEqual(INQUIRY_CATEGORIES.map(({ value, label }) => ({ value, label })), [
    { value: "service", label: "서비스 문의" },
    { value: "billing", label: "결제·Credit" },
    { value: "bug", label: "오류 신고" },
    { value: "feature", label: "기능 건의" },
    { value: "other", label: "기타" },
  ]);
  assert.deepEqual(INQUIRY_STATUS_LABELS, { pending: "답변 대기", resolved: "처리 완료" });
});

test("익명과 로그인 사용자는 문의 작성만 가능하고 다른 문의를 조회할 수 없다", () => {
  assert.match(migration, /alter table public\.inquiries enable row level security/);
  assert.match(migration, /grant insert \(user_id, email, category, subject, content\).*to anon, authenticated/);
  assert.match(migration, /inquiries_insert_anonymous[\s\S]*user_id is null[\s\S]*status = 'pending'/);
  assert.match(migration, /inquiries_insert_authenticated[\s\S]*auth\.uid\(\)\) = user_id[\s\S]*status = 'pending'/);
  assert.doesNotMatch(migration, /for select\s+to anon/);
  assert.match(migration, /inquiries_select_admin[\s\S]*app_metadata[\s\S]*role[\s\S]*admin/);
  assert.match(migration, /grant update \(status\).*to authenticated/);
});

test("공개 문의 API가 현재 세션 사용자만 연결하고 성공 문구를 반환한다", () => {
  assert.match(publicRoute, /supabase\.auth\.getUser\(\)/);
  assert.match(publicRoute, /user_id: user\?\.id \?\? null/);
  assert.match(publicRoute, /문의가 접수되었습니다\./);
  assert.doesNotMatch(publicRoute, /createAdminClient/);
});

test("문의 화면과 관리자 흐름이 요구된 기능만 제공한다", () => {
  assert.match(contactPage, /무엇을 도와드릴까요\?/);
  assert.match(contactPage, /<ContactDirect \/>/);
  assert.match(contactForm, /initialEmail/);
  assert.match(contactForm, /문의가 접수되었습니다\./);
  assert.match(adminRoute, /requireAdminApi\(request\)/);
  assert.match(adminRoute, /z\.enum\(\["pending", "resolved"\]\)/);
  assert.match(adminPage, /mailto:/);
  assert.match(adminPage, /selected\.content/);
});

test("직접 문의 영역은 mailto와 클립보드 복사를 함께 제공한다", () => {
  assert.match(contactPage, /<ContactDirect \/>/);
  assert.match(contactDirect, /DIRECT_CONTACT_EMAIL = "kimts827@gmail\.com"/);
  assert.match(contactDirect, /navigator\.clipboard\.writeText\(DIRECT_CONTACT_EMAIL\)/);
  assert.match(contactDirect, /이메일 주소가 복사되었습니다\./);
  assert.match(contactDirect, /표시된 이메일 주소를 직접 복사해 주세요\./);
  assert.match(contactDirect, /href=\{`mailto:\$\{DIRECT_CONTACT_EMAIL\}`\}/);
  assert.match(contactDirect, /이메일 주소 복사/);
});
