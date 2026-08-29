import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { classifyAiEditIntent } from "../lib/editor/ai-edit-intent.ts";
import { productThumbnailGuidance } from "../lib/editor/product-thumbnail-guidance.ts";
import { validateNodePatch } from "../lib/cafe24/protection.ts";

const editorSource = await readFile(new URL("../components/editor/editor-shell.tsx", import.meta.url), "utf8");
const editorCss = await readFile(new URL("../app/editor/editor.css", import.meta.url), "utf8");
const publishSource = await readFile(new URL("../components/editor/publish-modal.tsx", import.meta.url), "utf8");
const generatorSource = await readFile(new URL("../lib/openai/site-generator.ts", import.meta.url), "utf8");
const aiEditRouteSource = await readFile(new URL("../app/api/ai/edit/route.ts", import.meta.url), "utf8");

test("AI 글꼴·색상·크기 요청은 선택 노드 HTML을 보존하는 style-only 편집이다", () => {
  assert.equal(classifyAiEditIntent("이 텍스트 크기를 32px로 바꿔줘"), "style-only");
  assert.equal(classifyAiEditIntent("폰트를 Serif로, 색을 검정으로 바꿔줘"), "style-only");
  assert.equal(classifyAiEditIntent("문구 내용을 새 카피로 바꿔줘"), "general");
  assert.equal(classifyAiEditIntent("이미지와 레이아웃을 교체해줘"), "general");
  for (const prompt of ["레이아웃 세로폭 1.5배 늘려줘", "이미지를 조금 위로 올려줘", "이미지 아래쪽으로 10px 옮겨줘", "이 영역 높이를 줄여줘", "위아래 여백 줄여줘", "이미지를 중앙보다 오른쪽으로 옮겨줘", "이미지 비율을 4:3으로 바꿔줘", "자간을 조금 줄여줘"]) {
    assert.equal(classifyAiEditIntent(prompt), "style-only", prompt);
  }
  assert.ok(generatorSource.includes('editIntent === "style-only" ? input.nodeHtml : parsed.nodeHtml'));
  assert.ok(generatorSource.includes("Never use !important"));
  assert.ok(generatorSource.includes("ordinary Korean layout language"));
  assert.ok(generatorSource.includes("Current selected render metrics"));
  assert.ok(generatorSource.includes("translate longhand"));
});

test("자연어 레이아웃 편집에 필요한 높이·여백·이미지 위치 CSS는 validator를 통과한다", () => {
  const selector = '[data-moire-root="root-1"] [data-moire-id="hero-image"]';
  const result = validateNodePatch({
    nodeId: "hero-image",
    rootValue: "root-1",
    nodeHtml: '<img data-moire-id="hero-image" data-moire-type="image" src="/image.jpg" alt="">',
    nodeCss: `${selector}{min-height:720px;padding-block:40px;object-position:72% 28%;transform:translateY(-12px)}`,
  });
  assert.equal(result.safe, true, JSON.stringify(result.violations));
});

test("Editor AI 요청은 렌더 metrics와 큰 선택 영역을 받고 generic 형식 오류로 숨기지 않는다", () => {
  assert.ok(editorSource.includes("renderMetrics"));
  assert.ok(aiEditRouteSource.includes("renderMetrics: z.object"));
  assert.ok(aiEditRouteSource.includes("nodeHtml: z.string().min(10).max(400000)"));
  assert.ok(aiEditRouteSource.includes("AI 수정 요청의 ${field} 값을 확인해 주세요."));
  assert.equal(aiEditRouteSource.includes('error: "요청 데이터 형식이 올바르지 않습니다."'), false);
});

test("Inspector는 color picker와 실제 높이·margin/padding 편집을 제공하고 gap UI를 제거한다", () => {
  assert.ok(editorSource.includes('type="color"'));
  for (const property of ["margin-top", "margin-bottom", "padding-top", "padding-bottom"]) {
    assert.ok(editorSource.includes(`property="${property}"`), property);
  }
  assert.ok(editorSource.includes('onStyles({ height: pixels, "min-height": pixels })'));
  assert.ok(editorSource.includes("현재 높이 배율"));
  assert.equal(editorSource.includes('property="gap"'), false);
  assert.equal(editorSource.includes('property="row-gap"'), false);
  assert.equal(editorSource.includes('property="column-gap"'), false);
  assert.ok(editorSource.includes("function DraftInput"));
  assert.ok(editorSource.includes("onBlur={commitDraft}"));
  assert.ok(editorSource.includes('event.key === "Enter"'));
  assert.equal(editorSource.includes('onStyle("position"'), false);
});

test("숫자 입력은 local draft를 유지하고 px 변환은 blur/Enter commit에서만 수행한다", () => {
  assert.ok(editorSource.includes("const [draft, setDraft] = useState(value)"));
  assert.ok(editorSource.includes("onChange={(event) => setDraft(event.target.value)}"));
  assert.ok(editorSource.includes("normalizeCssValue(draft, defaultUnit)"));
  assert.ok(editorSource.includes('label="글자 크기"'));
  assert.ok(editorSource.includes('defaultUnit="px"'));
  assert.ok(editorSource.includes('type="range"'));
  assert.ok(editorSource.includes('range.addEventListener("change", commitRange)'));
});

test("Color picker는 조작 중 draft만 갱신하고 blur에서 문서에 반영한다", () => {
  assert.ok(editorSource.includes("setDraft(next); onPreview(next)"));
  assert.ok(editorSource.includes('picker.addEventListener("change", commitPicker)'));
  assert.ok(editorSource.includes('onBlur={(event) => onChange(event.currentTarget.value)}'));
  assert.ok(editorSource.includes("previewStylePatch={previewStylePatch}"));
  assert.equal(editorSource.includes('type="color" aria-label="색상 선택" value={pickerColor(value)} onChange='), false);
});

test("텍스트 Inspector는 행간·자간·배율·밑줄·기울임을 제공한다", () => {
  for (const label of ["행간", "자간", "크기 배율", "좌우 위치 X", "상하 위치 Y", "밑줄", "기울임"]) assert.ok(editorSource.includes(label), label);
  for (const property of ["line-height", "letter-spacing", "text-decoration-line", "font-style", "scale", "translate"]) assert.ok(editorSource.includes(property), property);
});

test("이미지와 텍스트 Y 슬라이더는 오른쪽으로 갈수록 화면 위로 이동하고 X축은 기존 방향을 유지한다", () => {
  assert.ok(editorSource.includes('function setVerticalSliderPosition(value: number, preview = false)'));
  assert.ok(editorSource.includes('setTranslate("y", -Math.round(value), preview)'));
  assert.ok(editorSource.includes('label="이미지 상하 위치" value={-translateY}'));
  assert.ok(editorSource.includes('label="텍스트 상하 위치" value={-translateY}'));
  assert.ok(editorSource.includes('label="이미지 좌우 위치" value={translateX}'));
  assert.ok(editorSource.includes('label="텍스트 좌우 위치" value={translateX}'));
  assert.ok(editorSource.includes('label="이미지 세로 중심" value={imageY}'));
  assert.ok(editorSource.includes('onPreview={(value) => onPreviewStyle("object-position", `${imageX}% ${value}%`)}'));
  assert.equal(editorSource.includes("imageFocusDown"), false);
});

test("일반 이미지·배경·아이콘은 교체하고 Cafe24 상품 썸네일은 보호한다", () => {
  assert.ok(editorSource.includes('type ImageEditKind = "content" | "background" | "icon"'));
  assert.ok(editorSource.includes('node.style.setProperty("background-image"'));
  assert.ok(editorSource.includes('node.tagName === "svg"'));
  assert.ok(editorSource.includes("if (!selectedNode || selectedNode.insideProductSlot) return"));
  assert.ok(editorSource.includes("const stored = projectId ? await persistProjectAsset"));
  assert.ok(editorSource.includes("Cafe24 상품 썸네일"));
  assert.ok(editorSource.includes('onStyle("object-position"'));
  assert.ok(editorSource.includes("보이는 중심 X"));
  assert.ok(editorSource.includes("세로 위치 Y"));
  assert.ok(editorSource.includes("이미지 크기 배율"));
  assert.ok(editorSource.includes("이미지 상하 위치"));
  // 비율 입력 대신 중앙 기준 확대/축소를 씁니다.
  assert.equal(editorSource.includes("aspect-ratio-field"), false);
  assert.ok(editorSource.includes('if (!part?.trim()) return 50'));
});

test("상품 presentation별 썸네일 권장 비율과 크기를 안내한다", () => {
  assert.deepEqual(productThumbnailGuidance("grid-four"), { label: "4열 그리드", ratio: "1:1", size: "1000 × 1000px" });
  assert.equal(productThumbnailGuidance("large-grid").ratio, "4:5");
  assert.equal(productThumbnailGuidance("editorial-two").ratio, "3:4");
  assert.equal(productThumbnailGuidance("featured-grid").size, "대표 1200 × 1500px · 나머지 1000 × 1000px");
  assert.equal(productThumbnailGuidance("compact-five").size, "800 × 800px");
  assert.deepEqual(productThumbnailGuidance("grid-four", "4/5"), {
    label: "4열 그리드",
    ratio: "4:5",
    size: "1200 × 1500px",
    note: "현재 Editor에 적용된 4:5 비율 기준입니다.",
  });
  assert.equal(productThumbnailGuidance("large-grid", "1/1").size, "1000 × 1000px");
});

test("Editor UI는 AI 생성 도구 카드를 제공하고 1920 preview 아래 고정 흰 박스를 제거한다", () => {
  assert.ok(editorCss.includes(".ai-tool-card { padding: 13px; display: grid"));
  assert.ok(editorCss.includes(".ai-tool-list { min-height: 0; overflow-y: auto"));
  assert.ok(editorCss.includes(".canvas-viewport { min-height: 0;"));
  assert.ok(editorCss.includes("grid-template-columns: 330px minmax(0, 1fr) 390px"));
  assert.equal(editorCss.includes(".canvas-viewport { min-height: 900px"), false);
});

test("AI 메뉴는 자유 채팅 없이 두 생성 도구와 Credit 비용만 노출한다", () => {
  assert.ok(editorCss.includes(".editor-left-panel { height: 100%; overflow: hidden"));
  for (const label of ["새 섹션 만들기", "이 섹션 다시 디자인", "1 Credit 사용", "AI 생성 도구"]) assert.ok(editorSource.includes(label), label);
  for (const removed of ["chatInput", "submitAiEdit", "suggestion-chips", "ai-input-wrap", "AI Node Designer"]) assert.equal(editorSource.includes(removed), false, removed);
  assert.ok(editorSource.includes("일반 편집은 Inspector에서"));
  assert.ok(editorSource.includes("색상, 여백, 글자 크기, 정렬, 상품 배열"));
  assert.ok(editorSource.includes("mobile-ai-tools-button"));
  assert.ok(editorCss.includes(".topbar-actions .mobile-ai-tools-button { display: flex !important"));
});

test("AI 도구는 실행 전 작업·취소·차단 이유를 명확히 보여준다", () => {
  for (const preset of ["브랜드 스토리", "혜택·신뢰", "배너 CTA", "이미지 갤러리"]) assert.ok(editorSource.includes(preset), preset);
  assert.ok(editorSource.includes("새 섹션 만들기 · 1 Credit 사용"));
  assert.ok(editorSource.includes("이 섹션 다시 디자인 · 1 Credit 사용"));
  assert.ok(editorSource.includes(">취소</button>"));
  assert.ok(editorSource.includes("상품 섹션은 Cafe24 상품 바인딩을 보호하기 위해 AI 재디자인을 사용할 수 없습니다."));
  assert.ok(editorSource.includes("Header는 고정 컴포넌트이므로 AI로 다시 디자인할 수 없습니다."));
  assert.ok(editorSource.includes("원래 섹션은 그대로 두었습니다."));
  assert.ok(editorSource.includes("추가하던 섹션 자리는 되돌렸습니다."));
});

test("게시 UI는 ZIP과 Installer 다운로드 및 적용 순서만 안내한다", () => {
  assert.ok(publishSource.includes("ZIP 다운로드"));
  assert.ok(publishSource.includes("디자인 저장 상태"));
  assert.ok(publishSource.includes('href="/api/installer/download"'));
  for (const step of ["디자인 ZIP 다운로드", "MOLIVE Installer 설치", "Installer에서 ZIP 선택", "Cafe24 접속 확인 → 스킨 선택 → 적용"]) {
    assert.ok(publishSource.includes(step), step);
  }
  assert.equal(publishSource.includes("Cafe24 쇼핑몰 ID"), false);
  assert.equal(publishSource.includes("/api/cafe24/status"), false);
  assert.equal(publishSource.includes("/api/cafe24/deploy"), false);
  assert.equal(publishSource.includes("연동 검증 POC ZIP"), false);
  assert.equal(publishSource.includes("Runtime/ScriptTag"), false);
  assert.equal(publishSource.includes("installation</span>"), false);
});

test("Header Inspector는 로고 두 방식·띠배너·크기 조절과 전체화면 Preview를 제공한다", () => {
  for (const text of ["글자·아이콘 색상", "검정", "흰색", "텍스트 로고", "이미지 로고", "띠배너", "표시 높이", "글자 크기", "전체화면 보기", "Editor로 돌아가기"]) {
    assert.ok(editorSource.includes(text), text);
  }
  assert.ok(editorSource.includes("headerTextTone={source.headerTextTone ?? \"dark\"}"));
  assert.ok(editorSource.includes("commit({ ...current, headerTextTone"));
  assert.ok(editorSource.includes('persistProjectAsset(optimized, "logo"'));
  assert.ok(editorCss.includes(".preview-fullscreen .editor-left-panel"));
  assert.ok(editorCss.includes(".canvas-viewport.viewport-desktop { width: 100%"));
});

test("Header Inspector는 조작 중 Preview만 갱신하고 종료 시 ProjectSource에 commit한다", () => {
  assert.ok(editorSource.includes("previewHeaderPresentation={previewHeaderPresentation}"));
  assert.ok(editorSource.includes("onPreviewPresentation={onPreviewHeaderPresentation}"));
  assert.ok(editorSource.includes("onPreview={(textSize) => previewLogo({ textSize })}"));
  assert.ok(editorSource.includes("onPreview={(imageHeight) => previewLogo({ imageHeight })}"));
  assert.ok(editorSource.includes("onPreview={(backgroundColor) => previewAnnouncement({ backgroundColor })}"));
  assert.ok(editorSource.includes("onPreview={(textColor) => previewAnnouncement({ textColor })}"));
  assert.ok(editorSource.includes("onPreview={(height) => previewAnnouncement({ height })}"));
  assert.ok(editorSource.includes("onCommit={(height) => updateAnnouncement({ height })}"));
  assert.ok(editorSource.includes("thumbRatioOverride={source.commerce?.thumbRatioOverride}"));
});

test("텍스트 로고는 typography 입력만 제공하고 색상은 Header tone을 상속한다", () => {
  for (const label of ["텍스트 로고 행간", "텍스트 로고 자간", "Extra Bold", "header-logo-letter-spacing", "header-logo-line-height"]) {
    assert.ok(editorSource.includes(label), label);
  }
  assert.ok(editorSource.includes('value={presentation.logo.fontFamily ?? "inherit"}'));
  assert.ok(editorSource.includes('value={String(presentation.logo.fontWeight ?? 800)}'));
  assert.equal(editorSource.includes('nodeId="header-logo" property="color"'), false);
  assert.equal(editorSource.includes("header-logo-translate"), false);
  assert.equal(editorSource.includes("header-logo-scale"), false);
});
