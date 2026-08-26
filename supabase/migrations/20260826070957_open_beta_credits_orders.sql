create table public.credit_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  reserved integer not null default 0 check (reserved >= 0 and reserved <= balance),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null check (plan_id in ('starter', 'standard', 'studio')),
  amount integer not null check (amount > 0),
  credits integer not null check (credits > 0),
  depositor_name text not null check (char_length(trim(depositor_name)) between 1 and 80),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  payment_provider text not null default 'bank_transfer' check (payment_provider in ('bank_transfer', 'toss')),
  provider_payment_key text,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index orders_provider_payment_key_unique
  on public.orders(payment_provider, provider_payment_key)
  where provider_payment_key is not null;

create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('signup_bonus', 'order_payment', 'manual_grant', 'design_generation', 'editor_ai')),
  amount integer not null check (amount <> 0),
  balance_after integer not null check (balance_after >= 0),
  order_id uuid references public.orders(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  granted_by uuid references auth.users(id) on delete set null,
  reason text,
  idempotency_key text not null unique check (char_length(idempotency_key) between 1 and 200),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index credit_ledger_signup_bonus_once
  on public.credit_ledger(user_id)
  where type = 'signup_bonus';

create unique index credit_ledger_order_payment_once
  on public.credit_ledger(order_id)
  where type = 'order_payment' and order_id is not null;

create table public.credit_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('design_generation', 'editor_ai')),
  amount integer not null check (amount > 0),
  status text not null default 'reserved' check (status in ('reserved', 'committed', 'released')),
  idempotency_key text not null unique check (char_length(idempotency_key) between 1 and 200),
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  resolved_at timestamptz
);

create index orders_user_created_idx on public.orders(user_id, created_at desc);
create index orders_pending_created_idx on public.orders(created_at) where status = 'pending';
create index orders_approved_by_idx on public.orders(approved_by) where approved_by is not null;
create index credit_ledger_user_created_idx on public.credit_ledger(user_id, created_at desc);
create index credit_ledger_order_idx on public.credit_ledger(order_id) where order_id is not null;
create index credit_ledger_project_idx on public.credit_ledger(project_id) where project_id is not null;
create index credit_ledger_granted_by_idx on public.credit_ledger(granted_by) where granted_by is not null;
create index credit_reservations_user_status_idx on public.credit_reservations(user_id, status);
create index credit_reservations_expiry_idx on public.credit_reservations(user_id, expires_at) where status = 'reserved';
create index credit_reservations_project_idx on public.credit_reservations(project_id) where project_id is not null;

alter table public.credit_balances enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.orders enable row level security;
alter table public.credit_reservations enable row level security;

create policy credit_balances_select_own on public.credit_balances
for select to authenticated
using ((select auth.uid()) = user_id);

create policy credit_ledger_select_own on public.credit_ledger
for select to authenticated
using ((select auth.uid()) = user_id);

create policy orders_select_own on public.orders
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.credit_balances, public.credit_ledger, public.orders, public.credit_reservations from public, anon, authenticated;
grant select on public.credit_balances, public.credit_ledger, public.orders to authenticated;
grant all on public.credit_balances, public.credit_ledger, public.orders, public.credit_reservations to service_role;
grant usage, select on sequence public.credit_ledger_id_seq to service_role;

create or replace function private.apply_credit_change(
  p_user_id uuid,
  p_amount integer,
  p_type text,
  p_idempotency_key text,
  p_order_id uuid default null,
  p_project_id uuid default null,
  p_granted_by uuid default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_balance integer;
  current_reserved integer;
  existing_balance integer;
begin
  if p_user_id is null or p_amount = 0 or p_idempotency_key is null then
    raise exception 'INVALID_CREDIT_CHANGE';
  end if;

  insert into public.credit_balances(user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  select balance, reserved into next_balance, current_reserved
  from public.credit_balances
  where user_id = p_user_id
  for update;

  select balance_after into existing_balance
  from public.credit_ledger
  where idempotency_key = p_idempotency_key;
  if found then return existing_balance; end if;

  next_balance := next_balance + p_amount;
  if next_balance < current_reserved then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  insert into public.credit_ledger(
    user_id, type, amount, balance_after, order_id, project_id,
    granted_by, reason, idempotency_key, metadata
  ) values (
    p_user_id, p_type, p_amount, next_balance, p_order_id, p_project_id,
    p_granted_by, nullif(trim(p_reason), ''), p_idempotency_key, coalesce(p_metadata, '{}'::jsonb)
  );

  update public.credit_balances
  set balance = next_balance, updated_at = now()
  where user_id = p_user_id;
  return next_balance;
end;
$$;

revoke all on function private.apply_credit_change(uuid, integer, text, text, uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;

create or replace function private.handle_credit_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform private.apply_credit_change(
      new.id, 15, 'signup_bonus', 'signup_bonus:' || new.id::text,
      null, null, null, '오픈베타 신규 회원 Credit', '{"source":"auth_trigger"}'::jsonb
    );
  exception when others then
    raise warning 'signup bonus grant failed for auth user % (SQLSTATE %): %', new.id, sqlstate, sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function private.handle_credit_signup() from public, anon, authenticated;

create trigger on_auth_user_credit_created
after insert on auth.users
for each row execute function private.handle_credit_signup();

-- Existing authenticated members receive the same one-time open-beta bonus.
select private.apply_credit_change(
  users.id, 15, 'signup_bonus', 'signup_bonus:' || users.id::text,
  null, null, null, '오픈베타 신규 회원 Credit', '{"source":"migration_backfill"}'::jsonb
)
from auth.users as users;

create or replace function public.reserve_credits(
  p_user_id uuid,
  p_amount integer,
  p_type text,
  p_idempotency_key text,
  p_project_id uuid default null
)
returns table(reservation_id uuid, balance integer, available integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_balance integer;
  current_reserved integer;
  created_id uuid;
  reclaimed_amount integer;
  existing public.credit_reservations%rowtype;
begin
  if p_user_id is null or p_amount <= 0 or p_type not in ('design_generation', 'editor_ai') then
    raise exception 'INVALID_CREDIT_RESERVATION';
  end if;

  insert into public.credit_balances(user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  select b.balance, b.reserved into current_balance, current_reserved
  from public.credit_balances as b
  where b.user_id = p_user_id
  for update;

  with reclaimed as (
    update public.credit_reservations
    set status = 'released', resolved_at = now()
    where user_id = p_user_id
      and status = 'reserved'
      and expires_at <= now()
    returning amount
  )
  select coalesce(sum(amount), 0)::integer into reclaimed_amount from reclaimed;

  if reclaimed_amount > 0 then
    update public.credit_balances
    set reserved = reserved - reclaimed_amount, updated_at = now()
    where user_id = p_user_id
    returning reserved into current_reserved;
  end if;

  select * into existing from public.credit_reservations where idempotency_key = p_idempotency_key;
  if found then
    return query select existing.id, current_balance, current_balance - current_reserved;
    return;
  end if;

  if current_balance - current_reserved < p_amount then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  insert into public.credit_reservations(user_id, type, amount, idempotency_key, project_id, expires_at)
  values (p_user_id, p_type, p_amount, p_idempotency_key, p_project_id, now() + interval '30 minutes')
  returning id into created_id;

  update public.credit_balances
  set reserved = reserved + p_amount, updated_at = now()
  where user_id = p_user_id;

  return query select created_id, current_balance, current_balance - current_reserved - p_amount;
end;
$$;

create or replace function public.commit_credit_reservation(
  p_reservation_id uuid,
  p_user_id uuid,
  p_project_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation public.credit_reservations%rowtype;
  next_balance integer;
begin
  select balance into next_balance
  from public.credit_balances
  where user_id = p_user_id
  for update;

  select * into reservation
  from public.credit_reservations
  where id = p_reservation_id and user_id = p_user_id
  for update;
  if not found then raise exception 'CREDIT_RESERVATION_NOT_FOUND'; end if;

  if reservation.status = 'committed' then return next_balance; end if;
  if reservation.status <> 'reserved' then raise exception 'CREDIT_RESERVATION_RELEASED'; end if;
  next_balance := next_balance - reservation.amount;
  if next_balance < 0 then raise exception 'INSUFFICIENT_CREDITS'; end if;

  update public.credit_balances
  set balance = next_balance, reserved = reserved - reservation.amount, updated_at = now()
  where user_id = p_user_id;

  insert into public.credit_ledger(user_id, type, amount, balance_after, project_id, reason, idempotency_key, metadata)
  values (
    p_user_id, reservation.type, -reservation.amount, next_balance,
    coalesce(p_project_id, reservation.project_id),
    case when reservation.type = 'design_generation' then 'AI 디자인 생성' else 'Editor AI 수정' end,
    'reservation:' || reservation.id::text,
    jsonb_build_object('reservation_id', reservation.id)
  );

  update public.credit_reservations
  set status = 'committed', project_id = coalesce(p_project_id, project_id), resolved_at = now()
  where id = reservation.id;
  return next_balance;
end;
$$;

create or replace function public.release_credit_reservation(p_reservation_id uuid, p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation public.credit_reservations%rowtype;
  current_balance integer;
begin
  select balance into current_balance
  from public.credit_balances
  where user_id = p_user_id
  for update;

  select * into reservation
  from public.credit_reservations
  where id = p_reservation_id and user_id = p_user_id
  for update;
  if not found then raise exception 'CREDIT_RESERVATION_NOT_FOUND'; end if;

  if reservation.status = 'reserved' then
    update public.credit_balances
    set reserved = reserved - reservation.amount, updated_at = now()
    where user_id = p_user_id;
    update public.credit_reservations set status = 'released', resolved_at = now() where id = reservation.id;
  end if;
  return current_balance;
end;
$$;

create or replace function public.fulfill_credit_order(
  p_order_id uuid,
  p_approved_by uuid default null,
  p_payment_provider text default 'bank_transfer',
  p_provider_payment_key text default null
)
returns table(order_id uuid, user_id uuid, credited integer, balance integer, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.orders%rowtype;
  next_balance integer;
begin
  select * into target from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if target.status = 'cancelled' then raise exception 'ORDER_CANCELLED'; end if;

  perform private.apply_credit_change(
    target.user_id, target.credits, 'order_payment', 'order:' || target.id::text,
    target.id, null, p_approved_by, target.plan_id || ' Credit 구매',
    jsonb_build_object('payment_provider', p_payment_provider, 'provider_payment_key', p_provider_payment_key)
  );

  select credit_balances.balance into next_balance
  from public.credit_balances as credit_balances
  where credit_balances.user_id = target.user_id;

  if target.status <> 'paid' then
    update public.orders
    set status = 'paid', payment_provider = p_payment_provider,
        provider_payment_key = coalesce(p_provider_payment_key, provider_payment_key),
        approved_by = p_approved_by, paid_at = now(), updated_at = now()
    where id = target.id;
  end if;

  return query select target.id, target.user_id, target.credits, next_balance, 'paid'::text;
end;
$$;

create or replace function public.manual_grant_credits(
  p_user_id uuid,
  p_amount integer,
  p_granted_by uuid,
  p_reason text,
  p_idempotency_key text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_amount <= 0 or char_length(trim(coalesce(p_reason, ''))) < 2 then
    raise exception 'INVALID_MANUAL_GRANT';
  end if;
  return private.apply_credit_change(
    p_user_id, p_amount, 'manual_grant', p_idempotency_key,
    null, null, p_granted_by, p_reason, '{}'::jsonb
  );
end;
$$;

create or replace function public.admin_list_credit_orders(p_status text default 'pending', p_limit integer default 100)
returns table(
  id uuid, user_id uuid, user_email text, plan_id text, amount integer, credits integer,
  depositor_name text, status text, payment_provider text, created_at timestamptz, paid_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select orders.id, orders.user_id, users.email::text, orders.plan_id, orders.amount, orders.credits,
         orders.depositor_name, orders.status, orders.payment_provider, orders.created_at, orders.paid_at
  from public.orders as orders
  join auth.users as users on users.id = orders.user_id
  where p_status is null or orders.status = p_status
  order by orders.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500)
$$;

create or replace function public.admin_search_credit_users(p_query text, p_limit integer default 30)
returns table(user_id uuid, email text, balance integer)
language sql
security definer
set search_path = ''
as $$
  select users.id, users.email::text, coalesce(balances.balance, 0)
  from auth.users as users
  left join public.credit_balances as balances on balances.user_id = users.id
  where users.email ilike '%' || replace(coalesce(p_query, ''), '%', '\%') || '%'
  order by users.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100)
$$;

revoke all on function public.reserve_credits(uuid, integer, text, text, uuid) from public, anon, authenticated;
revoke all on function public.commit_credit_reservation(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.release_credit_reservation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.fulfill_credit_order(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.manual_grant_credits(uuid, integer, uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_list_credit_orders(text, integer) from public, anon, authenticated;
revoke all on function public.admin_search_credit_users(text, integer) from public, anon, authenticated;

grant execute on function public.reserve_credits(uuid, integer, text, text, uuid) to service_role;
grant execute on function public.commit_credit_reservation(uuid, uuid, uuid) to service_role;
grant execute on function public.release_credit_reservation(uuid, uuid) to service_role;
grant execute on function public.fulfill_credit_order(uuid, uuid, text, text) to service_role;
grant execute on function public.manual_grant_credits(uuid, integer, uuid, text, text) to service_role;
grant execute on function public.admin_list_credit_orders(text, integer) to service_role;
grant execute on function public.admin_search_credit_users(text, integer) to service_role;
