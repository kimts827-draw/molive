import type { Metadata } from "next";
import { ResourcePostEditor } from "@/components/resources/resource-post-editor";
import { requireResourceAdminPage } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "자료모음 글쓰기 — MOLIVE" };

export default async function Page() {
  await requireResourceAdminPage("/resources/new");
  return <ResourcePostEditor board="resource" post={null} />;
}

// 로그인 사용자에 따라 관리자 UI가 달라지므로 정적 캐시를 사용하지 않는다.
export const dynamic = "force-dynamic";
