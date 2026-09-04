import { LandingPage } from "@/components/landing/landing-page";
import { GrowthTracker } from "@/components/growth/growth-tracker";
import { priceGroupForUser } from "@/lib/growth/identify";
import { DEFAULT_PRICE_GROUP } from "@/lib/growth/pricing-config";
import { hasSupabaseServerConfig, isSupabaseDemoMode, missingSupabaseServerEnv } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";
import { getCreditBalance } from "@/lib/credits/service";

export default async function HomePage() {
  const persistenceEnabled = hasSupabaseServerConfig();
  const user = persistenceEnabled ? await getCurrentUser() : null;
  const credit = user ? await getCreditBalance(user.id) : null;
  const priceGroup = user ? await priceGroupForUser(user.id) : DEFAULT_PRICE_GROUP;
  return <>
    <GrowthTracker event="visit" />
    <LandingPage userEmail={user?.email ?? null} creditBalance={credit?.available ?? null} persistenceEnabled={persistenceEnabled} demoMode={isSupabaseDemoMode()} missingEnv={missingSupabaseServerEnv()} priceGroup={priceGroup} />
  </>;
}
