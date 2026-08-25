import { isPreviewProductMock, type PreviewProductMock } from "./component-library/preview-mock.ts";
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
    textColor?: string;
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
  /**
   * Editor Preview 상품 카드에만 쓰는 이번 생성의 mock입니다.
   * Cafe24 export는 이 값을 무시하고 실제 상품 binding을 내보냅니다.
   */
  previewProducts?: PreviewProductMock[];
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
    || (logo.textColor !== undefined && typeof logo.textColor !== "string")
    || typeof announcement.visible !== "boolean"
    || typeof announcement.text !== "string"
    || (announcement.href !== undefined && typeof announcement.href !== "string")
    || typeof announcement.backgroundColor !== "string"
    || typeof announcement.textColor !== "string"
    || typeof announcement.height !== "number"
  )) return false;
  return typeof source.id === "string"
    && (source.brandName === undefined || typeof source.brandName === "string")
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
    headerPresentation: "optional fixed Header logo and announcement presentation",
    updatedAt: "ISO date string",
  } as const;
}
