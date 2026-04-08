-- 050_public_job_request_preview.sql
-- Full job + client profile JSON for public profile “needs help” preview (JobDetailsModal), bypassing RLS.

drop function if exists public.get_public_job_request_preview(uuid);

create function public.get_public_job_request_preview(p_job_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select (to_jsonb(jr) || jsonb_build_object('profiles', to_jsonb(p)))
  from public.job_requests jr
  inner join public.profiles p on p.id = jr.client_id
  where jr.id = p_job_id
    and jr.status::text not in ('draft', 'cancelled')
  limit 1;
$$;

comment on function public.get_public_job_request_preview(uuid) is
  'Job row merged with client profiles row for JobDetailsModal on public profile (read-only).';

grant execute on function public.get_public_job_request_preview(uuid) to anon, authenticated;
