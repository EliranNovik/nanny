-- 013_add_expired_acceptance.sql
-- Allow freelancers to accept expired requests with a note

-- Add note and is_expired_accepted fields to job_confirmations
alter table public.job_confirmations 
  add column if not exists note text,
  add column if not exists is_expired_accepted boolean not null default false;

-- Add comment
comment on column public.job_confirmations.note is 'Optional note from freelancer when accepting an expired request';
comment on column public.job_confirmations.is_expired_accepted is 'True if this confirmation was made after the confirmation window expired';

-- Create index for querying expired acceptances
create index if not exists idx_job_confirmations_expired on public.job_confirmations(job_id, is_expired_accepted) where is_expired_accepted = true;

