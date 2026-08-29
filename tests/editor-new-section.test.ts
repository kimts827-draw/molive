import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  NEW_SECTION_POSITIONS,
  NEW_SECTION_PRESETS,
  insertArchitectureSection,
  insertPlanSection,
  newSectionNodeId,
  newSectionPlanSection,
  newSectionPreset,
  removePlanSection,
  renderNewSectionPlaceholder,
  renderNewSectionContract,
} from "../lib/editor/new-section.ts";
import { SECTION_TYPES } from "../lib/design-library/section-registry.ts";
import { pagePlanSchema, pagePlanSectionSchema, type PagePlan } from "../lib/design-library/page-plan.ts";
import { composeFallbackPagePlan } from "../lib/design-library/plan-composer.ts";
import { planLayoutCss } from "../lib/design-library/plan-layout-css.ts";
import { prepareProjectPatch, validateNodePatch, validateNodePatchStructure, validateProjectSource } from "../lib/cafe24/protection.ts";
import { buildEditorPreviewDocument } from "../lib/editor/preview-document.ts";
import { composeCommerce, isolateAiDesignCss, resolveLegacyComposition } from "../lib/commerce/fixed-components.ts";
import { isRepairableVerdict, verifyGeneralImages } from "../lib/assets/image-verification.ts";
import { repairBrokenImages } from "../lib/assets/image-repair.ts";
import { createAssetAllowlist } from "../lib/assets/asset-policy.ts";
import type { ProjectSource } from "../lib/project-source.ts";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const plan = composeFallbackPagePlan({ prompt: "원목 가구와 조명을 파는 인테리어 스토어. 공간 제안 중심.", brandName: "무담" });
const ROOT = "moire-newsection";

function baseSource(html: string, css = ""): ProjectSource {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "새 섹션 검증",
    html: `<div data-moire-root="${ROOT}"><main><section data-moire-id="hero-1" data-moire-type="hero"><h1 data-moire-id="hero-title" data-moire-type="text">무담</h1></section><section data-moire-id="products-1" data-moire-type="products"><h2 data-moire-id="products-title" data-moire-type="text">추천 상품</h2><div data-cafe24-slot="product-list"></div></section>${html}</main></div>`,
    css: `[data-moire-root="${ROOT}"] main{display:block}${css}`,
    architecture: { header: plan.header, hero: plan.hero.variant, sections: plan.sections.map((section) => `${section.type}/${section.variant} — ${section.headline}`), productPresentation: plan.productPresentation, typography: "sans", footer: "light" },
    pagePlan: plan,
    updatedAt: new Date(0).toISOString(),
  };
}

test("새 섹션 4종은 레지스트리에 실재하는 type·variant와 허용된 축만 쓴다", () => {
  assert.deepEqual(NEW_SECTION_PRESETS.map((preset) => preset.id), ["brand-story", "benefits", "banner-cta", "image-gallery"]);
  for (const preset of NEW_SECTION_PRESETS) {
    const definition = SECTION_TYPES[preset.type];
    assert.ok(definition, `${preset.id}의 section type이 레지스트리에 없습니다`);
    assert.ok(definition.variants[preset.variant], `${preset.id}의 variant가 레지스트리에 없습니다`);
    // geometry가 정의된 축은 반드시 허용 목록 안이어야 합니다. 벗어나면 코드 CSS와 계약 텍스트가 어긋납니다.
    const geometry = definition.geometry;
    if (geometry?.containers) assert.ok(geometry.containers.includes(preset.container), `${preset.id} container`);
    if (geometry?.columns && preset.columns) assert.ok(geometry.columns.includes(preset.columns), `${preset.id} columns`);
    if (!geometry?.columns) assert.equal(preset.columns, undefined, `${preset.id}는 columns 축을 쓰지 않습니다`);
    if (geometry?.surfaces) assert.ok(geometry.surfaces.includes(preset.surfaceStyle), `${preset.id} surface`);
    // media가 없는 유형은 사진을 요구하지 않습니다. 실패 경로가 가장 짧은 조합입니다.
    if (definition.media === "none") assert.equal(preset.mediaPolicy, "none", `${preset.id} media policy`);
    // plan 항목 자체가 스키마를 통과해야 저장·복구됩니다.
    assert.doesNotThrow(() => pagePlanSectionSchema.parse(newSectionPlanSection(preset, { sectionId: "section-x", brief: "테스트" })));
    // 계약 텍스트에 레지스트리 spec이 실제로 실립니다.
    const contract = renderNewSectionContract(preset);
    assert.ok(contract.includes(definition.variants[preset.variant].spec.slice(0, 40)), `${preset.id} contract spec`);
    assert.ok(contract.includes(`container=${preset.container}`));
  }
});

test("placeholder는 plan 축을 새기고 상품 슬롯·header를 만들지 않는다", () => {
  for (const preset of NEW_SECTION_PRESETS) {
    const sectionId = newSectionNodeId("2f1c9a54-0000-4000-8000-000000000001");
    const html = renderNewSectionPlaceholder({ preset, sectionId });
    assert.ok(html.startsWith(`<section data-moire-id="${sectionId}"`));
    assert.ok(html.includes(`data-moire-plan="${sectionId}"`));
    assert.ok(html.includes(`data-moire-tone="${preset.tone}"`));
    assert.ok(html.includes(`data-moire-container="${preset.container}"`));
    assert.ok(html.includes(`data-moire-surface="${preset.surfaceStyle}"`));
    assert.equal(html.includes("data-moire-columns"), Boolean(preset.columns));
    // AI 호출 전에 화면에서 실제 크기로 잡혀야 반영 여부를 렌더 결과로 판정할 수 있습니다.
    assert.ok(html.includes("min-height:260px"));
    assert.equal(/data-cafe24-slot/.test(html), false);
    assert.equal(/<header/.test(html), false);
    // 자리표시자만 있는 상태에서도 문서 전체 보호검사를 통과해야 합니다.
    const report = validateProjectSource(baseSource(html));
    assert.deepEqual(report.violations, [], `${preset.id}: ${report.violations.map((item) => item.code).join(", ")}`);
  }
});

test("plan 항목은 DOM과 같은 자리에 들어가고 실패하면 함께 빠진다", () => {
  const preset = newSectionPreset("benefits");
  assert.ok(preset);
  const sectionId = "section-added-1";
  const entry = newSectionPlanSection(preset, { sectionId, brief: "무료배송과 교환 안내" });
  const anchorId = plan.sections[1].id;

  const before = insertPlanSection(plan, entry, { position: "before", anchorPlanId: anchorId });
  assert.equal(before.sections[1].id, sectionId);
  const after = insertPlanSection(plan, entry, { position: "after", anchorPlanId: anchorId });
  assert.equal(after.sections[2].id, sectionId);
  const end = insertPlanSection(plan, entry, { position: "end", anchorPlanId: anchorId });
  assert.equal(end.sections.at(-1)?.id, sectionId);
  // anchor를 못 찾으면 자리를 지어내지 않고 맨 끝으로 보냅니다.
  const orphan = insertPlanSection(plan, entry, { position: "after", anchorPlanId: "없는-섹션" });
  assert.equal(orphan.sections.at(-1)?.id, sectionId);

  assert.equal(before.sections.length, plan.sections.length + 1);
  assert.deepEqual(removePlanSection(before, sectionId).sections.map((item) => item.id), plan.sections.map((item) => item.id));
  // 새 항목이 붙어도 plan 전체는 여전히 스키마를 통과합니다.
  assert.doesNotThrow(() => pagePlanSchema.parse(after));
  assert.ok(entry.intent.includes("무료배송과 교환 안내"));

  const architecture = { header: plan.header, hero: plan.hero.variant, sections: plan.sections.map((item) => `${item.type}/${item.variant} — ${item.headline}`), productPresentation: plan.productPresentation, typography: "sans", footer: "light" };
  const nextArchitecture = insertArchitectureSection(architecture, after, sectionId);
  assert.equal(nextArchitecture.sections.length, architecture.sections.length + 1);
  assert.equal(nextArchitecture.sections[2], `${preset.type}/${preset.variant} — ${preset.headline}`);
  assert.deepEqual(NEW_SECTION_POSITIONS, ["before", "after", "end"]);
});

test("새 섹션 patch는 plan 축·section 루트·상품 슬롯 계약을 지켜야 통과한다", () => {
  const preset = newSectionPreset("banner-cta");
  assert.ok(preset);
  const sectionId = "section-cta-1";
  const placeholder = renderNewSectionPlaceholder({ preset, sectionId });
  const finished = `<section data-moire-id="${sectionId}" data-moire-type="section" data-moire-plan="${sectionId}" data-moire-tone="accent" data-moire-container="full-bleed" data-moire-columns="1" data-moire-surface="flat"><h2 data-moire-id="${sectionId}-title" data-moire-type="text">이번 계절의 방</h2><a data-moire-id="${sectionId}-cta" data-moire-type="button" href="/product/list.html">신상품 보기</a></section>`;
  assert.deepEqual(validateNodePatchStructure({ operation: "new-section", before: placeholder, after: finished }).violations, []);

  const cases: Array<[string, string]> = [
    ["PLAN_ATTRIBUTES_LOST", finished.replace(' data-moire-tone="accent"', "")],
    ["PLAN_ATTRIBUTES_LOST", finished.replace('data-moire-container="full-bleed"', 'data-moire-container="boxed"')],
    ["SECTION_ROOT_TAG_CHANGED", finished.replace("<section ", "<div ").replace("</section>", "</div>")],
    ["PRODUCT_SLOT_CREATED", finished.replace("</section>", '<div data-cafe24-slot="product-list"></div></section>')],
    ["HEADER_ELEMENT_CREATED", finished.replace("</section>", "<header>로고</header></section>")],
  ];
  for (const [code, after] of cases) {
    const report = validateNodePatchStructure({ operation: "new-section", before: placeholder, after });
    assert.equal(report.safe, false, code);
    assert.ok(report.violations.some((violation) => violation.code === code), `${code}: ${report.violations.map((item) => item.code).join(", ")}`);
  }

  // 기존 편집도 상품 슬롯 유실과 header 생성만은 노드 단계에서 막습니다.
  const productSection = '<section data-moire-id="products-1" data-moire-type="products"><div data-cafe24-slot="product-list"></div></section>';
  const stripped = '<section data-moire-id="products-1" data-moire-type="products"><p>상품</p></section>';
  assert.ok(validateNodePatchStructure({ operation: "node-edit", before: productSection, after: stripped }).violations.some((item) => item.code === "PRODUCT_SLOT_REMOVED"));
  assert.equal(validateNodePatchStructure({ operation: "node-edit", before: productSection, after: productSection }).safe, true);

  // 노드 CSS 계약은 기존 검사가 그대로 담당합니다.
  const nodeCss = `[data-moire-root="${ROOT}"] [data-moire-id="${sectionId}"]{padding-block:120px}`;
  assert.equal(validateNodePatch({ nodeId: sectionId, rootValue: ROOT, nodeHtml: finished, nodeCss }).safe, true);
});

test("새 섹션은 Preview와 Cafe24 Export에 같은 마크업·같은 plan CSS로 나간다", () => {
  const preset = newSectionPreset("image-gallery");
  assert.ok(preset);
  const sectionId = "section-gallery-1";
  const entry = newSectionPlanSection(preset, { sectionId, brief: "사용 장면 4컷" });
  const nextPlan: PagePlan = insertPlanSection(plan, entry, { position: "end", anchorPlanId: null });
  const sectionHtml = `<section data-moire-id="${sectionId}" data-moire-type="section" data-moire-plan="${sectionId}" data-moire-tone="light" data-moire-container="wide" data-moire-columns="4" data-moire-surface="flat"><h2 data-moire-id="${sectionId}-title" data-moire-type="text">브랜드의 장면</h2><img data-moire-id="${sectionId}-img-1" data-moire-type="image" src="https://images.unsplash.com/photo-1?w=800" alt="장면"></section>`;
  const nodeCss = `[data-moire-root="${ROOT}"] [data-moire-id="${sectionId}"]{display:grid;grid-template-columns:repeat(var(--molive-columns),1fr)}`;
  const source: ProjectSource = { ...baseSource(sectionHtml, `\n/* MOIRE:NODE:${sectionId}:START */\n${nodeCss}\n/* MOIRE:NODE:${sectionId}:END */`), pagePlan: nextPlan };

  // Export 관문: 문서 전체 보호검사를 통과해야 ZIP과 게시가 만들어집니다.
  assert.doesNotThrow(() => prepareProjectPatch(source));

  const preview = buildEditorPreviewDocument(source);
  const exported = composeCommerce(source.html, "cafe24", source.commerce, resolveLegacyComposition(source.architecture), { includeHeader: false });
  for (const attribute of [`data-moire-id="${sectionId}"`, `data-moire-plan="${sectionId}"`, 'data-moire-container="wide"', 'data-moire-columns="4"']) {
    assert.ok(preview.srcDoc.includes(attribute), `Preview에 ${attribute}가 없습니다`);
    assert.ok(exported.html.includes(attribute), `Export에 ${attribute}가 없습니다`);
  }
  // 상품 진열은 여전히 하나뿐이고 새 섹션은 그것을 건드리지 않습니다.
  assert.equal(exported.slots, 1);

  // plan 축을 소비하는 코드 CSS가 새 섹션에도 실제로 생깁니다.
  const planCss = planLayoutCss(nextPlan);
  assert.ok(planCss.includes('[data-moire-container="wide"]'));
  assert.ok(planCss.includes('[data-moire-columns="4"]{--molive-columns:4}'));
  assert.ok(preview.srcDoc.includes('[data-moire-columns="4"]{--molive-columns:4}'));
  // 노드 CSS는 Preview와 Export 모두 같은 격리 규칙을 거쳐 나갑니다.
  assert.ok(isolateAiDesignCss(source.css).includes(`[data-moire-id="${sectionId}"]`));
  assert.ok(preview.srcDoc.includes(`[data-moire-id="${sectionId}"]`));
});

test("새 섹션의 사진은 프로젝트 자산만 쓰고, 깨진 주소는 저장 전에 마감된다", async () => {
  const [generator, route] = await Promise.all([
    read("lib/openai/site-generator.ts"),
    read("app/api/ai/edit/route.ts"),
  ]);
  // 사진이 필요한 유형은 이 프로젝트 자산 목록만 쓰고, 없으면 이미지를 만들지 않습니다.
  const story = renderNewSectionContract(newSectionPreset("brand-story")!);
  assert.ok(story.includes("ALLOWED IMAGES 목록의 주소만 글자 그대로 복사해"));
  assert.ok(story.includes("img 요소를 만들지 말고"));
  const benefits = renderNewSectionContract(newSectionPreset("benefits")!);
  assert.ok(benefits.includes("img 요소와 배경 사진을 쓰지 않는다"));
  assert.ok(generator.includes("Never invent an image address"));

  // 그래도 지어낸 주소가 오면 저장 전에 확인하고 깨진 자리만 대체합니다.
  assert.match(generator, /sectionOperation && options\?\.imageProbe[\s\S]*verifyGeneralImages\(\{ html: patch\.nodeHtml/);
  assert.match(generator, /imageChecks\.some\(\(check\) => isRepairableVerdict\(check\.verdict\)\)/);
  assert.match(generator, /repairBrokenImages\(\{\s*source: \{ html: patch\.nodeHtml, css: patch\.nodeCss \}/);
  assert.match(route, /imageProbe: createImageProbe\(\)/);
});

test("지어낸 사진 주소가 섞여 들어와도 깨진 자리만 팔레트 색면으로 마감된다", async () => {
  const allowed = "https://images.unsplash.com/photo-real?w=1600";
  const invented = "https://images.unsplash.com/photo-does-not-exist?w=1600";
  const nodeHtml = `<section data-moire-id="s1" data-moire-type="section"><img data-moire-id="s1-a" data-moire-type="image" src="${allowed}" alt="실제"><img data-moire-id="s1-b" data-moire-type="image" src="${invented}" alt="없는 사진"></section>`;
  const probe = async (url: string) => (url === invented ? { ok: false, httpStatus: 404 } : { ok: true, httpStatus: 200 });

  const checks = await verifyGeneralImages({ html: nodeHtml, css: "", allowlist: createAssetAllowlist({ projectAssets: [allowed] }), probe });
  assert.equal(checks.filter((check) => isRepairableVerdict(check.verdict)).length, 1);

  const repaired = await repairBrokenImages({ source: { html: nodeHtml, css: "" }, checks, palette: { surface: "#6b5b4a", accent: "#6b5b4a" } });
  assert.equal(repaired.actions.length, 1);
  assert.equal(repaired.actions[0].resolution, "fallback");
  // 정상 이미지는 그대로 두고, 깨진 자리만 외부를 참조하지 않는 data: 이미지로 바뀝니다.
  assert.ok(repaired.html.includes(allowed));
  assert.equal(repaired.html.includes(invented), false);
  assert.ok(repaired.html.includes("data:image/svg+xml"));
  assert.ok(repaired.html.includes('data-moire-id="s1-b"'));
});

test("새 섹션 요청은 프롬프트 추측이 아니라 operation으로 서버 계약을 고른다", async () => {
  const [generator, route, shell] = await Promise.all([
    read("lib/openai/site-generator.ts"),
    read("app/api/ai/edit/route.ts"),
    read("components/editor/editor-shell.tsx"),
  ]);

  // 서버: operation으로 계약을 고르고, style-only 오분류로 빈 자리표시자가 남지 않게 합니다.
  assert.match(route, /operation: z\.enum\(\["node-edit", "new-section", "redesign-section"\]\)\.optional\(\)/);
  assert.match(route, /sectionPreset: z\.enum\(NEW_SECTION_PRESET_IDS\)\.optional\(\)/);
  assert.match(route, /value\.operation !== "new-section" \|\| Boolean\(value\.sectionPreset\)/);
  assert.match(generator, /const editIntent = sectionOperation \? "general" : classifyAiEditIntent\(input\.prompt\)/);
  assert.match(generator, /const sectionOperation = operation !== "node-edit"/);
  assert.match(generator, /if \(operation === "new-section" && !preset\) throw new Error/);
  assert.match(generator, /\$\{preset \? newSectionSystemPrompt : ""\}/);
  assert.match(generator, /validateNodePatchStructure\(\{ operation, before: input\.nodeHtml, after: patch\.nodeHtml, reservedIds: input\.reservedNodeIds \}\)/);
  for (const rule of [
    "Never output data-cafe24-slot",
    "Keep every data-moire-plan",
    "Keep the root element a <section>",
  ]) assert.ok(generator.includes(rule), rule);

  // 클라이언트: AI 호출 전에 placeholder와 plan을 함께 만들고, 실패하면 함께 되돌립니다.
  assert.match(shell, /const snapshot = \{ source: sourceRef\.current, past: pastRef\.current, future: futureRef\.current \}/);
  assert.match(shell, /renderNewSectionPlaceholder\(\{ preset, sectionId \}\)/);
  assert.match(shell, /insertPlanSection\(plan, newSectionPlanSection\(preset, \{ sectionId, brief: input\.brief \}\)/);
  assert.match(shell, /anchorPlanId: anchor\?\.getAttribute\("data-moire-plan"\) \?\? null/);
  assert.match(shell, /catch \(error\) \{[\s\S]*rollbackToSnapshot\(snapshot\)/);
  assert.match(shell, /operation: "new-section",\s*sectionPreset: preset\.id/);
  // 삽입 위치 3종과 유형 4종이 UI에 실제로 노출됩니다.
  assert.match(shell, /anchor && position === "before"/);
  assert.match(shell, /anchor && position === "after"/);
  assert.match(shell, /NEW_SECTION_PRESETS\.map\(\(item\) =>/);
});
