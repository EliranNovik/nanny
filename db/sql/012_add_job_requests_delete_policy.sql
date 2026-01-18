-- 012_add_job_requests_delete_policy.sql
-- Allow clients to delete their own job requests that are waiting for responses
-- Only allow deletion of jobs in "notifying" or "confirmations_closed" status

-- Allow clients to delete their own job requests that are waiting for responses
create policy "job_requests_delete_client_waiting"
on public.job_requests for delete
using (
  auth.uid() = client_id
  and status in ('notifying', 'confirmations_closed')
);

