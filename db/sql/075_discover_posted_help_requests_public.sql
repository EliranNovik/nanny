-- Discover "Help others": list open job_requests helpers can respond to (same statuses as match RPC).
-- Includes both create-flow jobs (community_post_id null) and feed-originated jobs (non-null).
-- Security definer: base `job_requests` RLS only allows client, selected freelancer, or notified candidates.

-- OUT / RETURNS TABLE signature changes require DROP first (CREATE OR REPLACE cannot alter return row type).
drop function if exists public.get_discover_posted_help_requests_public(integer);

create or replace function public.get_discover_posted_help_requests_public(p_limit int default 12)
returns table (
  job_id uuid,
  community_post_id uuid,
  service_type text,
  location_city text,
  time_duration text,
  shift_hours text,
  created_at timestamptz,
  client_id uuid,
  author_full_name text,
  author_photo_url text,
  author_average_rating numeric,
  author_total_ratings int
)
language sql
security definer
set search_path = public
stable
as $$
  select
    jr.id as job_id,
    jr.community_post_id,
    coalesce(nullif(trim(jr.service_type::text), ''), 'other_help')::text as service_type,
    jr.location_city,
    jr.time_duration::text as time_duration,
    jr.shift_hours::text as shift_hours,
    jr.created_at,
    jr.client_id,
    left(coalesce(nullif(trim(p.full_name), ''), 'Member'), 64) as author_full_name,
    p.photo_url as author_photo_url,
    coalesce(p.average_rating, 0)::numeric as author_average_rating,
    coalesce(p.total_ratings, 0)::int as author_total_ratings
  from public.job_requests jr
  inner join public.profiles p on p.id = jr.client_id
  where jr.status::text in ('ready', 'notifying', 'confirmations_closed')
    and (auth.uid() is null or jr.client_id <> auth.uid())
  order by (jr.community_post_id is not null) desc, jr.created_at desc
  limit greatest(1, least(coalesce(p_limit, 12), 50));
$$;

comment on function public.get_discover_posted_help_requests_public(int) is
  'Discover home (Help others): recent open job_requests (feed-linked first); excludes viewer''s own jobs.';

grant execute on function public.get_discover_posted_help_requests_public(int) to anon, authenticated;

drop index if exists public.idx_job_requests_discover_posted_help;
create index if not exists idx_job_requests_discover_open_created
  on public.job_requests (created_at desc)
  where status in ('ready', 'notifying', 'confirmations_closed');

-- Match page deep link: RLS blocks direct `job_requests` select for freelancers who are not yet notified.
create or replace function public.get_job_request_public_summary_for_match(p_job_id uuid)
returns table (
  id uuid,
  client_id uuid,
  service_type text,
  location_city text,
  location_lat double precision,
  location_lng double precision,
  start_at timestamptz,
  created_at timestamptz,
  shift_hours text,
  time_duration text,
  care_frequency text,
  service_details jsonb,
  notes text,
  budget_min int,
  budget_max int
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
    coalesce(jr.location_lat::double precision, p.location_lat::double precision) as location_lat,
    coalesce(jr.location_lng::double precision, p.location_lng::double precision) as location_lng,
    jr.start_at,
    jr.created_at,
    jr.shift_hours,
    jr.time_duration,
    jr.care_frequency,
    coalesce(jr.service_details::jsonb, '{}'::jsonb) as service_details,
    jr.notes,
    jr.budget_min,
    jr.budget_max
  from public.job_requests jr
  inner join public.profiles p on p.id = jr.client_id
  where jr.id = p_job_id
    and jr.status::text in ('ready', 'notifying', 'confirmations_closed');
$$;

comment on function public.get_job_request_public_summary_for_match(uuid) is
  'Freelancer match page: read one open job for focus/deep link without job_requests RLS.';

grant execute on function public.get_job_request_public_summary_for_match(uuid) to anon, authenticated;
