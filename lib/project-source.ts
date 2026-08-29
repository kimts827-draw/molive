import { isPreviewProductMock, type PreviewProductMock } from "./component-library/preview-mock.ts";
import { pagePlanSchema, type PagePlan } from "./design-library/page-plan.ts";
import type { CommerceTokens } from "@/lib/commerce/fixed-components";

export type ProjectArchitecture = {
  header: string;
  hero: string;
  sections: string[];
  productPresentation: string;
  typography: string;
  footer: string;
};

export type ProjectHeaderPresentation = {
  logo: {
    mode: "text" | "image";
    text?: string;
    imageUrl?: string;
    textSize?: number;
    imageHeight?: number;
    fontFamily?: string;
    lineHeight?: number;
    letterSpacing?: number;
    fontWeight?: number;
  };
  announcement: {
    visible: boolean;
    text: string;
    href?: string;
    backgroundColor: string;
    textColor: string;
    height: number;
  };
};

export type ProjectSource = {
  id: string;
  /** Header wordmark에 쓰는 고객 노출 브랜드명입니다. Project/디자인 제목인 name과 구분합니다. */
  brandName?: string;
  name: string;
  html: string;
  css: string;
  /** 고정 HeaderV1/ProductSectionV1의 스타일 토큰입니다. 구조는 코드가 정합니다. */
  commerce?: CommerceTokens;
  /** 고정 HeaderV1의 로고와 Header 위 독립 Announcement Bar 표시 설정입니다. */
  headerPresentation?: ProjectHeaderPresentation;
  /** 고정 HeaderV1의 텍스트 로고·카테고리·유틸 텍스트와 아이콘 색상입니다. */
  headerTextTone?: "dark" | "light";
  /**
   * Editor Preview 상품 카드에만 쓰는 이번 생성의 mock입니다.
   * Cafe24 export는 이 값을 무시하고 실제 상품 binding을 내보냅니다.
   */
  previewProducts?: PreviewProductMock[];
  /**
   * 이번 프로젝트 본문의 구성 계획입니다. 어떤 섹션을 몇 개, 어떤 순서와 variant로
   * 둘지를 AI가 정한 결과이며, 프로젝트 데이터의 일부로 저장·복구·Export됩니다.
   * 이 필드가 없는 기존 프로젝트는 legacy architecture만으로 그대로 동작합니다.
   */
  pagePlan?: PagePlan;
  architecture: ProjectArchitecture;
  updatedAt: string;
};

export type EditorNodeSelection = {
  id: string;
  type: string;
  tagName: string;
};

export function isProjectSource(value: unknown): value is ProjectSource {
  if (!value || typeof value !== "object") return false;
  const source = value as Partial<ProjectSource>;
  const architecture = source.architecture as Partial<ProjectArchitecture> | undefined;
  const previewProducts = source.previewProducts;
  const headerPresentation = source.headerPresentation as Partial<ProjectHeaderPresentation> | undefined;
  const logo = headerPresentation?.logo as Partial<ProjectHeaderPresentation["logo"]> | undefined;
  const announcement = headerPresentation?.announcement as Partial<ProjectHeaderPresentation["announcement"]> | undefined;
  if (previewProducts !== undefined && (!Array.isArray(previewProducts) || !previewProducts.every(isPreviewProductMock))) return false;
  // pagePlan은 있으면 객체여야 한다는 최소 조건만 봅니다. 형식이 어긋난 plan 때문에
  // 기존 프로젝트가 통째로 열리지 않는 것을 막고, 실제 해석은 projectPagePlan()이 합니다.
  if (source.pagePlan !== undefined && (typeof source.pagePlan !== "object" || source.pagePlan === null)) return false;
  if (headerPresentation !== undefined && (
    !logo || !announcement
    || (logo.mode !== "text" && logo.mode !== "image")
    || (logo.text !== undefined && typeof logo.text !== "string")
    || (logo.imageUrl !== undefined && typeof logo.imageUrl !== "string")
    || (logo.textSize !== undefined && typeof logo.textSize !== "number")
    || (logo.imageHeight !== undefined && typeof logo.imageHeight !== "number")
    || (logo.fontFamily !== undefined && typeof logo.fontFamily !== "string")
    || (logo.lineHeight !== undefined && typeof logo.lineHeight !== "number")
    || (logo.letterSpacing !== undefined && typeof logo.letterSpacing !== "number")
    || (logo.fontWeight !== undefined && typeof logo.fontWeight !== "number")
    || typeof announcement.visible !== "boolean"
    || typeof announcement.text !== "string"
    || (announcement.href !== undefined && typeof announcement.href !== "string")
    || typeof announcement.backgroundColor !== "string"
    || typeof announcement.textColor !== "string"
    || typeof announcement.height !== "number"
  )) return false;
  return typeof source.id === "string"
    && (source.brandName === undefined || typeof source.brandName === "string")
    && (source.headerTextTone === undefined || source.headerTextTone === "dark" || source.headerTextTone === "light")
    && typeof source.name === "string"
    && typeof source.html === "string"
    && typeof source.css === "string"
    && typeof source.updatedAt === "string"
    && Boolean(architecture)
    && typeof architecture?.header === "string"
    && typeof architecture?.hero === "string"
    && Array.isArray(architecture?.sections)
    && architecture.sections.every((item) => typeof item === "string")
    && typeof architecture?.productPresentation === "string"
    && typeof architecture?.typography === "string"
    && typeof architecture?.footer === "string";
}

/**
 * 저장된 page plan을 안전하게 읽습니다.
 * 형식이 어긋났거나 아직 plan이 없는 기존 프로젝트에서는 null을 돌려주고,
 * 호출부는 legacy architecture 경로를 그대로 씁니다.
 */
export function projectPagePlan(source: { pagePlan?: unknown } | null | undefined): PagePlan | null {
  if (!source?.pagePlan) return null;
  const parsed = pagePlanSchema.safeParse(source.pagePlan);
  return parsed.success ? parsed.data : null;
}

export function cloneProjectSource(source: ProjectSource): ProjectSource {
  return structuredClone(source);
}

export function projectSourceSchemaShape() {
  return {
    id: "string",
    brandName: "optional string",
    name: "string",
    html: "string",
    css: "string",
    architecture: {
      header: "string",
      hero: "string",
      sections: ["string"],
      productPresentation: "string",
      typography: "string",
      footer: "string",
    },
    previewProducts: "optional [{ name: string, image: string }] (Preview 전용 mock)",
    pagePlan: "optional Page Composition (본문 섹션 종류·순서·variant·시각 축)",
    headerPresentation: "optional fixed Header logo and announcement presentation",
    headerTextTone: "optional dark | light Header text and icon tone",
    updatedAt: "ISO date string",
  } as const;
}
