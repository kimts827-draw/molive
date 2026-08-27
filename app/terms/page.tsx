import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";

export const metadata: Metadata = { title: "이용약관 — MOLIVE" };

export default function TermsPage() {
  return <LegalDocument document="terms" pathname="/terms" />;
}
