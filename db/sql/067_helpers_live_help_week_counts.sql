-- Badge metric for helper search cards: completed live help bookings per helper in trailing 7 days.

create or replace function public.get_helpers_live_help_week_counts(p_helper_ids uuid[])
returns table (
  helper_id uuid,
  live_help_week_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    jr.selected_freelancer_id as helper_id,
    count(*)::bigint as live_help_week_count
  from public.job_requests jr
  where jr.selected_freelancer_id is not null
    and jr.selected_freelancer_id = any(p_helper_ids)
    and jr.status = 'completed'
    and jr.updated_at >= now() - interval '7 days'
  group by jr.selected_freelancer_id;
$$;

comment on function public.get_helpers_live_help_week_counts(uuid[]) is
  'Aggregates completed job_requests per freelancer for updated_at in trailing 7 days (helper search weekly live-help badge).';

grant execute on function public.get_helpers_live_help_week_counts(uuid[]) to authenticated;
grant execute on function public.get_helpers_live_help_week_counts(uuid[]) to service_role;
