create index if not exists billing_payments_subscription_idx
  on public.billing_payments(subscription_id);

create index if not exists deployments_connection_idx
  on public.deployments(connection_id);

create index if not exists deployments_created_by_idx
  on public.deployments(created_by);

create index if not exists deployments_version_idx
  on public.deployments(version_id);

create index if not exists project_assets_owner_idx
  on public.project_assets(owner_id);

create index if not exists projects_current_version_idx
  on public.projects(current_version_id);

create index if not exists site_versions_created_by_idx
  on public.site_versions(created_by);

create index if not exists usage_ledger_project_idx
  on public.usage_ledger(project_id);
