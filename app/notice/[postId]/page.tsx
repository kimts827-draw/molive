import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResourceArticlePage } from "@/components/resources/resource-article-page";
import { isResourceAdmin } from "@/lib/admin/auth";
import { findResourcePost } from "@/lib/resources/service";

export async function generateMetadata({ params }: { params: Promise<{ postId: string }> }): Promise<Metadata> {
  const post = await findResourcePost("notice", (await params).postId);
  return { title: post ? `${post.title} — MOLIVE` : "공지사항 — MOLIVE" };
}

export default async function Page({ params }: { params: Promise<{ postId: string }> }) {
  const [post, canManage] = await Promise.all([findResourcePost("notice", (await params).postId), isResourceAdmin()]);
  if (!post) notFound();
  return <ResourceArticlePage board="notice" post={post} canManage={canManage} />;
}

// 로그인 사용자에 따라 관리자 UI가 달라지므로 정적 캐시를 사용하지 않는다.
export const dynamic = "force-dynamic";
