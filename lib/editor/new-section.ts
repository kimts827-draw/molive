/**
 * Editor "새 섹션 만들기"의 결정적 층입니다.
 *
 * AI를 부르기 전에 코드가 먼저 섹션 자리를 만듭니다. 유형 4종은 각각 레지스트리의
 * section type/variant와 시각 축(plan 축)에 고정되어 있고, placeholder DOM과 pagePlan 항목을
 * 여기서 함께 만들어 두 쪽이 어긋나지 않게 합니다. AI는 그 자리의 내용만 설계하며,
 * 실패하면 호출부가 placeholder와 plan 항목을 함께 되돌립니다.
 *
 * 안정성 경계: 상품 슬롯(data-cafe24-slot)·Header·Cafe24 binding은 어떤 유형도 만들지 않습니다.
 * 상품 진열은 페이지에 이미 하나 있는 검증 슬롯이 소유합니다.
 */

import { PLAN_ATTRIBUTE_NAMES } from "../design-library/plan-attributes.ts";
import type { PagePlan, PagePlanSection } from "../design-library/page-plan.ts";
import {
  SECTION_TYPES,
  type SectionAlignment,
  type SectionColumns,
  type SectionContainer,
  type SectionDensity,
  type SectionMediaPosition,
  type SectionSurfaceStyle,
  type SectionTone,
  type SectionTypeId,
} from "../design-library/section-registry.ts";
import type { ProjectArchitecture } from "../project-source.ts";

export const NEW_SECTION_PRESET_IDS = ["brand-story", "benefits", "banner-cta", "image-gallery"] as const;
export type NewSectionPresetId = (typeof NEW_SECTION_PRESET_IDS)[number];

export const NEW_SECTION_POSITIONS = ["before", "after", "end"] as const;
export type NewSectionPosition = (typeof NEW_SECTION_POSITIONS)[number];

/**
 * 이미지 정책입니다.
 * - none: 사진 없이 타이포·색면·괘선으로만 구성합니다. 실패 경로가 가장 짧습니다.
 * - project-or-fresh: 이 프로젝트에 이미 있는 사진을 우선 재사용하고, 없을 때만 새 스톡을 씁니다.
 */
export type NewSectionMediaPolicy = "none" | "project-or-fresh";

export type NewSectionPreset = {
  id: NewSectionPresetId;
  label: string;
  summary: string;
  briefPlaceholder: string;
  type: SectionTypeId;
  variant: string;
  headline: string;
  intent: string;
  mediaPolicy: NewSectionMediaPolicy;
  alignment: SectionAlignment;
  mediaPosition: SectionMediaPosition;
  density: SectionDensity;
  tone: SectionTone;
  container: SectionContainer;
  columns?: SectionColumns;
  surfaceStyle: SectionSurfaceStyle;
};

export const NEW_SECTION_PRESETS: readonly NewSectionPreset[] = [
  {
    id: "brand-story",
    label: "브랜드 스토리",
    summary: "사진 한 장과 글로 브랜드의 태도를 말하는 좌우 분할 서사",
    briefPlaceholder: "예: 10년 동안 같은 공방에서 손으로 만들어 온 이야기를 담담하게. 과장 없이.",
    type: "brandStory",
    variant: "split-media",
    headline: "브랜드 이야기",
    intent: "브랜드의 시작과 태도를 짧은 서사로 전해 구매 이유를 만든다.",
    mediaPolicy: "project-or-fresh",
    alignment: "left",
    mediaPosition: "left",
    density: "airy",
    tone: "light",
    container: "boxed",
    surfaceStyle: "flat",
  },
  {
    id: "benefits",
    label: "혜택·신뢰",
    summary: "배송·교환·보증처럼 확인 가능한 약속을 정리한 괘선 정보 밴드",
    briefPlaceholder: "예: 3만원 이상 무료배송, 7일 이내 교환, 정품 보증 세 가지를 담백하게.",
    type: "benefits",
    variant: "icon-columns",
    headline: "우리의 약속",
    intent: "확인 가능한 약속만 정리해 구매 직전의 망설임을 줄인다.",
    mediaPolicy: "none",
    alignment: "center",
    mediaPosition: "none",
    density: "regular",
    tone: "tinted",
    container: "boxed",
    columns: 3,
    surfaceStyle: "outlined",
  },
  {
    id: "banner-cta",
    label: "배너 CTA",
    summary: "브랜드 색면 위에 한 문장과 링크 하나로 다음 행동을 여는 전환 밴드",
    briefPlaceholder: "예: 이번 시즌 신상품을 보러 가도록 유도하는 짧고 강한 한 문장.",
    type: "cta",
    variant: "statement-text",
    headline: "지금 만나보세요",
    intent: "페이지를 다음 행동으로 닫는 전환부를 만든다.",
    mediaPolicy: "none",
    alignment: "center",
    mediaPosition: "none",
    density: "airy",
    tone: "accent",
    container: "full-bleed",
    columns: 1,
    surfaceStyle: "flat",
  },
  {
    id: "image-gallery",
    label: "이미지 갤러리",
    summary: "장면 사진을 격자로 모아 분위기를 보여 주는 갤러리",
    briefPlaceholder: "예: 실제 사용 장면 느낌의 사진 4장을 정방형 그리드로. 캡션은 짧게.",
    type: "socialGallery",
    variant: "sns-grid",
    headline: "브랜드의 장면",
    intent: "장면 이미지를 모아 브랜드가 쓰이는 맥락을 보여 준다.",
    mediaPolicy: "project-or-fresh",
    alignment: "center",
    mediaPosition: "grid",
    density: "regular",
    tone: "light",
    container: "wide",
    columns: 4,
    surfaceStyle: "flat",
  },
];

export function isNewSectionPresetId(value: unknown): value is NewSectionPresetId {
  return typeof value === "string" && NEW_SECTION_PRESETS.some((preset) => preset.id === value);
}

export function newSectionPreset(id: string): NewSectionPreset | null {
  return NEW_SECTION_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function isNewSectionPosition(value: unknown): value is NewSectionPosition {
  return typeof value === "string" && (NEW_SECTION_POSITIONS as readonly string[]).includes(value);
}

/** 새 섹션의 DOM 노드 ID입니다. 같은 값을 plan 항목 ID로도 써서 DOM과 plan을 1:1로 잇습니다. */
export function newSectionNodeId(uuid: string) {
  return `section-${uuid}`;
}

export function newSectionPlanSection(preset: NewSectionPreset, input: { sectionId: string; brief: string }): PagePlanSection {
  const brief = input.brief.trim().slice(0, 300);
  return {
    id: input.sectionId,
    type: preset.type,
    variant: preset.variant,
    alignment: preset.alignment,
    mediaPosition: preset.mediaPosition,
    density: preset.density,
    tone: preset.tone,
    container: preset.container,
    ...(preset.columns ? { columns: preset.columns } : {}),
    surfaceStyle: preset.surfaceStyle,
    intent: brief ? `${preset.intent} 사용자 요청: ${brief}`.slice(0, 400) : preset.intent,
    headline: preset.headline,
  };
}

function escapeAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/**
 * plan 축을 그대로 새겨 넣은 빈 섹션입니다.
 *
 * AI 호출 전에 화면에 실제 크기로 렌더되어야 합니다. Editor는 patch 적용 전후의 렌더 결과를
 * 비교해 반영 여부를 판정하는데, 높이 0짜리 자리표시자는 비교 기준을 만들지 못합니다.
 */
export function renderNewSectionPlaceholder(input: { preset: NewSectionPreset; sectionId: string }) {
  const { preset, sectionId } = input;
  const attributes = [
    `data-moire-id="${escapeAttribute(sectionId)}"`,
    'data-moire-type="section"',
    `${PLAN_ATTRIBUTE_NAMES.plan}="${escapeAttribute(sectionId)}"`,
    `${PLAN_ATTRIBUTE_NAMES.tone}="${preset.tone}"`,
    `${PLAN_ATTRIBUTE_NAMES.container}="${preset.container}"`,
    ...(preset.columns ? [`${PLAN_ATTRIBUTE_NAMES.columns}="${preset.columns}"`] : []),
    `${PLAN_ATTRIBUTE_NAMES.surface}="${preset.surfaceStyle}"`,
    `aria-label="${escapeAttribute(preset.label)}"`,
    'style="display:grid;gap:10px;align-content:center;justify-items:center;text-align:center;min-height:260px;padding:72px 24px"',
  ].join(" ");
  const title = escapeText(preset.headline);
  return `<section ${attributes}><h2 data-moire-id="${escapeAttribute(`${sectionId}-title`)}" data-moire-type="text" style="margin:0;font-size:24px;letter-spacing:-0.01em">${title}</h2><p data-moire-id="${escapeAttribute(`${sectionId}-body`)}" data-moire-type="text" style="margin:0;font-size:14px;opacity:0.62">AI가 이 자리에 ${escapeText(preset.label)} 섹션을 설계하고 있습니다.</p></section>`;
}

/** DOM 삽입 위치와 같은 자리에 plan 항목을 넣습니다. 두 순서가 어긋나면 축 계약이 다른 섹션에 걸립니다. */
export function insertPlanSection(plan: PagePlan, section: PagePlanSection, placement: { position: NewSectionPosition; anchorPlanId?: string | null }): PagePlan {
  const anchorIndex = placement.anchorPlanId ? plan.sections.findIndex((item) => item.id === placement.anchorPlanId) : -1;
  const index = placement.position === "end" || anchorIndex < 0
    ? plan.sections.length
    : placement.position === "before" ? anchorIndex : anchorIndex + 1;
  const sections = [...plan.sections.slice(0, index), section, ...plan.sections.slice(index)];
  return { ...plan, sections };
}

export function removePlanSection(plan: PagePlan, sectionId: string): PagePlan {
  return { ...plan, sections: plan.sections.filter((item) => item.id !== sectionId) };
}

/** architecture.sections는 감사용 메타데이터입니다. plan과 같은 자리에 같은 표기로 맞춰 둡니다. */
export function insertArchitectureSection(architecture: ProjectArchitecture, plan: PagePlan, sectionId: string): ProjectArchitecture {
  const planIndex = plan.sections.findIndex((item) => item.id === sectionId);
  const section = plan.sections[planIndex];
  if (!section) return architecture;
  const label = `${section.type}/${section.variant} — ${section.headline}`;
  // plan과 길이가 같을 때만 자리를 맞춥니다. 어긋난 기존 프로젝트에서는 끝에 덧붙입니다.
  const index = architecture.sections.length === plan.sections.length - 1 ? planIndex : architecture.sections.length;
  return { ...architecture, sections: [...architecture.sections.slice(0, index), label, ...architecture.sections.slice(index)] };
}

/** AI에게 넘길 이 유형의 계약 텍스트입니다. 레지스트리 정의를 그대로 실어 보냅니다. */
export function renderNewSectionContract(preset: NewSectionPreset) {
  const definition = SECTION_TYPES[preset.type];
  const variant = definition?.variants[preset.variant];
  const media = preset.mediaPolicy === "none"
    ? "이 섹션에는 img 요소와 배경 사진을 쓰지 않는다. 타이포, 색면, 괘선, 여백으로만 구성한다."
    : "사진은 아래 ALLOWED IMAGES 목록의 주소만 글자 그대로 복사해 쓴다. 목록이 비어 있으면 img 요소를 만들지 말고 CSS 그라디언트, 색면, 인라인 data:image/svg+xml 아트로 미디어 자리를 채운다. 기억에 있는 사진 주소나 지어낸 스톡 사진 ID는 실제로 존재하지 않아 화면에서 깨진다.";
  return [
    `SECTION TYPE: ${preset.type} (${definition?.name ?? preset.type}) — ${definition?.purpose ?? ""}`,
    `VARIANT: ${preset.variant} (${variant?.name ?? preset.variant}) — ${variant?.spec ?? ""}`,
    `AXES: alignment=${preset.alignment}, mediaPosition=${preset.mediaPosition}, density=${preset.density}, tone=${preset.tone}, container=${preset.container}${preset.columns ? `, columns=${preset.columns}` : ""}, surface=${preset.surfaceStyle}`,
    `IMAGES: ${media}`,
  ].join("\n");
}
