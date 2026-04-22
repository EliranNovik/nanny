-- Freelancer job match RPC: include care_frequency + service_details from job_requests.

alter table public.job_requests
  add column if not exists care_frequency text;

alter table public.job_requests
  add column if not exists service_details jsonb default '{}'::jsonb;

drop function if exists public.get_job_requests_near_location(
  double precision,
  double precision,
  double precision,
  text[],
  uuid,
  int
);

create or replace function public.get_job_requests_near_location(
  search_lat double precision,
  search_lng double precision,
  radius_km double precision,
  service_filters text[] default null,
  viewer_id uuid default null,
  p_limit int default 200
)
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
  requirements text[],
  languages_pref text[],
  budget_min int,
  budget_max int,
  client_display_name text,
  client_photo_url text,
  distance_km double precision
)
language sql
security definer
set search_path = public
stable
as $$
  with base as (
    select
      jr.id,
      jr.client_id,
      jr.service_type::text,
      jr.location_city,
      coalesce(jr.location_lat, p.location_lat)::double precision as location_lat,
      coalesce(jr.location_lng, p.location_lng)::double precision as location_lng,
      jr.start_at,
      jr.created_at,
      jr.shift_hours,
      jr.time_duration,
      jr.care_frequency,
      coalesce(jr.service_details::jsonb, '{}'::jsonb) as service_details,
      jr.notes,
      jr.requirements,
      jr.languages_pref,
      jr.budget_min,
      jr.budget_max,
      left(coalesce(nullif(trim(p.full_name), ''), 'Member'), 48) as client_display_name,
      p.photo_url as client_photo_url,
      (
        case
          when coalesce(jr.location_lat, p.location_lat) is not null
            and coalesce(jr.location_lng, p.location_lng) is not null then
            6371 * acos(
              least(1.0, greatest(-1.0,
                cos(radians(search_lat)) * cos(radians(coalesce(jr.location_lat, p.location_lat))) *
                cos(radians(coalesce(jr.location_lng, p.location_lng)) - radians(search_lng)) +
                sin(radians(search_lat)) * sin(radians(coalesce(jr.location_lat, p.location_lat)))
              ))
            )
          else null
        end
      )::double precision as distance_km
    from public.job_requests jr
    inner join public.profiles p on p.id = jr.client_id
    where jr.status::text in ('ready', 'notifying', 'confirmations_closed')
      and jr.community_post_id is null
      and (viewer_id is null or jr.client_id <> viewer_id)
      and (
        service_filters is null
        or array_length(service_filters, 1) is null
        or jr.service_type::text = any(service_filters)
      )
  ),
  filtered as (
    select *
    from base
    where (distance_km is null or distance_km <= greatest(0, radius_km))
      and (
        viewer_id is null
        or (
          not exists (
            select 1
            from public.job_confirmations jc
            where jc.job_id = base.id
              and jc.freelancer_id = viewer_id
              and jc.status in ('available', 'declined')
          )
        )
      )
  )
  select *
  from filtered
  order by distance_km asc nulls last, created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 500));
$$;

comment on function public.get_job_requests_near_location(double precision, double precision, double precision, text[], uuid, int) is
  'Freelancer matching: open job_requests near location; includes care_frequency + service_details.';

grant execute on function public.get_job_requests_near_location(double precision, double precision, double precision, text[], uuid, int) to anon, authenticated;
