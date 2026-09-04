import type { SupabaseClient, User } from "@supabase/supabase-js";

export type ProfilePreferences = {
  displayName?: string | null;
  contactEmail?: string | null;
  marketingEmailsEnabled?: boolean;
};

export type ProfileUpdate = {
  displayName: string;
  contactEmail: string | null;
  marketingEmailsEnabled: boolean;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseProfileUpdate(input: unknown): ProfileUpdate | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  const displayName = typeof value.displayName === "string" ? value.displayName.trim() : "";
  const contactEmail = typeof value.contactEmail === "string" ? value.contactEmail.trim().toLowerCase() : "";
  if (!displayName || displayName.length > 80 || (contactEmail && (!emailPattern.test(contactEmail) || contactEmail.length > 320))) return null;
  if (typeof value.marketingEmailsEnabled !== "boolean") return null;
  return { displayName, contactEmail: contactEmail || null, marketingEmailsEnabled: value.marketingEmailsEnabled };
}

export function marketingConsentValues(previous: boolean, next: boolean, now: string) {
  if (next && !previous) return { marketing_consented_at: now, marketing_withdrawn_at: null };
  if (!next && previous) return { marketing_withdrawn_at: now };
  return {};
}

function userDisplayName(user: User) {
  const metadata = user.user_metadata as Record<string, unknown>;
  const candidate = metadata.display_name ?? metadata.full_name ?? metadata.name;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim().slice(0, 80) : null;
}

function userAvatarUrl(user: User) {
  const metadata = user.user_metadata as Record<string, unknown>;
  const candidate = metadata.avatar_url ?? metadata.picture;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

function signupPreferences(user: User): ProfilePreferences {
  const metadata = user.user_metadata as Record<string, unknown>;
  return {
    displayName: typeof metadata.profile_display_name === "string" ? metadata.profile_display_name : null,
    contactEmail: typeof metadata.profile_contact_email === "string" ? metadata.profile_contact_email : null,
    marketingEmailsEnabled: metadata.profile_marketing_opt_in === true,
  };
}

/** 프로필 행을 처음 만들었는지 돌려준다. 신규 가입 시점을 아는 유일한 지점이다. */
export async function ensureUserProfile(supabase: SupabaseClient, user: User, preferences?: ProfilePreferences): Promise<boolean> {
  const { data: current, error: readError } = await supabase
    .from("profiles")
    .select("id, marketing_emails_enabled")
    .eq("id", user.id)
    .maybeSingle();
  if (readError) throw readError;
  if (current) return false;

  const requested = preferences ?? signupPreferences(user);
  const marketingEnabled = requested.marketingEmailsEnabled === true;
  const now = new Date().toISOString();
  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    display_name: requested.displayName?.trim().slice(0, 80) || userDisplayName(user),
    avatar_url: userAvatarUrl(user),
    contact_email: requested.contactEmail?.trim().toLowerCase() || null,
    marketing_emails_enabled: marketingEnabled,
    marketing_consented_at: marketingEnabled ? now : null,
    marketing_withdrawn_at: null,
  });
  if (error) throw error;
  return true;
}
