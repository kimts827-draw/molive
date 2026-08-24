import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { hasSupabaseServerConfig, missingSupabaseServerEnv } from "@/lib/supabase/config";

export default function LoginPage() {
  const enabled = hasSupabaseServerConfig();
  return <Suspense fallback={<main className="auth-page" />}><LoginForm enabled={enabled} missingEnv={missingSupabaseServerEnv()} /></Suspense>;
}
