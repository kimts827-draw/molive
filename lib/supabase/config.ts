export const SUPABASE_SERVER_ENV_NAMES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
] as const;

export function missingSupabaseServerEnv() {
  return SUPABASE_SERVER_ENV_NAMES.filter((name) => !process.env[name]);
}

export function hasSupabaseServerConfig() {
  return missingSupabaseServerEnv().length === 0;
}

export function isSupabaseDemoMode() {
  return process.env.NODE_ENV !== "production" && missingSupabaseServerEnv().length === SUPABASE_SERVER_ENV_NAMES.length;
}
