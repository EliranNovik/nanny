# Supabase Storage Setup for Chat Attachments

## Quick Setup Steps

### Option 1: Via Supabase Dashboard (Recommended)

1. **Go to your Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your project

2. **Create Storage Bucket**
   - Click on **Storage** in the left sidebar
   - Click **New bucket** button
   - Fill in the details:
     - **Name**: `chat-attachments` (must match exactly)
     - **Public bucket**: ✅ **YES** (check this box)
     - **File size limit**: `10485760` (10MB in bytes) or leave empty for default
     - **Allowed MIME types**: Leave empty to allow all types
   - Click **Create bucket**

3. **Set up RLS Policies**
   - Go to **Storage** → **Policies** tab
   - Or run the SQL from `db/sql/009_setup_storage_bucket.sql` in the SQL Editor

### Option 2: Via SQL (Alternative)

You can also create the bucket via SQL, but it's easier through the dashboard:

```sql
-- Create bucket (if not exists)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  true,
  10485760, -- 10MB
  null -- null = allow all types
)
on conflict (id) do nothing;
```

Then run the policies from `db/sql/009_setup_storage_bucket.sql`

## Verify Setup

After creating the bucket, verify it exists:
1. Go to Storage → Buckets
2. You should see `chat-attachments` listed
3. It should show as "Public"

## Troubleshooting

### Error: "Bucket not found"
- Make sure the bucket name is exactly `chat-attachments` (case-sensitive)
- Verify the bucket exists in Storage → Buckets
- Check that you're using the correct Supabase project

### Error: "Permission denied"
- Make sure you've run the RLS policies from `009_setup_storage_bucket.sql`
- Verify the user is authenticated
- Check that the user is part of the conversation

### Files not uploading
- Check file size (max 10MB)
- Verify file type is allowed
- Check browser console for detailed error messages

