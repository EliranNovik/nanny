-- 014_rename_expired_to_open_job.sql
-- Rename expired acceptance to open job acceptance

-- Rename column from is_expired_accepted to is_open_job_accepted
alter table public.job_confirmations 
  rename column is_expired_accepted to is_open_job_accepted;

-- Update comment
comment on column public.job_confirmations.is_open_job_accepted is 'True if this confirmation was made after the confirmation window expired (open job)';

-- Drop old index and create new one
drop index if exists idx_job_confirmations_expired;
create index if not exists idx_job_confirmations_open_job on public.job_confirmations(job_id, is_open_job_accepted) where is_open_job_accepted = true;

