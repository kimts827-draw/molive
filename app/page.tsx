import { LandingPage } from "@/components/landing/landing-page";
import { hasSupabaseServerConfig, isSupabaseDemoMode, missingSupabaseServerEnv } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";
import { getCreditBalance } from "@/lib/credits/service";

export default async function HomePage() {
  const persistenceEnabled = hasSupabaseServerConfig();
  const user = persistenceEnabled ? await getCurrentUser() : null;
  const credit = user ? await getCreditBalance(user.id) : null;
  return <LandingPage userEmail={user?.email ?? null} creditBalance={credit?.available ?? null} persistenceEnabled={persistenceEnabled} demoMode={isSupabaseDemoMode()} missingEnv={missingSupabaseServerEnv()} />;
}
