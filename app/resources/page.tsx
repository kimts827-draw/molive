import type { Metadata } from "next";
import { ResourceEmptyPage } from "@/components/resources/resource-empty-page";

export const metadata: Metadata = { title: "자료모음 — MOLIVE" };

export default function ResourcesPage() {
  return <ResourceEmptyPage eyebrow="RESOURCES" title="자료모음" message="쇼핑몰 운영에 바로 사용할 수 있는 자료를 준비하고 있습니다." />;
}
