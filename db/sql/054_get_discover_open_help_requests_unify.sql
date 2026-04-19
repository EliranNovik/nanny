-- If 053 added a two-argument overload, PostgREST may 404 when the app only needs
-- get_discover_open_help_requests(int). This migration unifies to a single RPC that
-- returns client_id for client-side exclusion in the web app.

drop function if exists public.get_discover_open_help_requests(int);
drop function if exists public.get_discover_open_help_requests(int, uuid);

create or replace function public.get_discover_open_help_requests(p_limit int default 8)
returns table (
  id uuid,
  service_type text,
  location_city text,
  start_at timestamptz,
  created_at timestamptz,
  shift_hours text,
  time_duration text,
  client_photo_url text,
  client_display_name text,
  client_id uuid,
  status text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    jr.id,
    jr.service_type,
    jr.location_city,
    jr.start_at,
    jr.created_at,
    jr.shift_hours,
    null::text as time_duration,
    p.photo_url,
    left(coalesce(nullif(trim(p.full_name), ''), 'Member'), 48) as client_display_name,
    jr.client_id,
    jr.status::text as status
  from public.job_requests jr
  inner join public.profiles p on p.id = jr.client_id
  where jr.status::text in ('ready', 'notifying', 'confirmations_closed')
    and jr.community_post_id is null
  order by jr.created_at desc
  limit greatest(1, least(coalesce(p_limit, 8), 30));
$$;

comment on function public.get_discover_open_help_requests(int) is
  'Discover strip: open job_requests (community_post_id is null); includes client_id for UI filtering.';

grant execute on function public.get_discover_open_help_requests(int) to anon, authenticated;
