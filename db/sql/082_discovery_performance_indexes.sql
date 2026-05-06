-- 082_discovery_performance_indexes.sql
-- Speed up discovery home page and search by adding missing composite indexes.

-- 1. Profiles: Speed up 'helpers near location' and general role-based filtering
create index if not exists idx_profiles_role_available 
  on public.profiles (role, is_available_for_jobs) 
  where role in ('freelancer', 'client');

create index if not exists idx_profiles_verified 
  on public.profiles (is_verified) 
  where is_verified = true;

-- 2. Job Requests: Speed up discovery open help requests (filter by status + community_post_id)
create index if not exists idx_job_requests_open_discovery 
  on public.job_requests (status, community_post_id) 
  where community_post_id is null;

-- 3. Conversations: Speed up finding unique conversations between two users
-- This is used for the 'any-to-any' messaging fix to quickly find existing threads
create index if not exists idx_conversations_participants_unique
  on public.conversations (client_id, freelancer_id);

-- 4. Messages: Ensure unread counts are as fast as possible
-- Composite index for (conversation_id, sender_id) with partial filter for unread
create index if not exists idx_messages_unread_lookup
  on public.messages (conversation_id, sender_id)
  where read_at is null;

-- Secondary index for general unread count across all conversations for a user
-- This helps useUnreadCounts.ts when it doesn't have conversation IDs yet
create index if not exists idx_messages_unread_sender_composite
  on public.messages (sender_id, created_at desc)
  where read_at is null;

