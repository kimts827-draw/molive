import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { RESOURCE_BOARDS } from "../lib/resources/board.ts";

const landing = await readFile(new URL("../components/landing/landing-page.tsx", import.meta.url), "utf8");
const siteHeader = await readFile(new URL("../components/site/site-header.tsx", import.meta.url), "utf8");
const dropdown = await readFile(new URL("../components/resources/resource-dropdown.tsx", import.meta.url), "utf8");
const dropdownStyles = await readFile(new URL("../components/resources/resource-dropdown.module.css", import.meta.url), "utf8");
const globalStyles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("Header는 가격·사용 방법·문의를 유지하고 Desktop/Mobile 자료실 메뉴를 제공한다", () => {
  assert.match(landing, /<SiteHeader[^>]*priceHref="#price"/);
  assert.match(siteHeader, /<Link href=\{priceHref\}>가격<\/Link><Link href="\/guide">사용 방법<\/Link><Link href="\/contact">문의<\/Link><ResourceDropdown \/>/);
  assert.match(siteHeader, /<ResourceDropdown mobile \/>/);
  assert.match(dropdown, /RESOURCE_BOARDS\.map/);
});

test("자료실 메뉴는 공지사항·템플릿·블로그·자료모음 순서의 같은 계층 route로 구성된다", () => {
  assert.deepEqual(
    RESOURCE_BOARDS.map((board) => [board.key, board.label, board.href]),
    [
      ["notice", "공지사항", "/notice"],
      ["template", "템플릿", "/templates"],
      ["blog", "블로그", "/blog"],
      ["resource", "자료모음", "/resources"],
    ],
  );
});

test("자료실 dropdown은 hover·focus·click·바깥 클릭·ESC 접근을 지원한다", () => {
  assert.match(dropdown, /onMouseEnter/);
  assert.match(dropdown, /onMouseLeave/);
  assert.match(dropdown, /onFocus/);
  assert.match(dropdown, /onBlur/);
  assert.match(dropdown, /aria-expanded=\{open\}/);
  assert.match(dropdown, /document\.addEventListener\("pointerdown"/);
  assert.match(dropdown, /event\.key !== "Escape"/);
  assert.match(dropdown, /mobile \? !current : true/);
  assert.match(dropdownStyles, /@media \(max-width: 980px\)/);
  assert.match(dropdownStyles, /\.mobileRoot \{ display: none; \}/);
});

test("자료실 네 게시판은 게시글이 없을 때 요청된 빈 상태 문구를 제공한다", () => {
  assert.deepEqual(RESOURCE_BOARDS.map((board) => board.empty), [
    "아직 등록된 공지사항이 없습니다.",
    "아직 등록된 템플릿이 없습니다.",
    "Cafe24와 작은 쇼핑몰 운영에 도움이 되는 글을 준비하고 있습니다.",
    "쇼핑몰 운영에 바로 사용할 수 있는 자료를 준비하고 있습니다.",
  ]);
});

test("자료실 목록/상세/작성 화면은 각 게시판의 같은 계층에 존재한다", async () => {
  for (const dir of ["notice", "blog", "resources"]) {
    for (const file of ["page.tsx", "new/page.tsx", "[postId]/page.tsx", "[postId]/edit/page.tsx"]) {
      await readFile(new URL(`../app/${dir}/${file}`, import.meta.url), "utf8");
    }
  }
  for (const file of ["page.tsx", "new/page.tsx", "[postId]/edit/page.tsx"]) {
    await readFile(new URL(`../app/templates/${file}`, import.meta.url), "utf8");
  }
  await assert.rejects(() => readFile(new URL("../app/resources/templates/page.tsx", import.meta.url), "utf8"));
});

test("사용 방법 페이지는 기존 구조를 유지하며 sans-serif만 사용한다", () => {
  const guideBlock = globalStyles.slice(globalStyles.indexOf("/* Installer guide */"), globalStyles.indexOf("/* Production authentication boundary */"));
  assert.match(guideBlock, /\.guide-page[^}]*font-family:[^}]*sans-serif/);
  assert.doesNotMatch(guideBlock, /Georgia|Times New Roman|(?:^|[^-])serif\b/);
  assert.match(guideBlock, /\.guide-hero h1 em[^}]*font-family: inherit/);
});
