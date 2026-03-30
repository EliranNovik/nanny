-- 041_storage_community_posts_bucket.sql
-- Creates the public storage bucket for community post images.
-- Fixes: StorageApiError "Bucket not found" on upload to community-posts.
-- Run in Supabase → SQL Editor (service role / postgres). Policies are in 037.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-posts',
  'community-posts',
  true,
  10485760, -- 10 MB per object
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do nothing;
