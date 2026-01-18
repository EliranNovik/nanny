-- 011_add_notifications_delete_policy.sql
-- Allow freelancers to delete their own notifications (e.g., expired requests)

-- Allow freelancers to delete their own notifications
create policy "candidate_notifications_delete_own"
on public.job_candidate_notifications for delete
using (auth.uid() = freelancer_id);

