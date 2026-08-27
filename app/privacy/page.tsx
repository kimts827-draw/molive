import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";

export const metadata: Metadata = { title: "개인정보처리방침 — MOLIVE" };

export default function PrivacyPage() {
  return <LegalDocument document="privacy" pathname="/privacy" />;
}
