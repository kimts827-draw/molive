import type { Metadata } from "next";
import { TemplateBoard } from "@/components/resources/template-board";
import { isResourceAdmin } from "@/lib/admin/auth";
import { listResourcePosts } from "@/lib/resources/service";

export const metadata: Metadata = {
  title: "템플릿 — MOLIVE",
  description: "MOLIVE 쇼핑몰 템플릿의 이미지, 브랜드 컬러와 생성 프롬프트를 확인하세요.",
};

export default async function TemplatesPage() {
  const [templates, canManage] = await Promise.all([listResourcePosts("template"), isResourceAdmin()]);
  return <TemplateBoard templates={templates} canManage={canManage} />;
}

// 로그인 사용자에 따라 관리자 UI가 달라지므로 정적 캐시를 사용하지 않는다.
export const dynamic = "force-dynamic";
