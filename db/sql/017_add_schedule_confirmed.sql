-- 017_add_schedule_confirmed.sql
-- Add schedule_confirmed field to track schedule confirmation status

alter table public.job_requests
  add column if not exists schedule_confirmed boolean not null default false;

-- Create index for querying
create index if not exists idx_job_requests_schedule_confirmed on public.job_requests(schedule_confirmed) where schedule_confirmed = true;

-- Add comment
comment on column public.job_requests.schedule_confirmed is 'True when the schedule has been confirmed by both client and freelancer';

