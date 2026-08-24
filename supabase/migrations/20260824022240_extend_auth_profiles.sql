-- auth.users.email remains the login identifier. Contact and consent data live
-- in the user-owned profile so they can evolve independently of authentication.
alter table public.profiles
  add column contact_email text,
  add column marketing_emails_enabled boolean not null default false,
  add column marketing_consented_at timestamptz,
  add column marketing_withdrawn_at timestamptz,
  add constraint profiles_contact_email_length_check
    check (contact_email is null or char_length(contact_email) between 3 and 320),
  add constraint profiles_marketing_consent_check
    check (not marketing_emails_enabled or marketing_consented_at is not null);

comment on column public.profiles.contact_email is
  'Optional contact destination; intentionally independent from auth.users.email.';
comment on column public.profiles.marketing_emails_enabled is
  'Current marketing email consent state.';
comment on column public.profiles.marketing_consented_at is
  'Most recent time marketing email consent was granted.';
comment on column public.profiles.marketing_withdrawn_at is
  'Most recent time an existing marketing email consent was withdrawn.';
