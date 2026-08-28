create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null check (char_length(email) between 3 and 320),
  category text not null check (category in ('service', 'billing', 'bug', 'feature', 'other')),
  subject text not null check (char_length(subject) between 1 and 160),
  content text not null check (char_length(content) between 1 and 5000),
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  created_at timestamptz not null default now()
);

create index inquiries_created_at_idx on public.inquiries(created_at desc);
create index inquiries_status_created_at_idx on public.inquiries(status, created_at desc);

alter table public.inquiries enable row level security;

revoke all on table public.inquiries from public, anon, authenticated;
grant insert (user_id, email, category, subject, content) on table public.inquiries to anon, authenticated;
grant select on table public.inquiries to authenticated;
grant update (status) on table public.inquiries to authenticated;
grant all on table public.inquiries to service_role;

create policy inquiries_insert_anonymous
on public.inquiries
for insert
to anon
with check (user_id is null and status = 'pending');

create policy inquiries_insert_authenticated
on public.inquiries
for insert
to authenticated
with check ((select auth.uid()) = user_id and status = 'pending');

create policy inquiries_select_admin
on public.inquiries
for select
to authenticated
using (coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin');

create policy inquiries_update_admin
on public.inquiries
for update
to authenticated
using (coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin')
with check (coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin');
