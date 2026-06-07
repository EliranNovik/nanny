-- AI-generated display copy for posts and open help requests (generated once at create time).

alter table public.profile_posts
  add column if not exists ai_generated_copy jsonb;

comment on column public.profile_posts.ai_generated_copy is
  'One-time AI copy: { title, shortText, feedPreview, tags } — not regenerated on read.';

alter table public.job_requests
  add column if not exists ai_generated_copy jsonb;

comment on column public.job_requests.ai_generated_copy is
  'One-time AI copy for feed/discover cards from structured create-request data.';
