import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const landing = await readFile(new URL("../components/landing/landing-page.tsx", import.meta.url), "utf8");
const siteHeader = await readFile(new URL("../components/site/site-header.tsx", import.meta.url), "utf8");
const dropdown = await readFile(new URL("../components/resources/resource-dropdown.tsx", import.meta.url), "utf8");
const dropdownStyles = await readFile(new URL("../components/resources/resource-dropdown.module.css", import.meta.url), "utf8");
const globalStyles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("Header는 가격·사용 방법을 유지하고 Desktop/Mobile 자료실 메뉴를 제공한다", () => {
  assert.match(landing, /<SiteHeader[^>]*priceHref="#price"/);
  assert.match(siteHeader, /<Link href=\{priceHref\}>가격<\/Link><Link href="\/guide">사용 방법<\/Link><ResourceDropdown \/>/);
  assert.match(siteHeader, /<ResourceDropdown mobile \/>/);
  for (const [title, description, href] of [
    ["공지사항", "MOLIVE 업데이트와 주요 안내", "/notice"],
    ["블로그", "Cafe24와 소규모 쇼핑몰 운영에 도움되는 글", "/blog"],
    ["자료모음", "운영에 바로 쓰는 체크리스트와 자료", "/resources"],
  ]) {
    assert.match(dropdown, new RegExp(`href: "${href}"`));
    assert.match(dropdown, new RegExp(`title: "${title}"`));
    assert.match(dropdown, new RegExp(`description: "${description}"`));
  }
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

test("자료실 세 경로는 요청된 빈 상태를 제공한다", async () => {
  const pages = await Promise.all([
    readFile(new URL("../app/notice/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/blog/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/resources/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(pages[0], /아직 등록된 공지사항이 없습니다\./);
  assert.match(pages[1], /Cafe24와 작은 쇼핑몰 운영에 도움이 되는 글을 준비하고 있습니다\./);
  assert.match(pages[2], /쇼핑몰 운영에 바로 사용할 수 있는 자료를 준비하고 있습니다\./);
});

test("사용 방법 페이지는 기존 구조를 유지하며 sans-serif만 사용한다", () => {
  const guideBlock = globalStyles.slice(globalStyles.indexOf("/* Installer guide */"), globalStyles.indexOf("/* Production authentication boundary */"));
  assert.match(guideBlock, /\.guide-page[^}]*font-family:[^}]*sans-serif/);
  assert.doesNotMatch(guideBlock, /Georgia|Times New Roman|(?:^|[^-])serif\b/);
  assert.match(guideBlock, /\.guide-hero h1 em[^}]*font-family: inherit/);
});
