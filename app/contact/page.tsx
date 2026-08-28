import type { Metadata } from "next";
import { ContactDirect } from "@/components/contact/contact-direct";
import { ContactForm } from "@/components/contact/contact-form";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { hasSupabaseServerConfig } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "문의 — MOLIVE",
  description: "MOLIVE 서비스, 결제, 오류 및 기능 문의",
};

export default async function ContactPage() {
  const user = await getCurrentUser();

  return <main className="marketing-shell contact-page">
    <SiteHeader userEmail={user?.email ?? null} persistenceEnabled={hasSupabaseServerConfig()} loginNext="/contact" />
    <section className="contact-shell">
      <header className="contact-hero"><span>PRIVATE SUPPORT</span><h1>무엇을 도와드릴까요?</h1><p>문의 내용을 남겨주시면 확인 후 이메일로 답변드릴게요.</p></header>
      <div className="contact-card"><ContactForm initialEmail={user?.email ?? ""} /></div>
      <ContactDirect />
    </section>
    <SiteFooter />
  </main>;
}
