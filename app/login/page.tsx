import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { hasSupabaseServerConfig, missingSupabaseServerEnv } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { redirect } from "next/navigation";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const enabled = hasSupabaseServerConfig();
  const next = safeNextPath((await searchParams).next);
  if (enabled && await getCurrentUser()) redirect(next);
  return <Suspense fallback={<main className="auth-page" />}><LoginForm enabled={enabled} missingEnv={missingSupabaseServerEnv()} /></Suspense>;
}
