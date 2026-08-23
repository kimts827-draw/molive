-- Supabase projects may provision broad default table grants. Keep the Data API
-- surface explicit so RLS is defense-in-depth rather than the only boundary.
revoke all on all tables in schema public from anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.project_assets to authenticated;
grant select, insert on public.site_versions to authenticated;
grant select, insert, update, delete on public.cafe24_connections to authenticated;
grant select, insert, update on public.deployments to authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.billing_payments to authenticated;
grant select on public.usage_ledger to authenticated;
grant select, insert, update, delete on public.cafe24_installations to authenticated;

-- Require future public tables to opt into Data API access deliberately.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
