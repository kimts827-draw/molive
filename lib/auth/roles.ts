export type ApplicationRole = "admin" | "user";
export type OpenAIUsageActorType = "customer" | "admin";

export function applicationRoleFromAppMetadata(appMetadata: Record<string, unknown> | null | undefined): ApplicationRole {
  return appMetadata?.role === "admin" ? "admin" : "user";
}

export function openAIUsageActorType(appMetadata: Record<string, unknown> | null | undefined): OpenAIUsageActorType {
  return applicationRoleFromAppMetadata(appMetadata) === "admin" ? "admin" : "customer";
}

/** 자료실(공지사항·템플릿·블로그·자료모음) 게시물을 등록·수정할 수 있는 유일한 계정. */
export const RESOURCE_ADMIN_EMAIL = "kimts8270@naver.com";

export function isResourceAdminEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && email.trim().toLowerCase() === RESOURCE_ADMIN_EMAIL;
}
