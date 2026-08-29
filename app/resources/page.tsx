import type { Metadata } from "next";
import { ResourceBoardPage } from "@/components/resources/resource-board-page";
import { isResourceAdmin } from "@/lib/admin/auth";
import { listResourcePosts } from "@/lib/resources/service";

export const metadata: Metadata = { title: "자료모음 — MOLIVE" };

export default async function Page() {
  const [posts, canManage] = await Promise.all([listResourcePosts("resource"), isResourceAdmin()]);
  return <ResourceBoardPage board="resource" posts={posts} canManage={canManage} />;
}

// 로그인 사용자에 따라 관리자 UI가 달라지므로 정적 캐시를 사용하지 않는다.
export const dynamic = "force-dynamic";
