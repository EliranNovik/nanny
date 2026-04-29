-- 064_job_request_comments.sql
-- Table and policies for comments on job requests

create table if not exists public.job_request_comments (
  id uuid primary key default gen_random_uuid(),
  job_request_id uuid not null references public.job_requests(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.job_request_comments enable row level security;

-- Policies
-- Anyone can read comments
create policy "job_request_comments_select" on public.job_request_comments
  for select using (true);

-- Authenticated users can post comments
create policy "job_request_comments_insert" on public.job_request_comments
  for insert with check (auth.uid() = author_id);

-- Authors can delete their own comments
create policy "job_request_comments_delete" on public.job_request_comments
  for delete using (auth.uid() = author_id);

-- Indices
create index if not exists idx_job_request_comments_job_id
  on public.job_request_comments(job_request_id, created_at asc);

-- Optional: enable realtime
-- alter publication supabase_realtime add table public.job_request_comments;
