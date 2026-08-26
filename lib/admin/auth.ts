import "server-only";
import { notFound, redirect } from "next/navigation";
import { ApiError, requireApiUser } from "@/lib/api/auth";
import { applicationRoleFromAppMetadata } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/supabase/server";

export async function requireAdminPage(nextPath: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (applicationRoleFromAppMetadata(user.app_metadata as Record<string, unknown>) !== "admin") notFound();
  return user;
}

export async function requireAdminApi(request: Request) {
  const user = await requireApiUser(request);
  const appMetadata = "app_metadata" in user ? user.app_metadata as Record<string, unknown> : null;
  if (applicationRoleFromAppMetadata(appMetadata) !== "admin") throw new ApiError(403, "관리자 권한이 필요합니다.");
  return user;
}
