import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const legalDocument = await readFile(new URL("../components/legal/legal-document.tsx", import.meta.url), "utf8");
const landing = await readFile(new URL("../components/landing/landing-page.tsx", import.meta.url), "utf8");
const footer = await readFile(new URL("../components/site/site-footer.tsx", import.meta.url), "utf8");
const siteInfo = await readFile(new URL("../lib/site-info.ts", import.meta.url), "utf8");

test("세 정책 경로는 content/legal 원문을 공통 문서 화면으로 렌더링한다", async () => {
  for (const document of ["terms", "privacy", "refund"] as const) {
    const page = await readFile(new URL(`../app/${document}/page.tsx`, import.meta.url), "utf8");
    assert.match(page, new RegExp(`document="${document}"`));
    assert.match(page, new RegExp(`pathname="/${document}"`));
  }
  for (const filename of ["terms.md", "privacy.md", "refund.md"]) assert.match(legalDocument, new RegExp(`content", "legal", "${filename}`));
  assert.match(legalDocument, /readLegalSource\(document\)/);
  assert.match(legalDocument, /source\.replace\(\/<!--\[\^\]\*\?-->\/g, ""\)/);
  assert.match(legalDocument, /<SiteHeader/);
  assert.match(legalDocument, /<SiteFooter/);
});

test("Footer 정책 링크는 실제 내부 경로를 사용하고 준비 중 표시를 제거한다", () => {
  for (const [label, href] of [["이용약관", "/terms"], ["개인정보처리방침", "/privacy"], ["결제/환불 안내", "/refund"]]) {
    assert.match(siteInfo, new RegExp(`label: "${label}", href: "${href}"`));
  }
  assert.doesNotMatch(footer, /준비 중/);
  assert.match(landing, /<SiteFooter \/>/);
  assert.match(landing, /<SiteHeader/);
});

test("사업자 고객문의 전화는 공통 설정에서 Footer와 정책 문서에 제공한다", async () => {
  assert.match(siteInfo, /supportPhone: "010-5105-8033"/);
  assert.match(siteInfo, /MOLIVE_SUPPORT_PHONE/);
  assert.match(footer, /siteInfo\.business\.supportPhone/);
  assert.match(footer, /href=\{`tel:/);
  assert.match(legalDocument, /applyBusinessInfo/);

  for (const filename of ["terms.md", "privacy.md", "refund.md"]) {
    const source = await readFile(new URL(`../content/legal/${filename}`, import.meta.url), "utf8");
    assert.match(source, /\{\{supportPhone\}\}/);
    assert.doesNotMatch(source, /010-5105-8033/);
  }
});
