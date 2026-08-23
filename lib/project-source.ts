import type { CommerceTokens } from "@/lib/commerce/fixed-components";

export type ProjectArchitecture = {
  header: string;
  hero: string;
  sections: string[];
  productPresentation: string;
  typography: string;
  footer: string;
};

export type ProjectSource = {
  id: string;
  name: string;
  html: string;
  css: string;
  /** 고정 HeaderV1/ProductSectionV1의 스타일 토큰입니다. 구조는 코드가 정합니다. */
  commerce?: CommerceTokens;
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
  return typeof source.id === "string"
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
    updatedAt: "ISO date string",
  } as const;
}
