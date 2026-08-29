import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResourcePostEditor } from "@/components/resources/resource-post-editor";
import { requireResourceAdminPage } from "@/lib/admin/auth";
import { findResourcePost } from "@/lib/resources/service";

export const metadata: Metadata = { title: "자료모음 수정 — MOLIVE" };

export default async function Page({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  await requireResourceAdminPage(`/resources/${postId}/edit`);
  const post = await findResourcePost("resource", postId);
  if (!post) notFound();
  return <ResourcePostEditor board="resource" post={post} />;
}

// 로그인 사용자에 따라 관리자 UI가 달라지므로 정적 캐시를 사용하지 않는다.
export const dynamic = "force-dynamic";
