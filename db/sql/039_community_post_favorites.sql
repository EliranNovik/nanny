-- 039_community_post_favorites.sql
-- Users save ("favorite") community posts they want to find again.

create table if not exists public.community_post_favorites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  post_id    uuid not null references public.community_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);

create index if not exists idx_community_post_favorites_user_id
  on public.community_post_favorites (user_id);

create index if not exists idx_community_post_favorites_post_id
  on public.community_post_favorites (post_id);

comment on table public.community_post_favorites is
  'A user bookmarks a public community post (offer).';

alter table public.community_post_favorites enable row level security;

-- Users can read their own saved posts only
create policy "community_post_favorites_select_own"
  on public.community_post_favorites
  for select
  using (user_id = auth.uid());

create policy "community_post_favorites_insert_own"
  on public.community_post_favorites
  for insert
  with check (user_id = auth.uid());

create policy "community_post_favorites_delete_own"
  on public.community_post_favorites
  for delete
  using (user_id = auth.uid());
