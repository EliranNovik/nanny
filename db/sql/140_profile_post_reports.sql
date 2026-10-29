create table if not exists public.profile_post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.profile_posts(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in (
    'spam', 'harassment', 'hate_speech', 'nudity', 'violence',
    'misinformation', 'scam', 'copyright', 'other'
  )),
  details text,
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

create index if not exists profile_post_reports_post_created_idx
  on public.profile_post_reports (post_id, created_at desc);
create index if not exists profile_post_reports_reporter_created_idx
  on public.profile_post_reports (reporter_id, created_at desc);

alter table public.profile_post_reports enable row level security;

create policy profile_post_reports_select_own_or_admin
  on public.profile_post_reports for select to authenticated
  using (
    reporter_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy profile_post_reports_insert_own
  on public.profile_post_reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and exists (
      select 1 from public.profile_posts
      where id = post_id and author_id <> auth.uid()
    )
  );

alter publication supabase_realtime add table public.profile_post_reports;
