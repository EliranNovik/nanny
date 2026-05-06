-- Optimization for Discovery Home "Open requests" and "Helper live" queries.

-- 1. Optimized index for discovering open help requests.
-- This covers the status filter and the community_post_id (null/not null) check,
-- and orders by created_at desc.
create index if not exists idx_job_requests_discovery_v2
  on public.job_requests (status, community_post_id, created_at desc);

-- 2. Ensure profiles join is efficient (already should be via PK, but we check columns).
-- We often filter profiles by role and is_available_for_jobs.
create index if not exists idx_profiles_role_availability
  on public.profiles (role, is_available_for_jobs);

-- 3. Optimized index for live helpers window.
create index if not exists idx_freelancer_profiles_live_window
  on public.freelancer_profiles (live_until)
  where live_until > now();

-- 4. Speed up the reply stats calculation by ensuring messages are indexed by conversation + sender.
create index if not exists idx_messages_conversation_sender_created
  on public.messages (conversation_id, sender_id, created_at);

analyze public.job_requests;
analyze public.profiles;
analyze public.freelancer_profiles;
analyze public.messages;
