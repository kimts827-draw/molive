import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { RESOURCE_ADMIN_EMAIL, isResourceAdminEmail } from "../lib/auth/roles.ts";
import { RESOURCE_BOARDS, isResourceBoardKey, resourceBoard } from "../lib/resources/board.ts";
import { resourcePostSchema } from "../lib/resources/schema.ts";

const migration = await readFile(new URL("../supabase/migrations/20260829090000_resource_posts.sql", import.meta.url), "utf8");
const adminAuth = await readFile(new URL("../lib/admin/auth.ts", import.meta.url), "utf8");
const collectionRoute = await readFile(new URL("../app/api/resources/[board]/route.ts", import.meta.url), "utf8");
const itemRoute = await readFile(new URL("../app/api/resources/[board]/[postId]/route.ts", import.meta.url), "utf8");
const boardPage = await readFile(new URL("../components/resources/resource-board-page.tsx", import.meta.url), "utf8");
const templateBoard = await readFile(new URL("../components/resources/template-board.tsx", import.meta.url), "utf8");

test("자료실 관리자 계정은 지정된 이메일 하나뿐이다", () => {
  assert.equal(RESOURCE_ADMIN_EMAIL, "kimts8270@naver.com");
  assert.equal(isResourceAdminEmail("kimts8270@naver.com"), true);
  assert.equal(isResourceAdminEmail("  KimTS8270@Naver.com "), true);
  for (const other of ["kimts827@gmail.com", "kimts8270@naver.com.attacker.com", "", null, undefined]) {
    assert.equal(isResourceAdminEmail(other), false);
  }
});

test("게시판 key는 네 종류만 허용한다", () => {
  for (const board of RESOURCE_BOARDS) assert.equal(isResourceBoardKey(board.key), true);
  for (const bogus of ["templates", "admin", "", "notice "]) assert.equal(isResourceBoardKey(bogus), false);
  assert.equal(resourceBoard("template").href, "/templates");
});

test("mutation API는 요청마다 실제 Supabase 세션의 관리자 이메일을 검증한다", () => {
  assert.match(adminAuth, /export async function requireResourceAdminApi\(\)/);
  assert.match(adminAuth, /const user = await getCurrentUser\(\);/);
  assert.match(adminAuth, /if \(!user\) throw new ApiError\(401/);
  assert.match(adminAuth, /if \(!isResourceAdminEmail\(user\.email\)\) throw new ApiError\(403/);
  // requireApiUser의 개발/데모 우회 경로를 자료실 mutation에 재사용하지 않는다.
  assert.doesNotMatch(adminAuth.slice(adminAuth.indexOf("requireResourceAdminApi")), /requireApiUser/);

  assert.match(collectionRoute, /export async function POST/);
  assert.match(collectionRoute, /await requireResourceAdminApi\(\)/);
  for (const method of ["PATCH", "DELETE"]) {
    assert.match(itemRoute, new RegExp(`export async function ${method}`));
  }
  assert.equal((itemRoute.match(/await requireResourceAdminApi\(\)/g) ?? []).length, 2);
  // 인증이 스키마 파싱보다 먼저 실행되어야 한다.
  assert.ok(collectionRoute.indexOf("requireResourceAdminApi") < collectionRoute.indexOf("resourcePostSchema(board).parse"));
});

test("페이지는 관리자에게만 글쓰기·수정 UI를 노출한다", () => {
  assert.match(boardPage, /canManage \? <div className=\{styles\.adminBar\}/);
  assert.match(boardPage, /글쓰기/);
  assert.match(boardPage, /canManage \? <div className=\{styles\.itemActions\}/);
  assert.match(templateBoard, /canManage \? <div className=\{boardStyles\.adminBar\}/);
  assert.match(templateBoard, /canManage \? <div className=\{styles\.manage\}/);
});

test("resource_posts RLS는 열람만 공개하고 쓰기는 관리자 이메일로 제한한다", () => {
  assert.match(migration, /alter table public\.resource_posts enable row level security;/);
  assert.match(migration, /revoke all on table public\.resource_posts from public, anon, authenticated;/);
  assert.match(migration, /grant select on table public\.resource_posts to anon, authenticated;/);
  assert.match(migration, /create policy resource_posts_select_public[\s\S]*?using \(true\);/);
  for (const action of ["insert", "update", "delete"]) {
    assert.match(migration, new RegExp(`create policy resource_posts_${action}_admin`));
  }
  assert.equal((migration.match(/= 'kimts8270@naver\.com'/g) ?? []).length, 4);
  assert.doesNotMatch(migration, /grant (insert|update|delete)[^;]*to anon/);
});

test("템플릿 게시글 스키마는 이미지·카테고리·브랜드 컬러·프롬프트를 요구한다", () => {
  const schema = resourcePostSchema("template");
  const valid = {
    title: "포근한 베이비 라이프",
    summary: "포근하고 부드러운 분위기",
    category: "유아동 / 베이비",
    brandColor: "#D8C3A9",
    prompt: "따뜻한 크림색 베이비 쇼핑몰을 만들어줘.",
    imageUrl: "/templates/baby.png",
  };
  assert.equal(schema.safeParse(valid).success, true);
  assert.equal(schema.safeParse({ ...valid, brandColor: "beige" }).success, false);
  assert.equal(schema.safeParse({ ...valid, imageUrl: "javascript:alert(1)" }).success, false);
  assert.equal(schema.safeParse({ ...valid, imageUrl: "http://insecure.example.com/a.png" }).success, false);
  for (const key of ["category", "brandColor", "prompt", "imageUrl"]) {
    assert.equal(schema.safeParse({ ...valid, [key]: undefined }).success, false);
  }
});

test("공지사항·블로그·자료모음 게시글 스키마는 제목과 본문을 요구한다", () => {
  for (const board of ["notice", "blog", "resource"] as const) {
    const schema = resourcePostSchema(board);
    assert.equal(schema.safeParse({ title: "제목", content: "본문" }).success, true);
    assert.equal(schema.safeParse({ title: "", content: "본문" }).success, false);
    assert.equal(schema.safeParse({ title: "제목", content: "" }).success, false);
  }
});
