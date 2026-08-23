create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  status text not null default 'draft' check (status in ('draft', 'generating', 'ready', 'published', 'archived')),
  brand_brief jsonb not null default '{}'::jsonb,
  current_document jsonb not null default '{}'::jsonb,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('logo', 'product', 'reference', 'font', 'generated')),
  storage_path text not null,
  mime_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (project_id, storage_path)
);

create table public.site_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  label text not null default '자동 저장',
  document_snapshot jsonb not null default '{}'::jsonb,
  source_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.projects
  add constraint projects_current_version_fk
  foreign key (current_version_id) references public.site_versions(id) on delete set null;

create table public.cafe24_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mall_id text not null check (mall_id ~ '^[a-z0-9][a-z0-9_]{1,38}$'),
  shop_no integer not null default 1 check (shop_no > 0),
  scopes text[] not null default '{}',
  status text not null default 'connected' check (status in ('connected', 'expired', 'revoked', 'error')),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, mall_id, shop_no)
);

create table private.cafe24_credentials (
  connection_id uuid primary key references public.cafe24_connections(id) on delete cascade,
  mall_id text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  expires_at timestamptz not null,
  refresh_token_expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table public.deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  connection_id uuid not null references public.cafe24_connections(id) on delete cascade,
  mode text not null check (mode in ('runtime', 'theme')),
  skin_no integer not null check (skin_no > 0),
  status text not null default 'pending' check (status in ('pending', 'deploying', 'active', 'failed', 'rolled_back', 'disabled')),
  external_id text,
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  deployed_at timestamptz
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan_id text not null check (plan_id in ('starter', 'pro')),
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'paused')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  next_billing_at timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  payment_failure_count integer not null default 0 check (payment_failure_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.billing_credentials (
  subscription_id uuid primary key references public.subscriptions(id) on delete cascade,
  customer_key text not null unique,
  billing_key_encrypted text not null,
  billing_key_hash text not null unique,
  card_summary jsonb,
  updated_at timestamptz not null default now()
);

create table public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id text not null unique,
  payment_key text unique,
  amount integer not null check (amount >= 0),
  status text not null,
  approved_at timestamptz,
  failure_code text,
  failure_message text,
  raw_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.usage_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  kind text not null check (kind in ('site_generation', 'section_edit', 'image_generation', 'deployment')),
  units integer not null default 1 check (units > 0),
  model text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.webhook_events (
  id bigint generated always as identity primary key,
  provider text not null,
  external_id text not null,
  event_type text not null,
  payload_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, external_id)
);

create index projects_owner_updated_idx on public.projects(owner_id, updated_at desc);
create index site_versions_project_created_idx on public.site_versions(project_id, created_at desc);
create index deployments_project_created_idx on public.deployments(project_id, created_at desc);
create index subscriptions_due_idx on public.subscriptions(next_billing_at) where status in ('active', 'past_due');
create index billing_payments_user_created_idx on public.billing_payments(user_id, created_at desc);
create index usage_ledger_user_created_idx on public.usage_ledger(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_assets enable row level security;
alter table public.site_versions enable row level security;
alter table public.cafe24_connections enable row level security;
alter table public.deployments enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_payments enable row level security;
alter table public.usage_ledger enable row level security;
alter table public.webhook_events enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy projects_select_own on public.projects for select to authenticated using ((select auth.uid()) = owner_id);
create policy projects_insert_own on public.projects for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy projects_update_own on public.projects for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy projects_delete_own on public.projects for delete to authenticated using ((select auth.uid()) = owner_id);

create policy project_assets_select_own on public.project_assets for select to authenticated using ((select auth.uid()) = owner_id);
create policy project_assets_insert_own on public.project_assets for insert to authenticated with check ((select auth.uid()) = owner_id and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));
create policy project_assets_update_own on public.project_assets for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy project_assets_delete_own on public.project_assets for delete to authenticated using ((select auth.uid()) = owner_id);

create policy site_versions_select_own on public.site_versions for select to authenticated using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));
create policy site_versions_insert_own on public.site_versions for insert to authenticated with check ((select auth.uid()) = created_by and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));

create policy cafe24_connections_select_own on public.cafe24_connections for select to authenticated using ((select auth.uid()) = user_id);
create policy cafe24_connections_insert_own on public.cafe24_connections for insert to authenticated with check ((select auth.uid()) = user_id);
create policy cafe24_connections_update_own on public.cafe24_connections for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy cafe24_connections_delete_own on public.cafe24_connections for delete to authenticated using ((select auth.uid()) = user_id);

create policy deployments_select_own on public.deployments for select to authenticated using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));
create policy deployments_insert_own on public.deployments for insert to authenticated with check ((select auth.uid()) = created_by and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));
create policy deployments_update_own on public.deployments for update to authenticated using ((select auth.uid()) = created_by) with check ((select auth.uid()) = created_by);

create policy subscriptions_select_own on public.subscriptions for select to authenticated using ((select auth.uid()) = user_id);
create policy billing_payments_select_own on public.billing_payments for select to authenticated using ((select auth.uid()) = user_id);
create policy usage_ledger_select_own on public.usage_ledger for select to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.project_assets to authenticated;
grant select, insert on public.site_versions to authenticated;
grant select, insert, update, delete on public.cafe24_connections to authenticated;
grant select, insert, update on public.deployments to authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.billing_payments to authenticated;
grant select on public.usage_ledger to authenticated;

revoke all on public.webhook_events from anon, authenticated;
grant all on all tables in schema private to service_role;
grant usage, select on all sequences in schema public to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-assets', 'project-assets', false, 15728640, array['image/jpeg','image/png','image/webp','image/avif','image/svg+xml','application/pdf'])
on conflict (id) do nothing;

create policy project_asset_objects_select on storage.objects for select to authenticated
using (bucket_id = 'project-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy project_asset_objects_insert on storage.objects for insert to authenticated
with check (bucket_id = 'project-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy project_asset_objects_update on storage.objects for update to authenticated
using (bucket_id = 'project-assets' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'project-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy project_asset_objects_delete on storage.objects for delete to authenticated
using (bucket_id = 'project-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
