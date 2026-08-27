import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";

export const metadata: Metadata = { title: "결제 및 환불 안내 — MOLIVE" };

export default function RefundPage() {
  return <LegalDocument document="refund" pathname="/refund" />;
}
