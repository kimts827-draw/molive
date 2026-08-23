-- Defense in depth for credentials that are already isolated from the Data API.
-- Service-role operations continue to bypass RLS; no client-facing policies exist.
alter table private.cafe24_credentials enable row level security;
alter table private.billing_credentials enable row level security;
