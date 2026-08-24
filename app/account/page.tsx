import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { AccountForm } from "@/components/auth/account-form";
import { applicationRoleFromAppMetadata } from "@/lib/auth/roles";
import { hasSupabaseServerConfig } from "@/lib/supabase/config";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export default async function AccountPage() {
  if (!hasSupabaseServerConfig()) redirect("/login?next=%2Faccount");
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Faccount");
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("display_name, contact_email, marketing_emails_enabled").eq("id", user.id).maybeSingle();
  const providers = user.identities?.map((identity) => identity.provider) ?? [];
  const role = applicationRoleFromAppMetadata(user.app_metadata as Record<string, unknown>);

  return <main className="projects-page"><section className="projects-panel account-panel"><header className="projects-header"><Brand /><div><Link href="/projects">내 디자인</Link>{role === "admin" ? <Link href="/admin/usage">OpenAI 사용량</Link> : null}<form action="/auth/signout" method="post"><button type="submit">로그아웃</button></form></div></header><div className="projects-title"><div><span>ACCOUNT</span><h1>계정 설정</h1><p>{role === "admin" ? "관리자 계정 · " : ""}{user.email}</p></div></div><AccountForm loginEmail={user.email ?? ""} initialDisplayName={profile?.display_name ?? ""} initialContactEmail={profile?.contact_email ?? ""} initialMarketingEnabled={profile?.marketing_emails_enabled === true} connectedProviders={providers} /></section></main>;
}
