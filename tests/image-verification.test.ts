import assert from "node:assert/strict";
import test from "node:test";
import { createAssetAllowlist, buildAssetSessionPath } from "../lib/assets/asset-policy.ts";
import { generalImageReferences, isRepairableVerdict, replaceImageReference, verifyGeneralImages, type ImageProbe } from "../lib/assets/image-verification.ts";
import { repairBrokenImages } from "../lib/assets/image-repair.ts";
import { createFallbackImage, svgDataUri } from "../lib/assets/fallback-image.ts";

const OWNER = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
const OTHER_SESSION = "33333333-3333-4333-8333-333333333333";
const publicUrl = (path: string) => `https://demo.supabase.co/storage/v1/object/public/project-assets/${path}`;
const attachment = publicUrl(buildAssetSessionPath(OWNER, SESSION, "image", "a1"));
const foreign = publicUrl(buildAssetSessionPath(OWNER, OTHER_SESSION, "image", "old"));
const liveStock = "https://images.unsplash.com/photo-1111111111111-aaaaaaaaaaaa?auto=format&w=1600";
const deadStock = "https://images.unsplash.com/photo-9999999999999-zzzzzzzzzzzz?auto=format&w=1600";
const flakyStock = "https://images.unsplash.com/photo-5555555555555-bbbbbbbbbbbb?auto=format&w=1600";

const allowlist = createAssetAllowlist({ attachments: [attachment] });

function page() {
  return `<div data-moire-root="verify-test"><main>
  <section data-moire-id="hero" data-moire-type="hero"><img src="${attachment}" alt="브랜드 히어로"></section>
  <section data-moire-id="story" data-moire-type="section"><img src="${deadStock}" alt="작업실 전경"><img src="${liveStock}" alt="소재 클로즈업"></section>
  <section data-moire-id="gallery" data-moire-type="section"><img src="" alt="빈 자리"><img src="asset://4" alt="없는 첨부"><img src="/SkinImg/none.jpg" alt="테마 경로"></section>
  <section data-moire-id="foreign" data-moire-type="section"><img src="${foreign}" alt="이전 세션"></section>
  <section data-moire-id="products" data-moire-type="products"><div data-cafe24-slot="product-list"></div></section>
</main></div>`;
}

const pageCss = `[data-moire-root="verify-test"] .banner{background-image:url(${deadStock})}
[data-moire-root="verify-test"] .mood{background-image:url("${flakyStock}")}`;

function probeFor(behaviour: Record<string, { ok: boolean; httpStatus?: number; throws?: boolean; definitive?: boolean }>): { probe: ImageProbe; calls: string[] } {
  const calls: string[] = [];
  const probe: ImageProbe = async (url) => {
    calls.push(url);
    const result = behaviour[url];
    if (!result) return { ok: true, httpStatus: 200 };
    if (result.throws) throw new Error("network unreachable");
    return { ok: result.ok, httpStatus: result.httpStatus, definitive: result.definitive };
  };
  return { probe, calls };
}

test("상품 영역 이미지는 검증 대상에서 제외된다", () => {
  const html = page().replace('<div data-cafe24-slot="product-list"></div>', '<img src="${STOCK}" alt="상품"><div data-cafe24-slot="product-list"></div>');
  const refs = generalImageReferences(html, pageCss);
  assert.ok(!refs.some((reference) => reference.inProductArea));
  assert.ok(!refs.some((reference) => reference.label === "상품"));
});

test("빈 src·범위 밖 asset 참조·테마 로컬 경로는 네트워크 없이 깨진 참조로 잡는다", async () => {
  const { probe, calls } = probeFor({});
  const checks = await verifyGeneralImages({ html: page(), css: pageCss, allowlist, probe });
  const verdicts = new Map(checks.map((check) => [check.url, check.verdict]));
  assert.equal(verdicts.get(""), "invalid-reference");
  assert.equal(verdicts.get("asset://4"), "invalid-reference");
  assert.equal(verdicts.get("/SkinImg/none.jpg"), "invalid-reference");
  for (const url of ["", "asset://4", "/SkinImg/none.jpg"]) assert.ok(!calls.includes(url));
});

test("이번 세션 자산이 아닌 저장 이미지는 out-of-scope로 잡는다", async () => {
  const { probe, calls } = probeFor({});
  const checks = await verifyGeneralImages({ html: page(), css: pageCss, allowlist, probe });
  assert.equal(checks.find((check) => check.url === foreign)?.verdict, "out-of-scope");
  assert.ok(!calls.includes(foreign), "정책 위반은 네트워크 확인 없이 판정합니다.");
  assert.equal(checks.find((check) => check.url === attachment)?.verdict, "ok");
});

test("404는 missing으로 확정하고 정상 이미지는 건드리지 않는다", async () => {
  const { probe, calls } = probeFor({ [deadStock]: { ok: false, httpStatus: 404 } });
  const checks = await verifyGeneralImages({ html: page(), css: pageCss, allowlist, probe });
  assert.equal(checks.find((check) => check.url === deadStock)?.verdict, "missing");
  assert.equal(checks.find((check) => check.url === deadStock)?.httpStatus, 404);
  assert.equal(checks.find((check) => check.url === liveStock)?.verdict, "ok");
  // 같은 주소가 img와 CSS에 함께 있어도 네트워크 확인은 한 번입니다.
  assert.equal(calls.filter((url) => url === deadStock).length, 1);
  // 404는 확정이므로 재시도하지 않습니다.
});

test("전송 오류는 재시도 후에도 판정을 보류하고 이미지를 바꾸지 않는다", async () => {
  const { probe, calls } = probeFor({ [flakyStock]: { ok: false, throws: true } });
  const checks = await verifyGeneralImages({ html: page(), css: pageCss, allowlist, probe });
  const flaky = checks.find((check) => check.url === flakyStock);
  assert.equal(flaky?.verdict, "unverified");
  assert.equal(calls.filter((url) => url === flakyStock).length, 2, "전송 오류는 1회 재시도합니다.");
  assert.ok(!isRepairableVerdict(flaky!.verdict));

  const repaired = await repairBrokenImages({ source: { html: page(), css: pageCss }, checks: [flaky!] });
  assert.equal(repaired.actions.length, 0);
  assert.deepEqual(repaired.unverified, [flakyStock]);
  assert.equal(repaired.css, pageCss);
});

test("깨진 자리만 1회 재생성하고 정상 이미지와 디자인은 그대로 둔다", async () => {
  const { probe } = probeFor({ [deadStock]: { ok: false, httpStatus: 404 } });
  const checks = await verifyGeneralImages({ html: page(), css: pageCss, allowlist, probe });
  const regenerated = publicUrl(buildAssetSessionPath(OWNER, SESSION, "generated", "section-0-new"));
  const attempts: string[] = [];
  const result = await repairBrokenImages({
    source: { html: page(), css: pageCss },
    checks,
    regenerate: async (request) => { attempts.push(request.url); return request.url === deadStock ? regenerated : null; },
  });

  assert.equal(attempts.filter((url) => url === deadStock).length, 1, "자리마다 재생성은 1회입니다.");
  assert.ok(result.html.includes(regenerated) && !result.html.includes(deadStock));
  assert.ok(result.css.includes(regenerated) && !result.css.includes(deadStock));
  assert.ok(result.html.includes(attachment), "정상 이미지는 그대로 남습니다.");
  assert.ok(result.html.includes(liveStock));
  assert.ok(result.html.includes('data-moire-id="hero"'), "디자인 구조는 다시 만들지 않습니다.");
  assert.equal(result.actions.find((action) => action.url === deadStock)?.resolution, "regenerated");
});

test("재생성까지 실패하면 broken image 대신 안전한 fallback으로 마감한다", async () => {
  const { probe } = probeFor({ [deadStock]: { ok: false, httpStatus: 404 } });
  const checks = await verifyGeneralImages({ html: page(), css: pageCss, allowlist, probe });
  const result = await repairBrokenImages({
    source: { html: page(), css: pageCss },
    checks,
    regenerate: async () => null,
    palette: { surface: "#101318", accent: "#f04e23", ink: "#f5f5f5" },
  });

  for (const action of result.actions) {
    assert.equal(action.resolution, "fallback");
    assert.match(action.replacement, /^data:image\/svg\+xml/);
  }
  // 깨진 참조가 하나도 남지 않아야 합니다.
  for (const broken of ["", "asset://4", "/SkinImg/none.jpg", deadStock, foreign]) {
    if (broken) assert.ok(!result.html.includes(broken), broken);
  }
  assert.ok(!/<img[^>]*\ssrc\s*=\s*""/.test(result.html), "빈 src가 남으면 깨진 아이콘이 보입니다.");
  assert.ok(result.html.includes("%23101318") || result.html.includes("#101318"), "fallback은 프로젝트 팔레트를 씁니다.");
});

test("fallback data URI는 CSS url() 안에서 괄호로 끊기지 않는다", async () => {
  const fallback = createFallbackImage({ palette: { surface: "#101318", accent: "#f04e23" }, seed: 1 });
  assert.ok(!fallback.includes("(") && !fallback.includes(")"), "괄호는 escape되어야 합니다.");
  const replaced = replaceImageReference({ html: "", css: `.a{background-image:url(${deadStock})}` }, deadStock, fallback);
  assert.equal(replaced.css, `.a{background-image:url("${fallback}")}`);
  assert.equal(svgDataUri("<svg><rect fill=\"url(#g)\"/></svg>").includes("("), false);
});

test("주소 교체는 src·srcset·url() 안에서만 일어난다", () => {
  const source = {
    html: `<p>${deadStock}</p><a href="${deadStock}">링크</a><img src="${deadStock}" srcset="${deadStock} 2x" alt="x">`,
    css: `.a{background:url(${deadStock})}`,
  };
  const next = replaceImageReference(source, deadStock, "https://example.test/fixed.webp");
  assert.ok(next.html.includes(`<p>${deadStock}</p>`), "본문 텍스트는 건드리지 않습니다.");
  assert.ok(next.html.includes(`<a href="${deadStock}">`), "링크는 건드리지 않습니다.");
  assert.ok(next.html.includes('src="https://example.test/fixed.webp"'));
  assert.ok(next.html.includes('srcset="https://example.test/fixed.webp 2x"'));
  assert.ok(next.css.includes('url("https://example.test/fixed.webp")'));
});

test("이미지가 아닌 응답은 재시도 없이 깨진 것으로 확정한다", async () => {
  const { probe, calls } = probeFor({ [deadStock]: { ok: false, httpStatus: 206, definitive: true } });
  const checks = await verifyGeneralImages({ html: page(), css: pageCss, allowlist, probe });
  const check = checks.find((item) => item.url === deadStock);
  assert.equal(check?.verdict, "missing");
  assert.equal(calls.filter((url) => url === deadStock).length, 1);
  assert.ok(isRepairableVerdict(check!.verdict));
});
