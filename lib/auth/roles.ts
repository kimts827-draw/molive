export type ApplicationRole = "admin" | "user";
export type OpenAIUsageActorType = "customer" | "admin";

export function applicationRoleFromAppMetadata(appMetadata: Record<string, unknown> | null | undefined): ApplicationRole {
  return appMetadata?.role === "admin" ? "admin" : "user";
}

export function openAIUsageActorType(appMetadata: Record<string, unknown> | null | undefined): OpenAIUsageActorType {
  return applicationRoleFromAppMetadata(appMetadata) === "admin" ? "admin" : "customer";
}
