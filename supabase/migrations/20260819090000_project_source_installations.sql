create table public.cafe24_installations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  connection_id uuid not null references public.cafe24_connections(id) on delete cascade,
  shop_no integer not null default 1 check (shop_no > 0),
  skin_no integer not null check (skin_no > 0),
  script_no bigint,
  status text not null default 'installing' check (status in ('installing', 'active', 'unpublished', 'error')),
  last_error text,
  installed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (connection_id, shop_no, skin_no)
);

update storage.buckets
set public = true
where id = 'project-assets';

alter table public.deployments
  add column installation_id uuid references public.cafe24_installations(id) on delete set null,
  add column version_id uuid references public.site_versions(id) on delete set null;

create index cafe24_installations_project_idx on public.cafe24_installations(project_id);
create index cafe24_installations_connection_idx on public.cafe24_installations(connection_id);
create index deployments_installation_created_idx on public.deployments(installation_id, created_at desc);

alter table public.cafe24_installations enable row level security;

create policy cafe24_installations_select_own on public.cafe24_installations
for select to authenticated
using (exists (
  select 1 from public.projects p
  where p.id = project_id and p.owner_id = (select auth.uid())
));

create policy cafe24_installations_insert_own on public.cafe24_installations
for insert to authenticated
with check (exists (
  select 1 from public.projects p
  where p.id = project_id and p.owner_id = (select auth.uid())
));

create policy cafe24_installations_update_own on public.cafe24_installations
for update to authenticated
using (exists (
  select 1 from public.projects p
  where p.id = project_id and p.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.projects p
  where p.id = project_id and p.owner_id = (select auth.uid())
));

create policy cafe24_installations_delete_own on public.cafe24_installations
for delete to authenticated
using (exists (
  select 1 from public.projects p
  where p.id = project_id and p.owner_id = (select auth.uid())
));

grant select, insert, update, delete on public.cafe24_installations to authenticated;

create or replace function public.create_project_with_version(
  p_owner_id uuid,
  p_name text,
  p_brand_brief jsonb,
  p_source jsonb,
  p_label text default '초기 생성'
)
returns table(project_id uuid, version_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_project_id uuid;
  created_version_id uuid;
begin
  if p_owner_id is null or p_source is null or jsonb_typeof(p_source) <> 'object' then
    raise exception 'invalid project source';
  end if;

  insert into public.projects (owner_id, name, status, brand_brief, current_document)
  values (p_owner_id, left(coalesce(nullif(trim(p_name), ''), '새 쇼핑몰'), 120), 'ready', coalesce(p_brand_brief, '{}'::jsonb), p_source)
  returning id into created_project_id;

  insert into public.site_versions (project_id, label, document_snapshot, source_snapshot, created_by)
  values (created_project_id, left(coalesce(nullif(trim(p_label), ''), '초기 생성'), 120), p_source, p_source, p_owner_id)
  returning id into created_version_id;

  update public.projects
  set current_version_id = created_version_id, updated_at = now()
  where id = created_project_id;

  return query select created_project_id, created_version_id;
end;
$$;

create or replace function public.create_site_version_and_activate(
  p_project_id uuid,
  p_owner_id uuid,
  p_label text,
  p_source jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_version_id uuid;
begin
  if not exists (
    select 1 from public.projects
    where id = p_project_id and owner_id = p_owner_id
  ) then
    raise exception 'project not found';
  end if;

  insert into public.site_versions (project_id, label, document_snapshot, source_snapshot, created_by)
  values (p_project_id, left(coalesce(nullif(trim(p_label), ''), '저장 버전'), 120), p_source, p_source, p_owner_id)
  returning id into created_version_id;

  update public.projects
  set current_document = p_source,
      current_version_id = created_version_id,
      status = case when status = 'published' then status else 'ready' end,
      updated_at = now()
  where id = p_project_id;

  return created_version_id;
end;
$$;

revoke all on function public.create_project_with_version(uuid, text, jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function public.create_site_version_and_activate(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_project_with_version(uuid, text, jsonb, jsonb, text) to service_role;
grant execute on function public.create_site_version_and_activate(uuid, uuid, text, jsonb) to service_role;

create or replace function public.get_cafe24_credential(p_connection_id uuid)
returns table(
  connection_id uuid,
  mall_id text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  expires_at timestamptz,
  refresh_token_expires_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select c.connection_id, c.mall_id, c.access_token_encrypted, c.refresh_token_encrypted, c.expires_at, c.refresh_token_expires_at
  from private.cafe24_credentials c
  where c.connection_id = p_connection_id;
$$;

create or replace function public.upsert_cafe24_credential(
  p_connection_id uuid,
  p_mall_id text,
  p_access_token_encrypted text,
  p_refresh_token_encrypted text,
  p_expires_at timestamptz,
  p_refresh_token_expires_at timestamptz
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.cafe24_credentials (
    connection_id, mall_id, access_token_encrypted, refresh_token_encrypted, expires_at, refresh_token_expires_at, updated_at
  ) values (
    p_connection_id, p_mall_id, p_access_token_encrypted, p_refresh_token_encrypted, p_expires_at, p_refresh_token_expires_at, now()
  )
  on conflict (connection_id) do update set
    mall_id = excluded.mall_id,
    access_token_encrypted = excluded.access_token_encrypted,
    refresh_token_encrypted = excluded.refresh_token_encrypted,
    expires_at = excluded.expires_at,
    refresh_token_expires_at = excluded.refresh_token_expires_at,
    updated_at = now();
$$;

revoke all on function public.get_cafe24_credential(uuid) from public, anon, authenticated;
revoke all on function public.upsert_cafe24_credential(uuid, text, text, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.get_cafe24_credential(uuid) to service_role;
grant execute on function public.upsert_cafe24_credential(uuid, text, text, text, timestamptz, timestamptz) to service_role;
