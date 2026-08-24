import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { applyGeneratedPreviewPhotos, buildPreviewImagePrompt, previewPhotoTargets } from "../lib/openai/preview-image-contract.ts";
import { resolvePreviewProducts, type PreviewProductMock } from "../lib/component-library/preview-mock.ts";
import { renderProductCardV1 } from "../lib/component-library/components/product-card-v1.ts";
import { renderProductSectionV1 } from "../lib/component-library/components/product-section-v1.ts";
import { buildAssetSessionPath } from "../lib/assets/asset-policy.ts";
import { usageEventFromImageResponse } from "../lib/openai/usage.ts";

const OWNER = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
const publicUrl = (storagePath: string) => `https://demo.supabase.co/storage/v1/object/public/project-assets/${storagePath}`;
const attachmentUrl = publicUrl(buildAssetSessionPath(OWNER, SESSION, "image", "attached1"));
const generatedUrl = (index: number) => publicUrl(buildAssetSessionPath(OWNER, SESSION, "generated", `preview-${index}-abc`));

const autoCareBrief = { industry: "auto-care", brief: "강하고 테크니컬한 자동차 용품 쇼핑몰", brandName: "MOTOR LAB", palette: { surface: "#0e1013", accent: "#f04e23", thumbBackground: "#16191d" } };

function autoCareMock(): PreviewProductMock[] {
  return resolvePreviewProducts({
    drafts: [
      { name: "카본 코팅 스프레이", imageRef: "asset://0" },
      { name: "휠 전용 클리너", imageRef: "" },
      { name: "실내 세정 폼", imageRef: "" },
      { name: "차량용 무선 청소기", imageRef: "" },
    ],
    assetUrls: [attachmentUrl],
    palette: { background: autoCareBrief.palette.thumbBackground, accent: autoCareBrief.palette.accent },
  });
}

test("사진 프롬프트는 업종·브리프·상품명을 함께 넣고 상품마다 달라진다", () => {
  const prompts = ["휠 전용 클리너", "실내 세정 폼"].map((name) => buildPreviewImagePrompt(name, autoCareBrief));
  assert.equal(new Set(prompts).size, 2);
  for (const prompt of prompts) {
    assert.match(prompt, /Industry: auto-care/);
    assert.match(prompt, /강하고 테크니컬한 자동차 용품 쇼핑몰/);
    assert.match(prompt, /MOTOR LAB/);
    assert.match(prompt, /#16191d/);
    // 상품 리스트 썸네일이므로 글자·로고·사람이 들어가면 안 됩니다.
    for (const forbidden of ["No text", "no logos", "no watermarks", "no people"]) assert.ok(prompt.includes(forbidden), forbidden);
  }
  assert.ok(prompts[0].includes("휠 전용 클리너") && !prompts[0].includes("실내 세정 폼"));
});

test("첨부가 붙은 카드는 사진 생성 대상에서 빠지고 나머지만 생성한다", () => {
  const products = autoCareMock();
  assert.equal(products[0].image, attachmentUrl);
  const targets = previewPhotoTargets({ products, attachmentUrls: [attachmentUrl] });
  assert.deepEqual(targets, [
    { index: 1, name: "휠 전용 클리너" },
    { index: 2, name: "실내 세정 폼" },
    { index: 3, name: "차량용 무선 청소기" },
  ]);
});

test("생성에 성공한 자리는 이번 세션 사진으로, 실패한 자리는 SVG 자리표시자로 남는다", () => {
  const products = autoCareMock();
  const applied = applyGeneratedPreviewPhotos({
    products,
    photos: [{ index: 1, url: generatedUrl(1) }, null, { index: 3, url: generatedUrl(3) }],
    attachmentUrls: [attachmentUrl],
  });
  assert.equal(applied[0].image, attachmentUrl, "첨부는 항상 우선입니다.");
  assert.equal(applied[1].image, generatedUrl(1));
  assert.match(applied[2].image, /^data:image\/svg\+xml/, "생성 실패 자리만 자리표시자로 남습니다.");
  assert.equal(applied[3].image, generatedUrl(3));
  for (const product of applied) assert.ok(!/unsplash|http:\/\//.test(product.image));
});

test("생성 사진은 이번 이미지 세션 경로 밖으로 나가지 않는다", () => {
  const applied = applyGeneratedPreviewPhotos({ products: autoCareMock(), photos: [{ index: 1, url: generatedUrl(1) }], attachmentUrls: [attachmentUrl] });
  assert.ok(applied[1].image.includes(`/project-assets/${OWNER}/sessions/${SESSION}/`));
});

test("생성 사진을 넣어도 Preview 카드 DOM과 Cafe24 binding은 그대로다", () => {
  const applied = applyGeneratedPreviewPhotos({ products: autoCareMock(), photos: [{ index: 1, url: generatedUrl(1) }], attachmentUrls: [attachmentUrl] });
  const preview = renderProductSectionV1("preview", { previewProducts: applied });
  assert.ok(preview.includes(generatedUrl(1)));
  assert.ok(preview.includes("휠 전용 클리너"));
  assert.ok(!/\{\$/.test(preview), "Preview에 미치환 Cafe24 variable이 남으면 안 됩니다.");

  const cafe24 = renderProductCardV1("cafe24", 0, { previewProducts: applied });
  assert.ok(cafe24.includes("{$image_medium}") && cafe24.includes("{$product_name}"));
  assert.ok(!cafe24.includes(generatedUrl(1)) && !cafe24.includes("휠 전용 클리너"));
});

test("사진 생성 사용량은 이미지 장수로 기록된다", () => {
  const event = usageEventFromImageResponse({ model: "gpt-image-2", usage: { input_tokens: 120, output_tokens: 4096 }, imageCount: 1 });
  assert.equal(event.imageCount, 1);
  assert.equal(event.requestCount, 1);
  assert.equal(event.inputTokens, 120);
  assert.equal(event.outputTokens, 4096);
  // 장당 단가는 환경 변수로만 들어오므로 기본값은 0입니다.
  assert.equal(event.imageCostUsd, 0);
});

test("사진 생성은 검증을 통과한 draft에서만 실행되고 실패해도 생성을 깨지 않는다", async () => {
  const generator = await readFile(new URL("../lib/openai/site-generator.ts", import.meta.url), "utf8");
  const retryLoop = generator.slice(generator.indexOf("for (let attempt = 1"), generator.indexOf("if (validator.safe) {"));
  assert.ok(!retryLoop.includes("addGeneratedPreviewPhotos"), "재시도 중에는 사진을 만들지 않습니다.");
  assert.ok(generator.slice(generator.indexOf("if (validator.safe) {")).includes("addGeneratedPreviewPhotos"), "사진 생성은 validator 통과 뒤에 있어야 합니다.");

  const runner = await readFile(new URL("../lib/openai/preview-image-generator.ts", import.meta.url), "utf8");
  assert.ok(runner.includes("Promise.allSettled"), "한 장이 실패해도 나머지는 살아야 합니다.");
  assert.ok(runner.includes("AbortSignal.timeout"), "사진 생성에는 타임아웃이 필요합니다.");
});
