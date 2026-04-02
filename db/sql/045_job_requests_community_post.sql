-- Link a job request back to the community availability post that started the hire flow.

alter table public.job_requests
  add column if not exists community_post_id uuid references public.community_posts(id) on delete set null;

create index if not exists idx_job_requests_community_post_id
  on public.job_requests (community_post_id)
  where community_post_id is not null;

comment on column public.job_requests.community_post_id is
  'When set, this job was created via “Hire now” on a public community post.';
