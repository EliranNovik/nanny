-- ============================================================
-- 072_profile_post_shares.sql
-- Track profile post share taps (clicks) and distinct sharers.
-- Run in Supabase SQL Editor (or your migration runner).
-- ============================================================

-- ── 1. Event table: one row per share action (tap / completed share) ──
create table if not exists public.profile_post_shares (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.profile_posts(id) on delete cascade,
  -- Logged-in user who shared; null reserved for future anonymous tracking
  user_id    uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists profile_post_shares_post_id_idx
  on public.profile_post_shares(post_id);

create index if not exists profile_post_shares_post_created_idx
  on public.profile_post_shares(post_id, created_at desc);

alter table public.profile_post_shares enable row level security;

-- Public read (for counts on feed cards)
create policy "profile_post_shares_select"
  on public.profile_post_shares
  for select
  using (true);

-- Only authenticated users; row must be for themselves
create policy "profile_post_shares_insert"
  on public.profile_post_shares
  for insert
  with check (
    auth.uid() is not null
    and user_id = auth.uid()
  );

-- ── 2. Batch stats for feed queries (one round-trip) ─────────────
create or replace function public.get_profile_post_share_stats(p_post_ids uuid[])
returns table (
  post_id uuid,
  click_count bigint,
  distinct_user_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    s.post_id,
    count(*)::bigint as click_count,
    count(distinct s.user_id) filter (where s.user_id is not null)::bigint as distinct_user_count
  from public.profile_post_shares s
  where cardinality(p_post_ids) > 0
    and s.post_id = any(p_post_ids)
  group by s.post_id;
$$;

comment on function public.get_profile_post_share_stats(uuid[]) is
  'Aggregated share taps and distinct logged-in sharers per profile post.';

grant execute on function public.get_profile_post_share_stats(uuid[]) to anon, authenticated;
