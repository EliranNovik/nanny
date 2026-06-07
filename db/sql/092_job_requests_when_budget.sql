-- Client create-request flow: when timeframe, custom datetime, budget rate type.

alter table public.job_requests
  add column if not exists when_timeframe text,
  add column if not exists custom_when_at timestamptz,
  add column if not exists budget_rate_type text;

alter table public.job_requests
  drop constraint if exists job_requests_when_timeframe_check;

alter table public.job_requests
  add constraint job_requests_when_timeframe_check
  check (
    when_timeframe is null
    or when_timeframe in ('now', 'today', 'tomorrow', 'this_week', 'custom')
  );

alter table public.job_requests
  drop constraint if exists job_requests_budget_rate_type_check;

alter table public.job_requests
  add constraint job_requests_budget_rate_type_check
  check (
    budget_rate_type is null
    or budget_rate_type in ('per_hour', 'fixed')
  );

comment on column public.job_requests.when_timeframe is
  'Client create flow: now | today | tomorrow | this_week | custom';

comment on column public.job_requests.custom_when_at is
  'When when_timeframe = custom, the client-selected date/time.';

comment on column public.job_requests.budget_rate_type is
  'Optional budget unit from create flow: per_hour | fixed';
