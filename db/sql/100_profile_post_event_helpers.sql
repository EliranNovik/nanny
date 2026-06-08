-- ============================================================
-- 100_profile_post_event_helpers.sql
-- Event helper selection: interest status + helper counts
-- post_metadata.helpers_needed (int) is stored on profile_posts JSONB
-- Run once in Supabase SQL Editor
-- ============================================================

-- Interest status: pending → accepted / declined by event host
alter table public.profile_post_event_join_interests
  add column if not exists status text not null default 'pending';

alter table public.profile_post_event_join_interests
  drop constraint if exists profile_post_event_join_interests_status_check;

alter table public.profile_post_event_join_interests
  add constraint profile_post_event_join_interests_status_check
  check (status in ('pending', 'accepted', 'declined'));

create index if not exists profile_post_event_join_interests_post_status_idx
  on public.profile_post_event_join_interests (post_id, status);

comment on column public.profile_post_event_join_interests.status is
  'pending: user requested to join; accepted/declined: host decision in My events.';

-- Authors may update post_metadata (e.g. helpers_needed) on their own event posts
drop policy if exists "profile_posts_update_own" on public.profile_posts;
create policy "profile_posts_update_own"
  on public.profile_posts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

-- Event host may accept or decline join requests
drop policy if exists "profile_post_event_join_interests_update_author" on public.profile_post_event_join_interests;
create policy "profile_post_event_join_interests_update_author"
  on public.profile_post_event_join_interests for update
  using (
    exists (
      select 1
      from public.profile_posts pp
      where pp.id = profile_post_event_join_interests.post_id
        and pp.author_id = auth.uid()
    )
  )
  with check (
    status in ('pending', 'accepted', 'declined')
    and exists (
      select 1
      from public.profile_posts pp
      where pp.id = profile_post_event_join_interests.post_id
        and pp.author_id = auth.uid()
    )
  );

-- Batch helper counts for event posts (feed badges)
create or replace function public.get_event_post_helper_counts(p_post_ids uuid[])
returns table (
  post_id uuid,
  accepted_count bigint,
  pending_count bigint,
  declined_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.post_id,
    count(*) filter (where i.status = 'accepted')::bigint as accepted_count,
    count(*) filter (where i.status = 'pending')::bigint as pending_count,
    count(*) filter (where i.status = 'declined')::bigint as declined_count
  from public.profile_post_event_join_interests i
  where i.post_id = any(p_post_ids)
  group by i.post_id;
$$;

comment on function public.get_event_post_helper_counts(uuid[]) is
  'Per-event counts of accepted, pending, and declined join interests.';

grant execute on function public.get_event_post_helper_counts(uuid[]) to anon;
grant execute on function public.get_event_post_helper_counts(uuid[]) to authenticated;
grant execute on function public.get_event_post_helper_counts(uuid[]) to service_role;
