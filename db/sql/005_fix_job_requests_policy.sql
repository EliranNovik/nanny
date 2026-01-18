-- 005_fix_job_requests_policy.sql
-- Allow freelancers with notifications to view job requests

-- Drop the old policy
drop policy if exists "job_requests_select_own_client_or_selected_freelancer" on public.job_requests;

-- Create new policy that allows:
-- 1. Client who created the job
-- 2. Selected freelancer
-- 3. Freelancers who have a notification for this job
create policy "job_requests_select_authorized"
on public.job_requests for select
using (
  auth.uid() = client_id
  or auth.uid() = selected_freelancer_id
  or auth.uid() in (
    select freelancer_id 
    from public.job_candidate_notifications 
    where job_id = job_requests.id
  )
);

