import { LandingPage } from "@/components/landing/landing-page";
import { hasSupabaseServerConfig, isSupabaseDemoMode, missingSupabaseServerEnv } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function HomePage() {
  const persistenceEnabled = hasSupabaseServerConfig();
  const user = persistenceEnabled ? await getCurrentUser() : null;
  return <LandingPage userEmail={user?.email ?? null} persistenceEnabled={persistenceEnabled} demoMode={isSupabaseDemoMode()} missingEnv={missingSupabaseServerEnv()} />;
}
