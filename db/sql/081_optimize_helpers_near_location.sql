-- Optimization: Include enriched response stats and week counts directly in the helpers search RPC.
-- This reduces sequential round-trips when rendering helper search result cards.

drop function if exists public.get_helpers_near_location(
  double precision,
  double precision,
  double precision,
  text,
  text,
  boolean
);

create or replace function public.get_helpers_near_location(
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
  distance_km double precision,
  whatsapp_contact_available boolean,
  telegram_contact_available boolean,
  is_verified boolean,
  avg_reply_seconds float,
  reply_sample_count int,
  live_help_week_count int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  found_ids uuid[];
begin
  -- 1. Identify relevant helpers based on location/query
  with filtered_profiles as (
    select
      p.id,
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
      )::double precision as dist_km
    from profiles p
    where (p.role = 'freelancer' or (p.role = 'client' and p.is_available_for_jobs = true))
      and coalesce(p.is_admin, false) is false
  )
  select array_agg(f.id) into found_ids
  from filtered_profiles f
  join profiles p on p.id = f.id
  where
    case
      when f.dist_km is not null then
        f.dist_km <= radius_km
        and (
          search_query = ''
          or geocode_matched_place = true
          or lower(p.full_name) like '%' || lower(search_query) || '%'
          or lower(p.city) like '%' || lower(search_query) || '%'
        )
      else
        (
          search_query != ''
          and (
            lower(p.full_name) like '%' || lower(search_query) || '%'
            or lower(p.city) like '%' || lower(search_query) || '%'
          )
        )
        or
        (
          search_query = ''
          and viewer_city_norm != ''
          and lower(regexp_replace(trim(p.city), '\s+', ' ', 'g')) = viewer_city_norm
        )
    end;

  if found_ids is null or array_length(found_ids, 1) = 0 then
    return;
  end if;

  -- 2. Return enriched data for the found helpers
  return query
  with stats as (
    select s.helper_id, s.avg_seconds, s.sample_count
    from public.get_helper_chat_response_stats(found_ids) s
  ),
  week_counts as (
    select w.helper_id, w.live_help_week_count
    from public.get_helpers_live_help_week_counts(found_ids) w
  )
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
      'bio', coalesce(fp.bio, p.bio),
      'available_now', fp.available_now,
      'live_until', fp.live_until,
      'live_categories', coalesce(fp.live_categories, '{}'::text[]),
      'live_can_start_in', fp.live_can_start_in
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
    )::double precision as distance_km,
    (
      p.share_whatsapp is true
      and p.whatsapp_number_e164 is not null
      and length(trim(p.whatsapp_number_e164)) > 0
    ) as whatsapp_contact_available,
    (
      p.share_telegram is true
      and p.telegram_username is not null
      and length(trim(p.telegram_username)) > 0
    ) as telegram_contact_available,
    coalesce(p.is_verified, false) as is_verified,
    s.avg_seconds::float as avg_reply_seconds,
    s.sample_count::int as reply_sample_count,
    coalesce(w.live_help_week_count, 0)::int as live_help_week_count
  from profiles p
  left join freelancer_profiles fp on p.id = fp.user_id
  left join stats s on s.helper_id = p.id
  left join week_counts w on w.helper_id = p.id
  where p.id = any(found_ids)
  order by
    case
      when p.location_lat is not null and p.location_lng is not null then
        6371 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(search_lat)) * cos(radians(p.location_lat)) *
            cos(radians(p.location_lng) - radians(search_lng)) +
            sin(radians(search_lat)) * sin(radians(p.location_lat))
          ))
        )
      else 999999
    end asc
  limit 100;
end;
$$;

grant execute on function public.get_helpers_near_location(double precision, double precision, double precision, text, text, boolean) to authenticated;
grant execute on function public.get_helpers_near_location(double precision, double precision, double precision, text, text, boolean) to service_role;
