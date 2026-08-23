import { z } from "zod";
import { isProjectSource, type ProjectSource } from "./project-source.ts";

const identifierSchema = z.string().min(1).max(180).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "식별자 형식이 올바르지 않습니다.");
const componentNameSchema = z.string().min(3).max(120).regex(/^[A-Z][A-Za-z0-9]*V[1-9][0-9]*$/, "컴포넌트 이름은 HeaderV1과 같은 버전 형식이어야 합니다.");
const variantSchema = z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "variant는 kebab-case여야 합니다.");
const tokenIdSchema = z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "토큰 ID는 kebab-case여야 합니다.");
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "색상은 6자리 HEX 형식이어야 합니다.");

export const projectThemeV1Schema = z.object({
  palette: z.object({
    ink: colorSchema,
    muted: colorSchema,
    surface: colorSchema,
    accent: colorSchema,
    border: colorSchema,
  }).strict(),
  typography: z.object({
    heading: tokenIdSchema,
    body: tokenIdSchema,
  }).strict(),
  spacing: z.enum(["compact", "balanced", "airy"]),
  imageRatio: z.enum(["auto", "1:1", "4:5", "3:4", "16:9"]),
}).strict();

const componentSettingValueSchema = z.union([
  z.string().max(10_000),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(z.string().max(500)).max(50),
]);

export const componentSettingV1Schema = z.object({
  scope: z.enum(["content", "style", "data"]),
  key: z.string().min(1).max(120).regex(/^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)*$/, "setting key는 dot notation을 사용해야 합니다."),
  value: componentSettingValueSchema,
}).strict();

export const componentInstanceV1Schema = z.object({
  instanceId: identifierSchema,
  component: componentNameSchema,
  variant: variantSchema,
  settings: z.array(componentSettingV1Schema).max(100),
}).strict().superRefine((instance, context) => {
  const keys = new Set<string>();
  instance.settings.forEach((setting, index) => {
    const scopedKey = `${setting.scope}:${setting.key}`;
    if (keys.has(scopedKey)) {
      context.addIssue({ code: "custom", path: ["settings", index, "key"], message: `중복된 component setting입니다: ${scopedKey}` });
    }
    keys.add(scopedKey);
  });
});

export const projectSpecV1Schema = z.object({
  kind: z.literal("component-spec"),
  schemaVersion: z.literal(1),
  libraryVersion: z.string().min(1).max(40),
  id: identifierSchema,
  name: z.string().trim().min(1).max(120),
  theme: projectThemeV1Schema,
  header: componentInstanceV1Schema,
  sections: z.array(componentInstanceV1Schema).min(1).max(50),
  /** verified Footer가 등록되기 전에는 null로 저장합니다. 필드 자체는 항상 필수입니다. */
  footer: componentInstanceV1Schema.nullable(),
  updatedAt: z.iso.datetime({ offset: true }),
}).strict().superRefine((document, context) => {
  const instances = [
    { instance: document.header, path: ["header", "instanceId"] as (string | number)[] },
    ...document.sections.map((instance, index) => ({ instance, path: ["sections", index, "instanceId"] as (string | number)[] })),
    ...(document.footer ? [{ instance: document.footer, path: ["footer", "instanceId"] as (string | number)[] }] : []),
  ];
  const ids = new Set<string>();
  instances.forEach(({ instance, path }) => {
    if (ids.has(instance.instanceId)) {
      context.addIssue({ code: "custom", path, message: `중복된 component instanceId입니다: ${instance.instanceId}` });
    }
    ids.add(instance.instanceId);
  });
});

/** ProjectSpecV1의 TypeScript 타입과 JSON Schema는 이 Zod schema에서만 파생합니다. */
export type ProjectSpecV1 = z.infer<typeof projectSpecV1Schema>;
export const projectSpecV1JsonSchema = z.toJSONSchema(projectSpecV1Schema, { target: "draft-7" });

/** 기존 ProjectSource는 변환하지 않고 기존 type guard 결과를 그대로 존중합니다. */
export type LegacyProjectSource = ProjectSource;
export const legacyProjectSourceSchema = z.custom<LegacyProjectSource>(isProjectSource, { message: "기존 ProjectSource 형식이 올바르지 않습니다." });

export const projectDocumentSchema = z.union([projectSpecV1Schema, legacyProjectSourceSchema]);
export type ProjectDocument = LegacyProjectSource | ProjectSpecV1;

export function parseProjectDocument(value: unknown): ProjectDocument {
  return projectDocumentSchema.parse(value);
}

export function safeParseProjectDocument(value: unknown) {
  return projectDocumentSchema.safeParse(value);
}

export function isProjectDocument(value: unknown): value is ProjectDocument {
  return safeParseProjectDocument(value).success;
}

export function isProjectSpecV1(value: unknown): value is ProjectSpecV1 {
  return projectSpecV1Schema.safeParse(value).success;
}

export function serializeProjectDocument(value: unknown): string {
  return JSON.stringify(parseProjectDocument(value));
}

export function deserializeProjectDocument(serialized: string): ProjectDocument {
  return parseProjectDocument(JSON.parse(serialized) as unknown);
}
