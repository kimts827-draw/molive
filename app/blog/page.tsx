import type { Metadata } from "next";
import { ResourceEmptyPage } from "@/components/resources/resource-empty-page";

export const metadata: Metadata = { title: "블로그 — MOLIVE" };

export default function BlogPage() {
  return <ResourceEmptyPage eyebrow="BLOG" title="블로그" message="Cafe24와 작은 쇼핑몰 운영에 도움이 되는 글을 준비하고 있습니다." />;
}
