-- 049_public_profile_client_job_requests.sql
-- Public profile: list job requests this user posted as client (needs help), bypassing RLS via SECURITY DEFINER.

alter table public.job_requests add column if not exists service_type text;

drop function if exists public.get_public_profile_client_job_requests(uuid);

create function public.get_public_profile_client_job_requests(p_client_id uuid)
returns table (
  id uuid,
  service_type text,
  status text,
  created_at timestamptz,
  location_city text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    jr.id,
    coalesce(nullif(trim(jr.service_type), ''), nullif(trim(jr.care_type), ''), 'other_help')::text as service_type,
    jr.status::text,
    jr.created_at,
    jr.location_city
  from public.job_requests jr
  where jr.client_id = p_client_id
    and jr.status::text not in ('draft', 'completed', 'cancelled')
  order by jr.created_at desc
  limit 40;
$$;

comment on function public.get_public_profile_client_job_requests(uuid) is
  'Open job requests a user posted as client — safe fields for public profile.';

grant execute on function public.get_public_profile_client_job_requests(uuid) to anon, authenticated;
