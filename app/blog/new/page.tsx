import type { Metadata } from "next";
import { ResourcePostEditor } from "@/components/resources/resource-post-editor";
import { requireResourceAdminPage } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "블로그 글쓰기 — MOLIVE" };

export default async function Page() {
  await requireResourceAdminPage("/blog/new");
  return <ResourcePostEditor board="blog" post={null} />;
}

// 로그인 사용자에 따라 관리자 UI가 달라지므로 정적 캐시를 사용하지 않는다.
export const dynamic = "force-dynamic";
