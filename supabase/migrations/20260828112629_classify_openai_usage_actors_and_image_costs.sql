alter table public.openai_usage_events
  add column actor_type text not null default 'customer'
    check (actor_type in ('customer', 'admin')),
  add column text_input_tokens bigint not null default 0 check (text_input_tokens >= 0),
  add column cached_text_input_tokens bigint not null default 0 check (cached_text_input_tokens >= 0),
  add column image_input_tokens bigint not null default 0 check (image_input_tokens >= 0),
  add column cached_image_input_tokens bigint not null default 0 check (cached_image_input_tokens >= 0),
  add column image_output_tokens bigint not null default 0 check (image_output_tokens >= 0),
  add constraint openai_usage_events_cached_text_tokens_check
    check (cached_text_input_tokens <= text_input_tokens),
  add constraint openai_usage_events_cached_image_tokens_check
    check (cached_image_input_tokens <= image_input_tokens);

create index openai_usage_events_actor_created_idx
  on public.openai_usage_events(actor_type, created_at desc);

comment on column public.openai_usage_events.image_cost_usd is
  'Estimated image-endpoint cost derived from response usage tokens and pricing_version; not an OpenAI invoice amount.';

comment on column public.openai_usage_events.estimated_cost_usd is
  'Estimated total cost derived from response usage tokens and pricing_version; not an OpenAI invoice amount.';

drop function public.get_admin_openai_usage_summary(text);

create function public.get_admin_openai_usage_summary(
  p_timezone text default 'Asia/Seoul'
)
returns table (
  today_cost_usd numeric,
  month_cost_usd numeric,
  total_cost_usd numeric,
  customer_cost_usd numeric,
  admin_cost_usd numeric,
  total_generations bigint,
  average_cost_usd numeric,
  highest_cost_usd numeric
)
language sql
stable
set search_path = ''
as $$
  with all_costs as (
    select
      coalesce(sum(estimated_cost_usd) filter (
        where (created_at at time zone p_timezone)::date = (now() at time zone p_timezone)::date
      ), 0) as today_cost_usd,
      coalesce(sum(estimated_cost_usd) filter (
        where date_trunc('month', created_at at time zone p_timezone) = date_trunc('month', now() at time zone p_timezone)
      ), 0) as month_cost_usd,
      coalesce(sum(estimated_cost_usd), 0) as total_cost_usd,
      coalesce(sum(estimated_cost_usd) filter (where actor_type = 'customer'), 0) as customer_cost_usd,
      coalesce(sum(estimated_cost_usd) filter (where actor_type = 'admin'), 0) as admin_cost_usd
    from public.openai_usage_events
  ),
  design_generation_ids as (
    select distinct generation_id
    from public.openai_usage_events
    where usage_type = 'design_generation'
  ),
  generation_totals as (
    select events.generation_id, sum(events.estimated_cost_usd) as cost_usd
    from public.openai_usage_events as events
    join design_generation_ids using (generation_id)
    group by events.generation_id
  )
  select
    all_costs.today_cost_usd,
    all_costs.month_cost_usd,
    all_costs.total_cost_usd,
    all_costs.customer_cost_usd,
    all_costs.admin_cost_usd,
    count(generation_totals.generation_id)::bigint,
    coalesce(avg(generation_totals.cost_usd), 0),
    coalesce(max(generation_totals.cost_usd), 0)
  from all_costs
  left join generation_totals on true
  group by
    all_costs.today_cost_usd,
    all_costs.month_cost_usd,
    all_costs.total_cost_usd,
    all_costs.customer_cost_usd,
    all_costs.admin_cost_usd;
$$;

drop function public.get_admin_recent_openai_usage(integer);

create function public.get_admin_recent_openai_usage(
  p_limit integer default 30
)
returns table (
  generation_id uuid,
  usage_type text,
  actor_type text,
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
    events.usage_type,
    events.actor_type,
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
  group by events.generation_id, events.usage_type, events.actor_type
  order by min(events.created_at) desc
  limit greatest(1, least(p_limit, 100));
$$;

revoke all on function public.get_admin_openai_usage_summary(text) from public, anon, authenticated;
revoke all on function public.get_admin_recent_openai_usage(integer) from public, anon, authenticated;
grant execute on function public.get_admin_openai_usage_summary(text) to service_role;
grant execute on function public.get_admin_recent_openai_usage(integer) to service_role;
