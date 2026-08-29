import "server-only";
import { notFound, redirect } from "next/navigation";
import { ApiError, requireApiUser } from "@/lib/api/auth";
import { applicationRoleFromAppMetadata, isResourceAdminEmail } from "@/lib/auth/roles";
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

/** 자료실 게시물 관리 권한. 지정된 관리자 이메일 계정만 통과한다. */
export async function isResourceAdmin() {
  const user = await getCurrentUser();
  return isResourceAdminEmail(user?.email);
}

export async function requireResourceAdminPage(nextPath: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (!isResourceAdminEmail(user.email)) notFound();
  return user;
}

/**
 * 자료실 mutation 전용 인증. requireApiUser의 개발/데모 우회 경로를 쓰지 않고
 * 항상 실제 Supabase 세션의 이메일을 검증한다.
 */
export async function requireResourceAdminApi() {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "로그인이 필요합니다.");
  if (!isResourceAdminEmail(user.email)) throw new ApiError(403, "자료실 게시물은 관리자만 등록·수정할 수 있습니다.");
  return { id: user.id, email: user.email as string };
}
