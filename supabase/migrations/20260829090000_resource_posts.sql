create table public.resource_posts (
  id uuid primary key default gen_random_uuid(),
  board text not null check (board in ('notice', 'template', 'blog', 'resource')),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  summary text check (char_length(summary) <= 300),
  content text check (char_length(content) <= 20000),
  category text check (char_length(category) between 1 and 60),
  brand_color text check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  prompt text check (char_length(prompt) between 1 and 4000),
  image_url text check (char_length(image_url) between 1 and 500),
  author_id uuid references auth.users(id) on delete set null,
  author_email text not null check (char_length(author_email) between 3 and 320),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resource_posts_template_fields check (
    board <> 'template'
    or (category is not null and brand_color is not null and prompt is not null and image_url is not null)
  ),
  constraint resource_posts_article_fields check (
    board = 'template' or char_length(btrim(coalesce(content, ''))) > 0
  )
);

create index resource_posts_board_created_at_idx on public.resource_posts(board, created_at desc);
create index resource_posts_author_id_idx on public.resource_posts(author_id);

alter table public.resource_posts enable row level security;

revoke all on table public.resource_posts from public, anon, authenticated;
grant select on table public.resource_posts to anon, authenticated;
grant insert, update, delete on table public.resource_posts to authenticated;
grant all on table public.resource_posts to service_role;

-- 열람은 모두에게 열려 있고, 등록/수정/삭제는 지정된 관리자 이메일 계정만 가능하다.
create policy resource_posts_select_public
on public.resource_posts
for select
to anon, authenticated
using (true);

create policy resource_posts_insert_admin
on public.resource_posts
for insert
to authenticated
with check (lower(coalesce((select auth.jwt()) ->> 'email', '')) = 'kimts8270@naver.com');

create policy resource_posts_update_admin
on public.resource_posts
for update
to authenticated
using (lower(coalesce((select auth.jwt()) ->> 'email', '')) = 'kimts8270@naver.com')
with check (lower(coalesce((select auth.jwt()) ->> 'email', '')) = 'kimts8270@naver.com');

create policy resource_posts_delete_admin
on public.resource_posts
for delete
to authenticated
using (lower(coalesce((select auth.jwt()) ->> 'email', '')) = 'kimts8270@naver.com');

insert into public.resource_posts (board, title, summary, category, brand_color, prompt, image_url, author_email)
values
  ('template', '포근한 베이비 라이프', '포근하고 부드러운 분위기', '유아동 / 베이비', '#D8C3A9',
   '따뜻한 크림색과 베이지를 중심으로 신뢰감 있고 포근한 베이비 용품 쇼핑몰을 만들어줘. 여백을 넉넉하게 사용하고 부드러운 곡선, 자연광 제품 사진, 선물하기 좋은 상품 큐레이션이 잘 보이게 구성해줘.',
   '/templates/baby.png', 'kimts8270@naver.com'),
  ('template', '컬러풀 키즈 플레이', '밝고 경쾌한 분위기', '유아동 / 키즈', '#F4C84A',
   '아이들의 활기찬 에너지가 느껴지는 키즈 패션 쇼핑몰을 만들어줘. 선명한 포인트 컬러와 발랄한 타이포그래피를 사용하고 신상품, 인기 코디, 연령별 추천 상품을 한눈에 찾을 수 있게 구성해줘.',
   '/templates/kids.png', 'kimts8270@naver.com'),
  ('template', '어반 스트리트 에디트', '대담하고 감각적인 분위기', '패션 / 스트리트', '#171717',
   '도시적이고 대담한 스트리트 패션 브랜드 쇼핑몰을 만들어줘. 블랙과 뉴트럴 컬러를 기반으로 강한 타이포그래피, 룩북형 비주얼, 신상품 드롭과 스타일링 콘텐츠가 돋보이게 구성해줘.',
   '/templates/streetfashion.png', 'kimts8270@naver.com'),
  ('template', '타임리스 주얼리', '정제되고 고급스러운 분위기', '패션잡화 / 주얼리', '#B7A27A',
   '절제된 고급스러움이 느껴지는 데일리 주얼리 쇼핑몰을 만들어줘. 아이보리와 골드 포인트를 사용하고 제품의 디테일이 크게 보이는 사진, 컬렉션 소개, 베스트 상품과 브랜드 스토리가 자연스럽게 이어지게 구성해줘.',
   '/templates/jewelry.png', 'kimts8270@naver.com');
