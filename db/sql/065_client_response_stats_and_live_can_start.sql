-- Client avg chat reply latency (freelancer message → client's next reply) + go-live start preference.

alter table public.freelancer_profiles
  add column if not exists live_can_start_in text null;

comment on column public.freelancer_profiles.live_can_start_in is
  '24h go-live wizard: immediate | in_15_min | in_30_min | in_1_hour | later_today';

do $$ begin
  alter table public.freelancer_profiles
    add constraint freelancer_profiles_live_can_start_in_ck
    check (
      live_can_start_in is null
      or live_can_start_in in (
        'immediate',
        'in_15_min',
        'in_30_min',
        'in_1_hour',
        'later_today'
      )
    );
exception when duplicate_object then null;
end $$;

-- Aggregated latency per client (SECURITY DEFINER so helpers can preview without per-conversation RLS noise).
create or replace function public.get_client_chat_response_stats(p_client_ids uuid[])
returns table (
  client_id uuid,
  avg_seconds double precision,
  sample_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with conv as (
    select c.id as conversation_id, c.client_id, c.freelancer_id
    from public.conversations c
    where c.client_id is not null
      and c.freelancer_id is not null
      and c.client_id = any(p_client_ids)
  ),
  msgs as (
    select
      m.conversation_id,
      m.sender_id,
      m.created_at,
      conv.client_id,
      conv.freelancer_id,
      lag(m.sender_id) over (partition by m.conversation_id order by m.created_at) as prev_sender,
      lag(m.created_at) over (partition by m.conversation_id order by m.created_at) as prev_at
    from public.messages m
    inner join conv on conv.conversation_id = m.conversation_id
  ),
  latencies as (
    select
      msgs.client_id,
      extract(epoch from (msgs.created_at - msgs.prev_at))::double precision as secs
    from msgs
    where msgs.prev_sender is not null
      and msgs.prev_at is not null
      and msgs.prev_sender = msgs.freelancer_id
      and msgs.sender_id = msgs.client_id
      and msgs.created_at > msgs.prev_at
  )
  select
    l.client_id,
    avg(l.secs)::double precision as avg_seconds,
    count(*)::bigint as sample_count
  from latencies l
  group by l.client_id
$$;

grant execute on function public.get_client_chat_response_stats(uuid[]) to authenticated;
grant execute on function public.get_client_chat_response_stats(uuid[]) to service_role;

-- Aggregated latency per helper (client message → helper's next reply).
create or replace function public.get_helper_chat_response_stats(p_helper_ids uuid[])
returns table (
  helper_id uuid,
  avg_seconds double precision,
  sample_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with conv as (
    select c.id as conversation_id, c.client_id, c.freelancer_id
    from public.conversations c
    where c.client_id is not null
      and c.freelancer_id is not null
      and c.freelancer_id = any(p_helper_ids)
  ),
  msgs as (
    select
      m.conversation_id,
      m.sender_id,
      m.created_at,
      conv.client_id,
      conv.freelancer_id,
      lag(m.sender_id) over (partition by m.conversation_id order by m.created_at) as prev_sender,
      lag(m.created_at) over (partition by m.conversation_id order by m.created_at) as prev_at
    from public.messages m
    inner join conv on conv.conversation_id = m.conversation_id
  ),
  latencies as (
    select
      msgs.freelancer_id as helper_id,
      extract(epoch from (msgs.created_at - msgs.prev_at))::double precision as secs
    from msgs
    where msgs.prev_sender is not null
      and msgs.prev_at is not null
      and msgs.prev_sender = msgs.client_id
      and msgs.sender_id = msgs.freelancer_id
      and msgs.created_at > msgs.prev_at
      -- Only measure "active reply" behavior (exclude long gaps that are usually offline / next-day follow ups).
      and msgs.created_at >= now() - interval '30 days'
  )
  select
    l.helper_id,
    avg(l.secs)::double precision as avg_seconds,
    count(*)::bigint as sample_count
  from latencies l
  where l.secs >= 5
    and l.secs <= 60 * 60 * 4
  group by l.helper_id
$$;

grant execute on function public.get_helper_chat_response_stats(uuid[]) to authenticated;
grant execute on function public.get_helper_chat_response_stats(uuid[]) to service_role;

-- Ensure `get_helpers_near_location` includes `live_can_start_in` in freelancer_profiles JSON.
-- This supports client-side badges for both freelancers and client-helpers (role=client + is_available_for_jobs=true).
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
