import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { autosaveLabel } from "../lib/editor/autosave-state.ts";
import { generationDestination } from "../lib/projects/client-flow.ts";
import { didUpdateProject } from "../lib/projects/persistence.ts";
import { projectSourceSignature, type ProjectSource } from "../lib/project-source.ts";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("미로그인 AI 생성은 JSON 오류 화면 대신 기존 로그인/next 흐름으로 보낸다", () => {
  assert.deepEqual(generationDestination({ status: 401, persistenceEnabled: true }), {
    kind: "login",
    href: "/login?next=%2F",
  });
});

test("영구 저장 모드의 생성 결과에는 projectId가 반드시 필요하다", () => {
  assert.equal(generationDestination({ status: 200, projectId: "project-1", persistenceEnabled: true }).kind, "project");
  assert.equal(generationDestination({ status: 200, persistenceEnabled: true }).kind, "error");
  assert.equal(generationDestination({ status: 200, persistenceEnabled: false }).kind, "demo");
});

test("autosave 상태 문구는 저장 중/성공 시각/실패/데모를 구분한다", () => {
  assert.equal(autosaveLabel("saving", null), "저장 중...");
  assert.match(autosaveLabel("saved", "2026-08-24T01:32:00.000Z"), /^저장됨 · \d{2}:\d{2}$/);
  assert.equal(autosaveLabel("error", null), "저장 실패");
  assert.equal(autosaveLabel("demo", null), "개발 데모 · 저장 안 됨");
});

test("UPDATE 반환 행이 없으면 autosave 성공으로 판정하지 않는다", () => {
  assert.equal(didUpdateProject(null), false);
  assert.equal(didUpdateProject({}), false);
  assert.equal(didUpdateProject({ id: "project-1" }), true);
});

test("생성 RPC가 projects current_document와 최초 site_versions를 함께 만든다", async () => {
  const [migration, route] = await Promise.all([
    read("supabase/migrations/20260819090000_project_source_installations.sql"),
    read("app/api/ai/generate/route.ts"),
  ]);
  assert.match(migration, /create or replace function public\.create_project_with_version/);
  assert.match(migration, /insert into public\.projects \(owner_id, name, status, brand_brief, current_document\)/);
  assert.match(migration, /insert into public\.site_versions \(project_id, label, document_snapshot, source_snapshot, created_by\)/);
  assert.match(migration, /set current_version_id = created_version_id/);
  assert.match(route, /createProjectWithVersion\(user\.id, result\.source/);
  assert.match(route, /Response\.json\(\{ \.\.\.result, \.\.\.stored, balance \}\)/);
});

test("내 디자인은 로그인 사용자의 프로젝트만 최근 수정순으로 열어 준다", async () => {
  const [page, service] = await Promise.all([
    read("app/projects/page.tsx"),
    read("lib/projects/service.ts"),
  ]);
  assert.match(page, /if \(!user\) redirect\("\/login\?next=%2Fprojects"\)/);
  assert.match(page, /href=\{`\/editor\?project=\$\{encodeURIComponent\(project\.id\)\}`\}/);
  assert.match(service, /\.eq\("owner_id", ownerId\)\s*\.order\("updated_at", \{ ascending: false \}\)/);
});

test("Editor autosave와 0행 404 처리 경로가 실제 API에 연결돼 있다", async () => {
  const [editor, route, service] = await Promise.all([
    read("components/editor/editor-shell.tsx"),
    read("app/api/projects/[projectId]/route.ts"),
    read("lib/projects/service.ts"),
  ]);
  assert.match(editor, /setTimeout\(async \(\) => \{/);
  assert.match(editor, /}, 900\)/);
  assert.match(editor, /method: "PATCH"/);
  assert.match(service, /\.select\("id"\)\s*\.maybeSingle\(\)/);
  assert.match(route, /if \(!saved\) throw new ApiError\(404/);
});

test("버전 저장과 복구는 site_versions 및 projects current_document를 유지한다", async () => {
  const [migration, editor] = await Promise.all([
    read("supabase/migrations/20260819090000_project_source_installations.sql"),
    read("components/editor/editor-shell.tsx"),
  ]);
  assert.match(migration, /create or replace function public\.create_site_version_and_activate/);
  assert.match(migration, /set current_document = p_source,[\s\S]*current_version_id = created_version_id/);
  assert.match(editor, /\/versions\/\$\{version\.id\}\/activate/);
  assert.match(editor, /commit\(cloneProjectSource\(payload\.source\)\)/);
});


const exportSource: ProjectSource = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "MOLIVE 테스트",
  html: '<div data-moire-root="moire-test"><main><section data-moire-id="s1" data-moire-type="section"><div data-cafe24-slot="product-list"></div></section></main></div>',
  css: '[data-moire-root="moire-test"] section{padding:80px}',
  architecture: { header: "split-utility", hero: "full-bleed", sections: ["featuredProducts/heading-more — 진열"], productPresentation: "grid-four", typography: "sans", footer: "quiet" },
  updatedAt: "2026-08-30T00:00:00.000Z",
};

test("Export 서명은 저장 시각과 키 순서를 무시하고 실제 내용만 비교한다", () => {
  // 편집이 없어도 updatedAt은 매번 바뀝니다. 이것까지 비교하면 같은 디자인에 버전이 무한히 쌓입니다.
  assert.equal(
    projectSourceSignature(exportSource),
    projectSourceSignature({ ...exportSource, updatedAt: "2026-09-01T09:00:00.000Z" }),
  );
  const reordered = { updatedAt: exportSource.updatedAt, architecture: exportSource.architecture, css: exportSource.css, html: exportSource.html, name: exportSource.name, id: exportSource.id } as ProjectSource;
  assert.equal(projectSourceSignature(exportSource), projectSourceSignature(reordered));
  // 실제 편집은 반드시 다른 서명이 됩니다.
  assert.notEqual(projectSourceSignature(exportSource), projectSourceSignature({ ...exportSource, html: `${exportSource.html}<!-- edit -->` }));
  assert.notEqual(projectSourceSignature(exportSource), projectSourceSignature({ ...exportSource, css: `${exportSource.css}\n[data-moire-root="moire-test"] h2{color:red}` }));
  assert.notEqual(projectSourceSignature(exportSource), projectSourceSignature({ ...exportSource, headerTextTone: "light" }));
});

test("ZIP과 게시는 버전 저장 없이도 Editor의 현재 문서를 그대로 내보낸다", async () => {
  const [service, themePackage, deploy, publish, editor] = await Promise.all([
    read("lib/projects/service.ts"),
    read("app/api/cafe24/theme-package/route.ts"),
    read("app/api/cafe24/deploy/route.ts"),
    read("components/editor/publish-modal.tsx"),
    read("components/editor/editor-shell.tsx"),
  ]);
  // 현재 문서와 activeVersion이 다르면 내보내기 직전에 현재 문서를 새 버전으로 승격시킵니다.
  assert.match(service, /export async function resolveExportVersion/);
  assert.match(service, /projectSourceSignature\(active\.source\) === projectSourceSignature\(project\.source\)/);
  assert.match(service, /return \{ versionId: active\.id, source: active\.source, createdVersion: false \}/);
  assert.match(service, /const versionId = await createVersion\(projectId, ownerId, label, project\.source\)/);

  // 두 출구 모두 activeVersion 스냅샷을 직접 읽지 않고 이 경로만 씁니다.
  for (const route of [themePackage, deploy]) {
    assert.match(route, /await resolveExportVersion\(/);
    assert.equal(/먼저 버전을 저장하세요/.test(route), false);
    assert.equal(/project\.versions\.find/.test(route), false);
  }
  assert.match(deploy, /version_id: activeVersion\.versionId/);

  // 저장 debounce가 남아 있으면 내려받기 전에 먼저 flush합니다.
  assert.match(publish, /const saved = await onFlushDraft\(\);/);
  assert.match(publish, /if \(!saved\) \{[\s\S]*return;/);
  assert.match(publish, /window\.location\.href = `\/api\/cafe24\/theme-package/);
  assert.match(editor, /const flushDraft = useCallback\(async \(\) => \{/);
  assert.match(editor, /onFlushDraft=\{flushDraft\}/);
});
