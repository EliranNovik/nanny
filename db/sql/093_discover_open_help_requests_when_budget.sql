-- Discover open-help RPC: include when + budget fields from create-request flow.

drop function if exists public.get_discover_open_help_requests(int);

create or replace function public.get_discover_open_help_requests(p_limit int default 8)
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
  budget_rate_type text
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
      jr.budget_rate_type
    from public.job_requests jr
    where jr.status::text in ('ready', 'notifying', 'confirmations_closed')
      and jr.community_post_id is null
    order by jr.created_at desc
    limit greatest(1, least(coalesce(p_limit, 8), 30))
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
    br.budget_rate_type
  from base_requests br
  inner join public.profiles p on p.id = br.client_id
  left join stats s on s.client_id = br.client_id
  where coalesce(p.is_admin, false) is false;
$$;

grant execute on function public.get_discover_open_help_requests(int) to anon, authenticated;

comment on function public.get_discover_open_help_requests(int) is
  'Discover Help others: open job_requests with when/budget enrichment.';
