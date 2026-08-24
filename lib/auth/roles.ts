export type ApplicationRole = "admin" | "user";

export function applicationRoleFromAppMetadata(appMetadata: Record<string, unknown> | null | undefined): ApplicationRole {
  return appMetadata?.role === "admin" ? "admin" : "user";
}
