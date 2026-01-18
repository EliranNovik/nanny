-- 016_allow_freelancer_price_offer_update.sql
-- Allow freelancers to update price offer fields on job_requests

-- Drop the old update policy
drop policy if exists "job_requests_update_client_only" on public.job_requests;

-- Create new policy that allows:
-- 1. Client to update their own jobs (can update all fields)
-- 2. Selected freelancer to update job_requests (application logic ensures only price offer fields are updated)
-- Note: RLS policies cannot restrict which columns are updated, only who can perform the update.
-- The application layer ensures freelancers only update offered_hourly_rate and price_offer_status.
create policy "job_requests_update_client_or_selected_freelancer"
on public.job_requests for update
using (
  auth.uid() = client_id
  or auth.uid() = selected_freelancer_id
)
with check (
  auth.uid() = client_id
  or auth.uid() = selected_freelancer_id
);

