-- ============================================================
-- 061_profile_posts.sql
-- Profile social posts: posts, likes, comments
-- Run once in Supabase SQL Editor
-- ============================================================

-- ── 1. profile_posts ──────────────────────────────────────
create table if not exists public.profile_posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references public.profiles(id) on delete cascade,
  caption       text,
  media_type    text check (media_type in ('image', 'video')),
  storage_path  text,
  tagged_user_ids uuid[] not null default '{}',
  created_at    timestamptz not null default now()
);

alter table public.profile_posts enable row level security;

-- Anyone can read
create policy "profile_posts_read" on public.profile_posts
  for select using (true);

-- Authenticated users can insert their own posts
create policy "profile_posts_insert" on public.profile_posts
  for insert with check (auth.uid() = author_id);

-- Authors can delete their own posts
create policy "profile_posts_delete" on public.profile_posts
  for delete using (auth.uid() = author_id);

-- ── 2. profile_post_likes ─────────────────────────────────
create table if not exists public.profile_post_likes (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.profile_posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table public.profile_post_likes enable row level security;

-- Anyone can read likes
create policy "profile_post_likes_read" on public.profile_post_likes
  for select using (true);

-- Auth users insert their own like
create policy "profile_post_likes_insert" on public.profile_post_likes
  for insert with check (auth.uid() = user_id);

-- Auth users delete their own like
create policy "profile_post_likes_delete" on public.profile_post_likes
  for delete using (auth.uid() = user_id);

-- ── 3. profile_post_comments ──────────────────────────────
create table if not exists public.profile_post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.profile_posts(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) > 0 and char_length(body) <= 4000),
  created_at timestamptz not null default now()
);

alter table public.profile_post_comments enable row level security;

-- Anyone can read comments
create policy "profile_post_comments_read" on public.profile_post_comments
  for select using (true);

-- Auth users can add comments
create policy "profile_post_comments_insert" on public.profile_post_comments
  for insert with check (auth.uid() = author_id);

-- Authors can delete own comments
create policy "profile_post_comments_delete" on public.profile_post_comments
  for delete using (auth.uid() = author_id);

-- ── 4. Indexes ────────────────────────────────────────────
create index if not exists profile_posts_author_id_idx on public.profile_posts(author_id, created_at desc);
create index if not exists profile_post_likes_post_id_idx on public.profile_post_likes(post_id);
create index if not exists profile_post_comments_post_id_idx on public.profile_post_comments(post_id, created_at asc);
