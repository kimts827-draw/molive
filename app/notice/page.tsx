import type { Metadata } from "next";
import { ResourceEmptyPage } from "@/components/resources/resource-empty-page";

export const metadata: Metadata = { title: "공지사항 — MOLIVE" };

export default function NoticePage() {
  return <ResourceEmptyPage eyebrow="NOTICE" title="공지사항" message="아직 등록된 공지사항이 없습니다." />;
}
