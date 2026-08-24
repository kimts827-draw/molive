create table public.openai_usage_events (
  id bigint generated always as identity primary key,
  generation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  model text not null check (char_length(model) between 1 and 120),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  cached_input_tokens bigint not null default 0 check (cached_input_tokens >= 0),
  cache_write_input_tokens bigint not null default 0 check (cache_write_input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  request_count integer not null default 1 check (request_count > 0),
  image_count integer not null default 0 check (image_count >= 0),
  image_cost_usd numeric(18, 8) not null default 0 check (image_cost_usd >= 0),
  estimated_cost_usd numeric(18, 8) not null default 0 check (estimated_cost_usd >= 0),
  pricing_version text not null,
  created_at timestamptz not null default now(),
  check (cached_input_tokens + cache_write_input_tokens <= input_tokens)
);

create index openai_usage_events_created_idx
  on public.openai_usage_events(created_at desc);

create index openai_usage_events_generation_idx
  on public.openai_usage_events(generation_id, created_at);

create index openai_usage_events_user_created_idx
  on public.openai_usage_events(user_id, created_at desc);

create index openai_usage_events_project_idx
  on public.openai_usage_events(project_id)
  where project_id is not null;

alter table public.openai_usage_events enable row level security;

-- Usage data is operational billing data. It is never exposed through an end-user
-- RLS policy; only the server-side service role can write and read it.
revoke all on public.openai_usage_events from public, anon, authenticated;
grant all on public.openai_usage_events to service_role;
grant usage, select on sequence public.openai_usage_events_id_seq to service_role;

create or replace function public.get_admin_openai_usage_summary(
  p_timezone text default 'Asia/Seoul'
)
returns table (
  today_cost_usd numeric,
  month_cost_usd numeric,
  total_generations bigint,
  average_cost_usd numeric,
  highest_cost_usd numeric
)
language sql
stable
set search_path = ''
as $$
  with generation_totals as (
    select
      generation_id,
      min(created_at) as created_at,
      sum(estimated_cost_usd) as cost_usd
    from public.openai_usage_events
    group by generation_id
  )
  select
    coalesce(sum(cost_usd) filter (
      where (created_at at time zone p_timezone)::date = (now() at time zone p_timezone)::date
    ), 0),
    coalesce(sum(cost_usd) filter (
      where date_trunc('month', created_at at time zone p_timezone) = date_trunc('month', now() at time zone p_timezone)
    ), 0),
    count(*)::bigint,
    coalesce(avg(cost_usd), 0),
    coalesce(max(cost_usd), 0)
  from generation_totals;
$$;

create or replace function public.get_admin_recent_openai_usage(
  p_limit integer default 30
)
returns table (
  generation_id uuid,
  user_id uuid,
  project_id uuid,
  model text,
  input_tokens bigint,
  cached_input_tokens bigint,
  output_tokens bigint,
  request_count bigint,
  image_count bigint,
  estimated_cost_usd numeric,
  created_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select
    events.generation_id,
    min(events.user_id::text)::uuid,
    (array_agg(events.project_id) filter (where events.project_id is not null))[1],
    string_agg(distinct events.model, ', ' order by events.model),
    sum(events.input_tokens)::bigint,
    sum(events.cached_input_tokens)::bigint,
    sum(events.output_tokens)::bigint,
    sum(events.request_count)::bigint,
    sum(events.image_count)::bigint,
    sum(events.estimated_cost_usd),
    min(events.created_at)
  from public.openai_usage_events as events
  group by events.generation_id
  order by min(events.created_at) desc
  limit greatest(1, least(p_limit, 100));
$$;

revoke all on function public.get_admin_openai_usage_summary(text) from public, anon, authenticated;
revoke all on function public.get_admin_recent_openai_usage(integer) from public, anon, authenticated;
grant execute on function public.get_admin_openai_usage_summary(text) to service_role;
grant execute on function public.get_admin_recent_openai_usage(integer) to service_role;
