-- 24h "go live" window for helpers (separate from community_posts pulses).
alter table public.freelancer_profiles
  add column if not exists live_until timestamptz null;

alter table public.freelancer_profiles
  add column if not exists live_categories text[] not null default '{}';

comment on column public.freelancer_profiles.live_until is
  'When set and in the future, helper is in an active "go live" window (e.g. 24h from /availability/post-now).';

comment on column public.freelancer_profiles.live_categories is
  'Service category ids included in the current live window; used for Discover + Find helpers.';

create index if not exists idx_freelancer_profiles_live_until_active
  on public.freelancer_profiles (live_until)
  where live_until is not null;

-- Expose live fields to get_helpers_near_location for map + filters.
create or replace function get_helpers_near_location(
  search_lat double precision,
  search_lng double precision,
  radius_km double precision,
  search_query text default '',
  viewer_city_norm text default '',
  geocode_matched_place boolean default false
)
returns table (
  id uuid,
  full_name text,
  photo_url text,
  city text,
  location_lat double precision,
  location_lng double precision,
  service_radius double precision,
  average_rating double precision,
  total_ratings integer,
  role text,
  is_available_for_jobs boolean,
  freelancer_profiles jsonb,
  distance_km double precision
)
language plpgsql
security definer
as $$
begin
  return query
  with profiles_with_dist as (
    select
      p.id,
      p.full_name,
      p.photo_url,
      p.city,
      (p.location_lat)::double precision,
      (p.location_lng)::double precision,
      (p.service_radius)::double precision,
      (p.average_rating)::double precision,
      p.total_ratings,
      (p.role)::text,
      p.is_available_for_jobs,
      jsonb_build_object(
        'hourly_rate_min', fp.hourly_rate_min,
        'hourly_rate_max', fp.hourly_rate_max,
        'bio', fp.bio,
        'available_now', fp.available_now,
        'live_until', fp.live_until,
        'live_categories', coalesce(fp.live_categories, '{}'::text[])
      ) as freelancer_profiles,
      (
        case
          when p.location_lat is not null and p.location_lng is not null then
            6371 * acos(
              least(1.0, greatest(-1.0,
                cos(radians(search_lat)) * cos(radians(p.location_lat)) *
                cos(radians(p.location_lng) - radians(search_lng)) +
                sin(radians(search_lat)) * sin(radians(p.location_lat))
              ))
            )
          else null
        end
      )::double precision as distance_km
    from profiles p
    left join freelancer_profiles fp on p.id = fp.user_id
    where p.role = 'freelancer' or (p.role = 'client' and p.is_available_for_jobs = true)
  )
  select
    pd.id,
    pd.full_name,
    pd.photo_url,
    pd.city,
    pd.location_lat,
    pd.location_lng,
    pd.service_radius,
    pd.average_rating,
    pd.total_ratings,
    pd.role,
    pd.is_available_for_jobs,
    pd.freelancer_profiles,
    pd.distance_km
  from profiles_with_dist pd
  where
    case
      when pd.distance_km is not null then
        pd.distance_km <= radius_km
        and (
          search_query = ''
          or geocode_matched_place = true
          or lower(pd.full_name) like '%' || lower(search_query) || '%'
          or lower(pd.city) like '%' || lower(search_query) || '%'
        )
      else
        (
          search_query != ''
          and (
            lower(pd.full_name) like '%' || lower(search_query) || '%'
            or lower(pd.city) like '%' || lower(search_query) || '%'
          )
        )
        or
        (
          search_query = ''
          and viewer_city_norm != ''
          and lower(regexp_replace(trim(pd.city), '\s+', ' ', 'g')) = viewer_city_norm
        )
    end
  order by
    case when pd.distance_km is null then 1 else 0 end asc,
    pd.distance_km asc
  limit 500;
end;
$$;
