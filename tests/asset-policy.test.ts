import assert from "node:assert/strict";
import test from "node:test";
import {
  auditAssetReferenceTokens,
  auditGeneratedAssets,
  buildAssetSessionPath,
  buildProjectAssetPath,
  createAssetAllowlist,
  isAssetSessionPath,
  isProjectAssetPath,
  managedAssetStoragePath,
  validateAttachmentScope,
} from "../lib/assets/asset-policy.ts";
import { renderProductSectionV1 } from "../lib/component-library/components/product-section-v1.ts";
import { renderProductCardV1 } from "../lib/component-library/components/product-card-v1.ts";
import { productGridV1Definition } from "../lib/component-library/components/product-grid-v1.ts";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER_OWNER = "99999999-9999-4999-8999-999999999999";
const SESSION = "22222222-2222-4222-8222-222222222222";
const OLD_SESSION = "33333333-3333-4333-8333-333333333333";
const PROJECT = "44444444-4444-4444-8444-444444444444";
const OLD_PROJECT = "55555555-5555-4555-8555-555555555555";

function publicUrl(storagePath: string) {
  return `https://demo.supabase.co/storage/v1/object/public/project-assets/${storagePath}`;
}

const sessionAsset = publicUrl(buildAssetSessionPath(OWNER, SESSION, "image", "a1"));
const previousProjectAsset = publicUrl(buildProjectAssetPath(OWNER, OLD_PROJECT, "image", "b2"));
const previousSessionAsset = publicUrl(buildAssetSessionPath(OWNER, OLD_SESSION, "image", "c3"));

function page(body: string) {
  return `<div data-moire-root="scope-test"><main>
  <section data-moire-id="hero" data-moire-type="hero">${body}</section>
  <section data-moire-id="products" data-moire-type="products"><h2>상품</h2><div data-cafe24-slot="product-list"></div></section>
</main></div>`;
}

test("이전 프로젝트에 저장된 이미지는 같은 계정이라도 생성 결과에서 거부된다", () => {
  const allowlist = createAssetAllowlist({ attachments: [sessionAsset] });
  const violations = auditGeneratedAssets({ html: page(`<img src="${previousProjectAsset}" alt="">`), css: "" }, allowlist);
  assert.deepEqual(violations.map((item) => item.code), ["FOREIGN_ASSET"]);
});

test("이전 이미지 세션의 첨부도 새 생성에서는 자동 재사용되지 않는다", () => {
  const allowlist = createAssetAllowlist({ attachments: [sessionAsset] });
  const violations = auditGeneratedAssets({ html: page(""), css: `[data-moire-root="scope-test"] .mood{background-image:url("${previousSessionAsset}")}` }, allowlist);
  assert.deepEqual(violations.map((item) => item.code), ["FOREIGN_ASSET"]);
});

test("이번 요청 첨부·현재 프로젝트 자산·이번 생성에서 만든 이미지는 통과한다", () => {
  const projectAsset = publicUrl(buildProjectAssetPath(OWNER, PROJECT, "logo", "d4"));
  const allowlist = createAssetAllowlist({ attachments: [sessionAsset], projectAssets: [projectAsset], generated: ["https://demo.supabase.co/storage/v1/object/public/project-assets/generated/e5.webp"] });
  const html = page(`<img src="${sessionAsset}" alt=""><img src="${projectAsset}" alt=""><img src="data:image/svg+xml;utf8,%3Csvg%2F%3E" alt="">`);
  const css = `[data-moire-root="scope-test"] .mark{background-image:url(https://demo.supabase.co/storage/v1/object/public/project-assets/generated/e5.webp)}`;
  assert.deepEqual(auditGeneratedAssets({ html, css }, allowlist), []);
});

test("상품 영역 안의 이미지는 첨부든 스톡이든 전부 거부된다", () => {
  const allowlist = createAssetAllowlist({ attachments: [sessionAsset] });
  const html = `<div data-moire-root="scope-test"><main>
  <section data-moire-id="products" data-moire-type="products">
    <img src="${sessionAsset}" alt="">
    <img src="https://images.unsplash.com/photo-1?auto=format" alt="">
    <div data-cafe24-slot="product-list"></div>
  </section>
</main></div>`;
  const violations = auditGeneratedAssets({ html, css: "" }, allowlist);
  assert.deepEqual(violations.map((item) => item.code), ["PRODUCT_AREA_IMAGE", "PRODUCT_AREA_IMAGE"]);
});

test("브랜드/무드 섹션의 신규 스톡 이미지는 허용하고 상품 영역 규칙과 분리된다", () => {
  const allowlist = createAssetAllowlist({});
  const stock = "https://images.unsplash.com/photo-2?auto=format&fit=crop&w=1600&q=80";
  assert.deepEqual(auditGeneratedAssets({ html: page(`<img src="${stock}" alt="">`), css: "" }, allowlist), []);
  const strict = auditGeneratedAssets({ html: page(`<img src="${stock}" alt="">`), css: "" }, allowlist, { allowFreshStock: false });
  assert.deepEqual(strict.map((item) => item.code), ["FOREIGN_ASSET"]);
});

test("존재하지 않는 첨부 참조는 빈 src로 새지 않고 위반으로 잡힌다", () => {
  const violations = auditAssetReferenceTokens({ html: '<img src="asset://0"><img src="asset://3">', css: "" }, 1);
  assert.deepEqual(violations.map((item) => item.token), ["asset://3"]);
});

test("업로드 경로는 이미지 세션과 프로젝트 단위로 갈라진다", () => {
  const sessionPath = buildAssetSessionPath(OWNER, SESSION, "logo", "f6");
  assert.ok(isAssetSessionPath(sessionPath, OWNER, SESSION));
  assert.ok(!isAssetSessionPath(sessionPath, OWNER, OLD_SESSION));
  assert.ok(!isAssetSessionPath(sessionPath, OTHER_OWNER, SESSION));
  const projectPath = buildProjectAssetPath(OWNER, PROJECT, "image", "g7");
  assert.ok(isProjectAssetPath(projectPath, OWNER, PROJECT));
  assert.ok(!isProjectAssetPath(projectPath, OWNER, OLD_PROJECT));
  assert.equal(managedAssetStoragePath(publicUrl(projectPath)), projectPath);
  assert.equal(managedAssetStoragePath("https://images.unsplash.com/photo-3"), null);
});

test("생성 요청 첨부는 이번 이미지 세션 안의 것만 받는다", () => {
  assert.deepEqual(validateAttachmentScope({ ownerId: OWNER, sessionId: SESSION, assetUrls: [sessionAsset], assetPaths: [buildAssetSessionPath(OWNER, SESSION, "image", "a1")] }), { ok: true });
  assert.deepEqual(validateAttachmentScope({ ownerId: OWNER, assetUrls: [], assetPaths: [] }), { ok: true });

  const previousProject = validateAttachmentScope({ ownerId: OWNER, sessionId: SESSION, assetUrls: [previousProjectAsset], assetPaths: [] });
  assert.equal(previousProject.ok, false);

  const previousSession = validateAttachmentScope({ ownerId: OWNER, sessionId: SESSION, assetUrls: [], assetPaths: [buildAssetSessionPath(OWNER, OLD_SESSION, "image", "c3")] });
  assert.equal(previousSession.ok, false);

  const noSession = validateAttachmentScope({ ownerId: OWNER, assetUrls: [sessionAsset], assetPaths: [] });
  assert.equal(noSession.ok, false);
});

test("상품 카드 Preview는 업종 신호가 있는 사진 대신 코드가 그린 자리표시자만 쓴다", () => {
  const previewSources = [renderProductCardV1("preview", 0), renderProductSectionV1("preview"), productGridV1Definition.render("preview")];
  for (const html of previewSources) {
    assert.ok(!/unsplash|https?:\/\//i.test(html.match(/<img[^>]*>/i)?.[0] ?? ""), html.slice(0, 160));
    for (const match of html.matchAll(/<img\b[^>]*\bsrc\s*=\s*"([^"]*)"/gi)) {
      assert.match(match[1], /^data:image\/svg\+xml/);
    }
  }
});
