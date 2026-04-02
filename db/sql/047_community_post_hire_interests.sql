-- Client "Hire now" on a community post records interest here; freelancer confirms on /availability/post/:id/hires.

create table if not exists public.community_post_hire_interests (
  id uuid primary key default gen_random_uuid(),
  community_post_id uuid not null references public.community_posts(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined')),
  job_request_id uuid references public.job_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_community_post_hire_interests_post_id
  on public.community_post_hire_interests (community_post_id);

create index if not exists idx_community_post_hire_interests_client_id
  on public.community_post_hire_interests (client_id);

create unique index if not exists community_post_hire_interests_one_pending_per_client
  on public.community_post_hire_interests (community_post_id, client_id)
  where (status = 'pending');

comment on table public.community_post_hire_interests is
  'Clients tap Hire now on a post; author reviews and confirms to create a locked live job.';

do $$ begin
  create trigger community_post_hire_interests_set_updated_at
    before update on public.community_post_hire_interests
    for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

alter table public.community_post_hire_interests enable row level security;

create policy "community_post_hire_interests_insert_own_client"
  on public.community_post_hire_interests for insert
  with check (auth.uid() = client_id);

create policy "community_post_hire_interests_select_client_own"
  on public.community_post_hire_interests for select
  using (auth.uid() = client_id);

create policy "community_post_hire_interests_select_post_author"
  on public.community_post_hire_interests for select
  using (
    exists (
      select 1 from public.community_posts cp
      where cp.id = community_post_hire_interests.community_post_id
        and cp.author_id = auth.uid()
    )
  );
