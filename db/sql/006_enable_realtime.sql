-- 006_enable_realtime.sql
-- Enable Realtime for job_candidate_notifications table
-- This allows the frontend to receive real-time updates when notifications are created/updated

-- Enable Realtime publication (if not already enabled)
alter publication supabase_realtime add table public.job_candidate_notifications;

-- Note: If you get an error that the publication doesn't exist, run this first:
-- create publication supabase_realtime;

