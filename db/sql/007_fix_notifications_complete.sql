-- 007_fix_notifications_complete.sql
-- Complete fix for freelancer notifications
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Fix RLS Policy for job_requests
-- ============================================
-- Allow freelancers with notifications to view job requests

-- Drop old policy if it exists
drop policy if exists "job_requests_select_own_client_or_selected_freelancer" on public.job_requests;

-- Drop new policy if it already exists (in case migration was run before)
drop policy if exists "job_requests_select_authorized" on public.job_requests;

-- Create the new policy
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

-- ============================================
-- STEP 2: Enable Realtime for notifications
-- ============================================
-- This allows the frontend to receive real-time updates

-- Check if publication exists, create if not
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Add table to realtime publication (ignore error if already added)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and tablename = 'job_candidate_notifications'
  ) then
    alter publication supabase_realtime add table public.job_candidate_notifications;
  end if;
end $$;

-- Verify it was added (this will show the table in the publication)
select schemaname, tablename 
from pg_publication_tables 
where pubname = 'supabase_realtime' 
and tablename = 'job_candidate_notifications';

