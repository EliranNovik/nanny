-- ============================================================
-- 091_profile_post_event_join_interests.sql
-- Users who tap "I want to join" on event profile posts
-- Run once in Supabase SQL Editor
-- ============================================================

create table if not exists public.profile_post_event_join_interests (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.profile_posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists profile_post_event_join_interests_post_id_idx
  on public.profile_post_event_join_interests (post_id, created_at desc);

create index if not exists profile_post_event_join_interests_user_id_idx
  on public.profile_post_event_join_interests (user_id, created_at desc);

comment on table public.profile_post_event_join_interests is
  'Interest records when a user taps I want to join on an event post.';

alter table public.profile_post_event_join_interests enable row level security;

drop policy if exists "profile_post_event_join_interests_read_own" on public.profile_post_event_join_interests;
create policy "profile_post_event_join_interests_read_own"
  on public.profile_post_event_join_interests for select
  using (auth.uid() = user_id);

drop policy if exists "profile_post_event_join_interests_read_post_author" on public.profile_post_event_join_interests;
create policy "profile_post_event_join_interests_read_post_author"
  on public.profile_post_event_join_interests for select
  using (
    exists (
      select 1
      from public.profile_posts pp
      where pp.id = profile_post_event_join_interests.post_id
        and pp.author_id = auth.uid()
    )
  );

drop policy if exists "profile_post_event_join_interests_insert_own" on public.profile_post_event_join_interests;
create policy "profile_post_event_join_interests_insert_own"
  on public.profile_post_event_join_interests for insert
  with check (
    auth.uid() = user_id
    and not exists (
      select 1
      from public.profile_posts pp
      where pp.id = post_id
        and pp.author_id = auth.uid()
    )
  );

drop policy if exists "profile_post_event_join_interests_delete_own" on public.profile_post_event_join_interests;
create policy "profile_post_event_join_interests_delete_own"
  on public.profile_post_event_join_interests for delete
  using (auth.uid() = user_id);
