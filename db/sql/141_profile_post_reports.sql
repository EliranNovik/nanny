alter table public.profile_post_reports
  add column if not exists job_request_id uuid references public.job_requests(id) on delete cascade,
  add column if not exists status text not null default 'open',
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null;

alter table public.profile_post_reports alter column post_id drop not null;

alter table public.profile_post_reports
  drop constraint if exists profile_post_reports_post_id_reporter_id_key;
alter table public.profile_post_reports
  drop constraint if exists profile_post_reports_one_target_check;
alter table public.profile_post_reports
  drop constraint if exists profile_post_reports_status_check;

alter table public.profile_post_reports
  add constraint profile_post_reports_one_target_check
  check (num_nonnulls(post_id, job_request_id) = 1),
  add constraint profile_post_reports_status_check
  check (status in ('open', 'resolved', 'dismissed'));

create unique index if not exists profile_post_reports_post_reporter_uidx
  on public.profile_post_reports (post_id, reporter_id) where post_id is not null;
create unique index if not exists profile_post_reports_job_reporter_uidx
  on public.profile_post_reports (job_request_id, reporter_id) where job_request_id is not null;
create index if not exists profile_post_reports_job_created_idx
  on public.profile_post_reports (job_request_id, created_at desc);
create index if not exists profile_post_reports_status_created_idx
  on public.profile_post_reports (status, created_at desc);

drop policy if exists profile_post_reports_select_own_or_admin on public.profile_post_reports;
create policy profile_post_reports_select_own_or_admin
  on public.profile_post_reports for select to authenticated
  using (
    reporter_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists profile_post_reports_insert_own on public.profile_post_reports;
create policy profile_post_reports_insert_own
  on public.profile_post_reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and status = 'open'
    and resolved_at is null
    and resolved_by is null
    and (
      (
        post_id is not null
        and exists (
          select 1 from public.profile_posts
          where profile_posts.id = profile_post_reports.post_id
            and profile_posts.author_id <> auth.uid()
        )
      )
      or
      (
        job_request_id is not null
        and exists (
          select 1 from public.job_requests
          where job_requests.id = profile_post_reports.job_request_id
            and job_requests.client_id <> auth.uid()
        )
      )
    )
  );

drop policy if exists profile_post_reports_update_admin on public.profile_post_reports;
create policy profile_post_reports_update_admin
  on public.profile_post_reports for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

do $$
begin
  alter publication supabase_realtime add table public.profile_post_reports;
exception when duplicate_object then null;
end $$;
