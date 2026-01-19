-- 029_setup_avatars_storage_policies.sql
-- RLS Policies for avatars storage bucket
-- Allows users to upload, read, and delete their own avatar images

-- Ensure RLS is enabled on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "avatars_read_public" ON storage.objects;
DROP POLICY IF EXISTS "avatars_upload_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;

-- Policy 1: Public read access to avatars
CREATE POLICY "avatars_read_public"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

-- Policy 2: Authenticated users can upload their own avatars
-- File name format: {user_id}-{timestamp}.{ext} (stored in bucket root)
-- Checks that filename starts with the user's UUID
CREATE POLICY "avatars_upload_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND (name LIKE auth.uid()::text || '-%')
);

-- Policy 3: Users can delete their own avatars
CREATE POLICY "avatars_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (name LIKE auth.uid()::text || '-%')
);

-- Policy 4: Users can update their own avatars
CREATE POLICY "avatars_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (name LIKE auth.uid()::text || '-%')
)
WITH CHECK (
  bucket_id = 'avatars' 
  AND (name LIKE auth.uid()::text || '-%')
);
