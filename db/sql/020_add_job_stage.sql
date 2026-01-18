-- 020_add_job_stage.sql
-- Add stage column to track job progression stages

-- Create job_stage enum type
do $$ begin
  create type public.job_stage as enum (
    'Request',
    'Price Offer',
    'Schedule',
    'Job in Progress',
    'Job Ended',
    'Payment',
    'Completed'
  );
exception when duplicate_object then null;
end $$;

-- Add stage column to job_requests
alter table public.job_requests
  add column if not exists stage public.job_stage default 'Request';

-- Create index for querying by stage
create index if not exists idx_job_requests_stage on public.job_requests(stage);

-- Add comment
comment on column public.job_requests.stage is 'Current stage of the job aligned with job steps: Request (before step 1), Price Offer (step 1), Schedule (step 2), Job in Progress (step 3), Job Ended (step 4), Payment (step 5), Completed (after step 5)';
