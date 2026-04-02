-- Snapshot community post expiry on the job row so freelancers can see when the listing ends
-- even after RLS hides expired rows on community_posts.

alter table public.job_requests
  add column if not exists community_post_expires_at timestamptz;

comment on column public.job_requests.community_post_expires_at is
  'community_posts.expires_at at hire time; shown on incoming requests after the post may no longer be readable via RLS.';

create index if not exists idx_job_requests_community_post_expires_at
  on public.job_requests (community_post_expires_at)
  where community_post_id is not null;

-- Backfill existing “hire from post” jobs where the post still exists
update public.job_requests jr
set community_post_expires_at = cp.expires_at
from public.community_posts cp
where jr.community_post_id = cp.id
  and jr.community_post_expires_at is null;
