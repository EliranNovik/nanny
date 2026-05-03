-- 073_public_profile_performance.sql
-- Indexes + RPC for faster public profile + ProfilePostsFeed loads.
-- Run in Supabase SQL Editor (or migrate). Safe to re-run (IF NOT EXISTS / OR REPLACE).

-- ── Batch like + comment counts for many profile posts (replaces N+1 head counts) ──
create or replace function public.get_profile_post_engagement_counts(p_post_ids uuid[])
returns table (
  post_id uuid,
  like_count bigint,
  comment_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.pid as post_id,
    coalesce(lc.cnt, 0)::bigint as like_count,
    coalesce(cc.cnt, 0)::bigint as comment_count
  from unnest(p_post_ids) as u(pid)
  left join (
    select pl.post_id, count(*)::bigint as cnt
    from public.profile_post_likes pl
    where pl.post_id = any(p_post_ids)
    group by pl.post_id
  ) lc on lc.post_id = u.pid
  left join (
    select pc.post_id, count(*)::bigint as cnt
    from public.profile_post_comments pc
    where pc.post_id = any(p_post_ids)
    group by pc.post_id
  ) cc on cc.post_id = u.pid;
$$;

comment on function public.get_profile_post_engagement_counts(uuid[]) is
  'Returns per-post like_count and comment_count for ProfilePostsFeed (single round-trip vs N head queries).';

grant execute on function public.get_profile_post_engagement_counts(uuid[]) to authenticated;
grant execute on function public.get_profile_post_engagement_counts(uuid[]) to service_role;

-- ── Reviews shown on public profile: filter by reviewee + sort by date ──
create index if not exists idx_job_reviews_reviewee_created
  on public.job_reviews (reviewee_id, created_at desc);

-- ── Shared jobs between viewer and profile (both directions) ──
create index if not exists idx_job_requests_client_selected_created
  on public.job_requests (client_id, selected_freelancer_id, created_at desc);

create index if not exists idx_job_requests_selected_client_created
  on public.job_requests (selected_freelancer_id, client_id, created_at desc);

-- ── Client “posted help” strip on public profile ──
create index if not exists idx_job_requests_client_status_created
  on public.job_requests (client_id, status, created_at desc);

-- ── Weekly live-help badge RPC: completed rows by helper + updated_at window ──
create index if not exists idx_job_requests_helper_completed_updated
  on public.job_requests (selected_freelancer_id, updated_at desc)
  where status = 'completed' and selected_freelancer_id is not null;

-- ── Pending helper notifications (public profile merges into shared jobs) ──
create index if not exists idx_job_candidate_notifications_freelancer_status_created
  on public.job_candidate_notifications (freelancer_id, status, created_at desc);

-- ── Community availability rows for one author (ProfilePostsFeed + PublicProfilePage) ──
create index if not exists idx_community_posts_author_status_expires
  on public.community_posts (author_id, status, expires_at desc, created_at desc);

-- ── Helper chat stats RPC: messages ordered per conversation ──
create index if not exists idx_messages_conversation_created
  on public.messages (conversation_id, created_at);

-- ── Conversations looked up by freelancer (helper stats RPC CTE) ──
create index if not exists idx_conversations_freelancer_id
  on public.conversations (freelancer_id)
  where freelancer_id is not null;

-- Note: DM-style rows (job_id is null) are already covered by idx_conversations_admin in 019_admin_reports.sql.
