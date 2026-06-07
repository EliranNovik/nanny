-- Likes + share taps for open help requests in the community feed.

create table if not exists public.job_request_likes (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.job_requests(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (job_id, user_id)
);

create index if not exists idx_job_request_likes_job_id
  on public.job_request_likes (job_id);

create index if not exists idx_job_request_likes_user_id_created_at
  on public.job_request_likes (user_id, created_at desc);

alter table public.job_request_likes enable row level security;

create policy "job_request_likes_read"
  on public.job_request_likes for select using (true);

create policy "job_request_likes_insert_own"
  on public.job_request_likes for insert
  with check (auth.uid() = user_id);

create policy "job_request_likes_delete_own"
  on public.job_request_likes for delete
  using (auth.uid() = user_id);

comment on table public.job_request_likes is
  'Community feed likes on open help requests (job_requests).';

-- ── Share button taps (mirrors profile_post_shares) ─────────────────────────

create table if not exists public.job_request_shares (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.job_requests(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_job_request_shares_job_id
  on public.job_request_shares (job_id);

alter table public.job_request_shares enable row level security;

create policy "job_request_shares_read"
  on public.job_request_shares for select using (true);

create policy "job_request_shares_insert_own"
  on public.job_request_shares for insert
  with check (auth.uid() = user_id);

comment on table public.job_request_shares is
  'Logged-in user share-button taps on open help requests.';

-- ── Engagement counts for feed cards ────────────────────────────────────────

create or replace function public.get_job_request_feed_engagement(
  p_job_ids uuid[],
  p_viewer_id uuid default null
)
returns table (
  job_id uuid,
  like_count bigint,
  share_click_count bigint,
  comment_count bigint,
  liked_by_me boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with ids as (
    select distinct unnest(p_job_ids) as job_id
  )
  select
    i.job_id,
    coalesce(l.cnt, 0)::bigint as like_count,
    coalesce(s.cnt, 0)::bigint as share_click_count,
    coalesce(c.cnt, 0)::bigint as comment_count,
    case
      when p_viewer_id is null then false
      else exists (
        select 1
        from public.job_request_likes jl
        where jl.job_id = i.job_id
          and jl.user_id = p_viewer_id
      )
    end as liked_by_me
  from ids i
  left join (
    select job_id, count(*)::bigint as cnt
    from public.job_request_likes
    group by job_id
  ) l on l.job_id = i.job_id
  left join (
    select job_id, count(*)::bigint as cnt
    from public.job_request_shares
    group by job_id
  ) s on s.job_id = i.job_id
  left join (
    select job_request_id as job_id, count(*)::bigint as cnt
    from public.job_request_comments
    group by job_request_id
  ) c on c.job_id = i.job_id;
$$;

grant execute on function public.get_job_request_feed_engagement(uuid[], uuid) to anon, authenticated;

-- ── Single open request for shared deep links (?request=) ─────────────────

drop function if exists public.get_discover_open_help_request_by_id(uuid);

create or replace function public.get_discover_open_help_request_by_id(p_id uuid)
returns table (
  id uuid,
  service_type text,
  location_city text,
  location_lat float,
  location_lng float,
  start_at timestamptz,
  created_at timestamptz,
  shift_hours text,
  time_duration text,
  care_type text,
  care_frequency text,
  client_photo_url text,
  client_display_name text,
  client_id uuid,
  status text,
  client_average_rating float,
  client_total_ratings int,
  is_verified boolean,
  client_avg_reply_seconds float,
  client_reply_sample_count int,
  service_details jsonb,
  notes text,
  when_timeframe text,
  custom_when_at timestamptz,
  budget_min int,
  budget_max int,
  budget_rate_type text,
  ai_generated_copy jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  with base_requests as (
    select
      jr.id,
      jr.service_type,
      jr.location_city,
      jr.location_lat,
      jr.location_lng,
      jr.start_at,
      jr.created_at,
      jr.shift_hours,
      jr.time_duration,
      jr.care_type,
      jr.care_frequency,
      jr.client_id,
      jr.status::text as status,
      jr.service_details,
      jr.notes,
      jr.when_timeframe,
      jr.custom_when_at,
      jr.budget_min,
      jr.budget_max,
      jr.budget_rate_type,
      jr.ai_generated_copy
    from public.job_requests jr
    where jr.id = p_id
      and jr.status::text in ('ready', 'notifying', 'confirmations_closed')
      and jr.community_post_id is null
    limit 1
  ),
  stats as (
    select
      client_id,
      avg_seconds,
      sample_count
    from public.get_client_chat_response_stats(
      (select array_agg(distinct client_id) from base_requests)
    )
  )
  select
    br.id,
    br.service_type,
    br.location_city,
    br.location_lat,
    br.location_lng,
    br.start_at,
    br.created_at,
    br.shift_hours,
    br.time_duration,
    br.care_type,
    br.care_frequency,
    p.photo_url as client_photo_url,
    left(coalesce(nullif(trim(p.full_name), ''), 'Member'), 48) as client_display_name,
    br.client_id,
    br.status,
    (p.average_rating)::float,
    p.total_ratings,
    coalesce(p.is_verified, false),
    s.avg_seconds::float,
    s.sample_count::int,
    br.service_details,
    br.notes,
    br.when_timeframe,
    br.custom_when_at,
    br.budget_min,
    br.budget_max,
    br.budget_rate_type,
    br.ai_generated_copy
  from base_requests br
  inner join public.profiles p on p.id = br.client_id
  left join stats s on s.client_id = br.client_id
  where coalesce(p.is_admin, false) is false;
$$;

grant execute on function public.get_discover_open_help_request_by_id(uuid) to anon, authenticated;

comment on function public.get_discover_open_help_request_by_id(uuid) is
  'Fetch one open help request for shared community feed links (?request=).';
