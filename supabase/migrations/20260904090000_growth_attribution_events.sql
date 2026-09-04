-- 초기 판매 검증용 유입 추적. 어디서 온 방문자가 어느 단계까지 갔는지만 남긴다.
--
-- 유입 정보(utm_*)는 profiles에 둔다. auth.users는 Supabase가 소유하므로 건드리지 않고,
-- 앱이 소유한 프로필 행에 first-touch 값을 한 번만 기록한다. 모두 nullable이며
-- 기존 회원과 UTM 없이 들어온 신규 회원은 null로 남는다.
alter table public.profiles
  add column utm_source text check (utm_source is null or char_length(utm_source) <= 200),
  add column utm_medium text check (utm_medium is null or char_length(utm_medium) <= 200),
  add column utm_campaign text check (utm_campaign is null or char_length(utm_campaign) <= 200),
  add column utm_content text check (utm_content is null or char_length(utm_content) <= 200),
  add column price_group text check (price_group is null or char_length(price_group) <= 60);

comment on column public.profiles.utm_content is
  'First-touch 유입 링크의 몰 일련번호. 아웃리치 발송 대상 역추적에 쓰므로 덮어쓰지 않는다.';
comment on column public.profiles.price_group is
  '가격 실험군. 한 번 배정되면 고정이며 lib/growth/pricing-config.ts가 가격표를 소유한다.';

create index profiles_utm_campaign_idx on public.profiles(utm_campaign) where utm_campaign is not null;

-- event_name + metadata 구조라 새 이벤트는 코드에서 이름만 추가하면 된다.
-- 스키마 변경 없이 늘리기 위해 event_name에 check 제약을 걸지 않는다.
create table public.events (
  id bigint generated always as identity primary key,
  -- 방문 시점에는 사용자가 없다. 가입 후 같은 session_id의 이전 방문에 user_id를 소급 연결한다.
  -- 계정이 지워져도 퍼널 집계가 무너지지 않도록 cascade 대신 set null을 쓴다.
  user_id uuid references auth.users(id) on delete set null,
  session_id text check (session_id is null or char_length(session_id) between 1 and 100),
  event_name text not null check (char_length(event_name) between 1 and 60),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index events_name_created_at_idx on public.events(event_name, created_at desc);
create index events_user_id_idx on public.events(user_id) where user_id is not null;
create index events_session_id_idx on public.events(session_id) where session_id is not null;

alter table public.events enable row level security;

-- 브라우저는 기록만 할 수 있고 읽지 못한다. 집계는 service_role 서버 라우트 전용이다.
revoke all on table public.events from public, anon, authenticated;
grant insert (user_id, session_id, event_name, metadata) on table public.events to anon, authenticated;
grant all on table public.events to service_role;

create policy events_insert_anonymous
on public.events
for insert
to anon
with check (user_id is null);

create policy events_insert_authenticated
on public.events
for insert
to authenticated
with check (user_id is null or user_id = (select auth.uid()));

-- select 정책을 만들지 않는다. anon/authenticated는 어떤 행도 읽을 수 없다.
