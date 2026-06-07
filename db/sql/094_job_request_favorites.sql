-- Users bookmark open help requests (client create flow) to review later.

create table if not exists public.job_request_favorites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  job_id     uuid not null references public.job_requests(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create index if not exists idx_job_request_favorites_user_id
  on public.job_request_favorites (user_id);

create index if not exists idx_job_request_favorites_job_id
  on public.job_request_favorites (job_id);

comment on table public.job_request_favorites is
  'A user bookmarks an open help request from discover.';

alter table public.job_request_favorites enable row level security;

create policy "job_request_favorites_select_own"
  on public.job_request_favorites
  for select
  using (user_id = auth.uid());

create policy "job_request_favorites_insert_own"
  on public.job_request_favorites
  for insert
  with check (user_id = auth.uid());

create policy "job_request_favorites_delete_own"
  on public.job_request_favorites
  for delete
  using (user_id = auth.uid());

-- Security definer: job_requests RLS blocks helpers from reading jobs they only bookmarked.
create or replace function public.get_saved_open_help_requests()
returns table (
  id uuid,
  client_id uuid,
  service_type text,
  location_city text,
  start_at timestamptz,
  created_at timestamptz,
  shift_hours text,
  time_duration text,
  care_type text,
  care_frequency text,
  service_details jsonb,
  notes text,
  when_timeframe text,
  custom_when_at timestamptz,
  budget_min int,
  budget_max int,
  budget_rate_type text,
  status text,
  client_display_name text,
  client_photo_url text,
  ai_generated_copy jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select
    jr.id,
    jr.client_id,
    coalesce(nullif(trim(jr.service_type::text), ''), 'other_help') as service_type,
    jr.location_city,
    jr.start_at,
    jr.created_at,
    jr.shift_hours::text as shift_hours,
    jr.time_duration::text as time_duration,
    jr.care_type::text as care_type,
    jr.care_frequency::text as care_frequency,
    coalesce(jr.service_details::jsonb, '{}'::jsonb) as service_details,
    jr.notes,
    jr.when_timeframe::text as when_timeframe,
    jr.custom_when_at,
    jr.budget_min,
    jr.budget_max,
    jr.budget_rate_type::text as budget_rate_type,
    jr.status::text as status,
    left(coalesce(nullif(trim(p.full_name), ''), 'Member'), 64) as client_display_name,
    p.photo_url as client_photo_url,
    jr.ai_generated_copy
  from public.job_request_favorites jrf
  inner join public.job_requests jr on jr.id = jrf.job_id
  inner join public.profiles p on p.id = jr.client_id
  where jrf.user_id = auth.uid()
  order by jrf.created_at desc;
$$;

comment on function public.get_saved_open_help_requests() is
  'Saved page: bookmarked open help requests for the current user.';

grant execute on function public.get_saved_open_help_requests() to authenticated;
