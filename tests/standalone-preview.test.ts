import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Editor는 저장된 프로젝트의 standalone preview를 새 창으로 연다", async () => {
  const [editor, css] = await Promise.all([
    read("components/editor/editor-shell.tsx"),
    read("app/editor/editor.css"),
  ]);
  assert.match(editor, /href=\{`\/preview\/\$\{encodeURIComponent\(projectId\)\}`\}/);
  assert.match(editor, /target="_blank" rel="noopener noreferrer"/);
  assert.match(editor, /새 창에서 전체 보기/);
  assert.match(css, /\.standalone-preview-button/);
});

test("standalone preview는 소유권 확인 후 Editor Preview HTML을 그대로 반환한다", async () => {
  const [route, proxy] = await Promise.all([
    read("app/preview/[projectId]/route.ts"),
    read("proxy.ts"),
  ]);
  assert.match(route, /getCurrentUser\(\)/);
  assert.match(route, /loadProject\(projectId, user\.id\)/);
  assert.match(route, /buildEditorPreviewDocument\(project\.source\)/);
  assert.match(route, /new Response\(preview\.srcDoc/);
  assert.match(route, /text\/html; charset=utf-8/);
  assert.match(route, /private, no-store/);
  assert.match(route, /noindex, nofollow, noarchive/);
  assert.doesNotMatch(route, /theme-package|installer|cafe24/i);
  assert.match(proxy, /"\/preview\/:path\*"/);
});
