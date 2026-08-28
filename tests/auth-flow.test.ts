import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { marketingConsentValues, parseProfileUpdate } from "../lib/auth/profile.ts";
import { safeNextPath } from "../lib/auth/redirect.ts";
import { applicationRoleFromAppMetadata } from "../lib/auth/roles.ts";
import { readRememberedEmail, rememberedEmailKey, updateRememberedEmail } from "../lib/auth/remembered-email.ts";

test("safeNextPath keeps local destinations and rejects external redirects", () => {
  assert.equal(safeNextPath("/#create"), "/#create");
  assert.equal(safeNextPath("/editor?project=one"), "/editor?project=one");
  assert.equal(safeNextPath("https://attacker.example"), "/");
  assert.equal(safeNextPath("//attacker.example"), "/");
});

test("marketing consent records grant and withdrawal transitions", () => {
  const now = "2026-08-24T02:00:00.000Z";
  assert.deepEqual(marketingConsentValues(false, true, now), { marketing_consented_at: now, marketing_withdrawn_at: null });
  assert.deepEqual(marketingConsentValues(true, false, now), { marketing_withdrawn_at: now });
  assert.deepEqual(marketingConsentValues(false, false, now), {});
  assert.deepEqual(marketingConsentValues(true, true, now), {});
});

test("profile input keeps login and contact email independent", () => {
  assert.deepEqual(parseProfileUpdate({ displayName: " MOLIVE ", contactEmail: "CONTACT@EXAMPLE.COM", marketingEmailsEnabled: true }), {
    displayName: "MOLIVE",
    contactEmail: "contact@example.com",
    marketingEmailsEnabled: true,
  });
  assert.equal(parseProfileUpdate({ displayName: "MOLIVE", contactEmail: "bad", marketingEmailsEnabled: false }), null);
});

test("admin role is accepted only from server-managed app metadata", () => {
  assert.equal(applicationRoleFromAppMetadata({ role: "admin" }), "admin");
  assert.equal(applicationRoleFromAppMetadata({ role: "user" }), "user");
  assert.equal(applicationRoleFromAppMetadata(undefined), "user");
});

test("login UI uses OAuth and password auth without Magic Link", () => {
  const login = readFileSync(new URL("../components/auth/login-form.tsx", import.meta.url), "utf8");
  assert.match(login, /signInWithOAuth/);
  assert.match(login, /provider, options: \{ redirectTo: callbackUrl\(\) \}/);
  assert.match(login, /signInWithPassword/);
  assert.match(login, /auth\.signUp/);
  assert.doesNotMatch(login, /signInWithOtp/);
});

test("remembered email stores only the normalized email and supports removal", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  updateRememberedEmail(storage, " User@Example.COM ", true);
  assert.equal(values.get(rememberedEmailKey), "user@example.com");
  assert.equal(readRememberedEmail(storage), "user@example.com");
  assert.equal(values.size, 1);
  updateRememberedEmail(storage, "ignored@example.com", false);
  assert.equal(readRememberedEmail(storage), "");
});

test("email save is limited to successful password login", () => {
  const login = readFileSync(new URL("../components/auth/login-form.tsx", import.meta.url), "utf8");
  const passwordLogin = login.indexOf("signInWithPassword");
  const rememberWrite = login.lastIndexOf("updateRememberedEmail");
  const oauthLogin = login.indexOf("signInWithOAuth");
  assert.ok(passwordLogin > oauthLogin);
  assert.ok(rememberWrite > passwordLogin);
  assert.doesNotMatch(readFileSync(new URL("../lib/auth/remembered-email.ts", import.meta.url), "utf8"), /password/i);
});

test("generation prompt survives the OAuth round trip", () => {
  const composer = readFileSync(new URL("../components/landing/prompt-composer.tsx", import.meta.url), "utf8");
  assert.match(composer, /moire:generation-draft/);
  assert.match(composer, /rememberDraft\(\);\s*router\.push\("\/login\?next=%2F"\)/);
  assert.match(composer, /sessionStorage\.getItem\(generationDraftKey\)/);
});

test("home creation entry paths do not persist a hero hash that hides the header", () => {
  const landing = readFileSync(new URL("../components/landing/landing-page.tsx", import.meta.url), "utf8");
  const projects = readFileSync(new URL("../app/projects/page.tsx", import.meta.url), "utf8");
  const editor = readFileSync(new URL("../components/editor/editor-shell.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(landing, /id="create"|%23create|#create/);
  assert.doesNotMatch(projects, /\/#create/);
  assert.doesNotMatch(editor, /\/#create/);
});

test("project ownership RLS remains unchanged by the profile migration", () => {
  const initial = readFileSync(new URL("../supabase/migrations/20260816171138_initial_saas_schema.sql", import.meta.url), "utf8");
  const profileMigration = readFileSync(new URL("../supabase/migrations/20260824022240_extend_auth_profiles.sql", import.meta.url), "utf8");
  assert.match(initial, /projects_select_own[\s\S]*auth\.uid\(\)\) = owner_id/);
  assert.match(initial, /site_versions_select_own[\s\S]*p\.owner_id = \(select auth\.uid\(\)\)/);
  assert.doesNotMatch(profileMigration, /alter table public\.(projects|site_versions)/);
});
