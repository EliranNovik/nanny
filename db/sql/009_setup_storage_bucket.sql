-- 009_setup_storage_bucket.sql
-- Setup instructions for Supabase Storage bucket for chat attachments
-- Note: This needs to be run in Supabase Dashboard > Storage, not SQL Editor

-- ============================================
-- MANUAL SETUP REQUIRED IN SUPABASE DASHBOARD
-- ============================================
-- 
-- 1. Go to Supabase Dashboard > Storage
-- 2. Click "New bucket"
-- 3. Name: "chat-attachments"
-- 4. Public bucket: YES (so attachments can be accessed via public URLs)
-- 5. File size limit: 10MB (or your preferred limit)
-- 6. Allowed MIME types: Leave empty to allow all, or specify:
--    - image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*
--
-- ============================================
-- STORAGE POLICIES (Run in SQL Editor)
-- ============================================

-- Allow authenticated users to upload files to their conversation folders
create policy "chat_attachments_upload"
on storage.objects for insert
with check (
  bucket_id = 'chat-attachments'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] in (
    select id::text from public.conversations
    where client_id = auth.uid() or freelancer_id = auth.uid()
  )
);

-- Allow authenticated users to read files from conversations they're part of
create policy "chat_attachments_read"
on storage.objects for select
using (
  bucket_id = 'chat-attachments'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] in (
    select id::text from public.conversations
    where client_id = auth.uid() or freelancer_id = auth.uid()
  )
);

-- Allow users to delete their own uploaded files
create policy "chat_attachments_delete"
on storage.objects for delete
using (
  bucket_id = 'chat-attachments'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] in (
    select id::text from public.conversations
    where client_id = auth.uid() or freelancer_id = auth.uid()
  )
);

