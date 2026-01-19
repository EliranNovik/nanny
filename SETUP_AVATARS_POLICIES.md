# Setup Avatars Storage Policies

## Why SQL Fails

The `storage.objects` table is a **system table** in Supabase. Regular SQL users (even with service role key) cannot create policies on it directly. This is a Supabase security feature.

**The ONLY way to create storage policies is through the Supabase Dashboard UI.**

## Step-by-Step Instructions

### 1. Go to Supabase Dashboard

- Open your Supabase project
- Navigate to **Storage** in the left sidebar

### 2. Create/Verify Bucket

- If `avatars` bucket doesn't exist:
  - Click **"New bucket"**
  - Name: `avatars`
  - **Public bucket**: ✅ YES (check this box)
  - Click **"Create bucket"**

### 3. Create Policies

- Click on the **`avatars`** bucket
- Go to the **"Policies"** tab
- Click **"New Policy"**

#### Policy 1: Public Read

- Click **"New Policy"**
- **Policy name**: `avatars_read_public`
- **Allowed operation**: Select `SELECT` from dropdown
- In the **"Policy definition"** field, enter ONLY this (no CREATE POLICY, no semicolons):
  ```
  bucket_id = 'avatars'
  ```
- Click **"Review"** → **"Save policy"**

#### Policy 2: Upload Own Avatar

- Click **"New Policy"** again
- **Policy name**: `avatars_upload_own`
- **Allowed operation**: Select `INSERT` from dropdown
- **Target roles**: Check the box for `authenticated`
- In the **"Policy definition"** field (WITH CHECK), enter ONLY this:
  ```
  bucket_id = 'avatars' AND (name LIKE auth.uid()::text || '-%')
  ```
- Click **"Review"** → **"Save policy"**

#### Policy 3: Delete Own Avatar

- Click **"New Policy"** again
- **Policy name**: `avatars_delete_own`
- **Allowed operation**: Select `DELETE` from dropdown
- **Target roles**: Check the box for `authenticated`
- In the **"Policy definition"** field (USING), enter ONLY this:
  ```
  bucket_id = 'avatars' AND (name LIKE auth.uid()::text || '-%')
  ```
- Click **"Review"** → **"Save policy"**

#### Policy 4: Update Own Avatar (Optional)

- Click **"New Policy"** again
- **Policy name**: `avatars_update_own`
- **Allowed operation**: Select `UPDATE` from dropdown
- **Target roles**: Check the box for `authenticated`
- In the **"USING"** field, enter:
  ```
  bucket_id = 'avatars' AND (name LIKE auth.uid()::text || '-%')
  ```
- In the **"WITH CHECK"** field, enter:
  ```
  bucket_id = 'avatars' AND (name LIKE auth.uid()::text || '-%')
  ```
- Click **"Review"** → **"Save policy"**

### 4. Test

After creating all policies, try uploading a profile image in your app. The RLS error should be resolved!

## Why This Works

The Dashboard UI has special permissions that bypass the normal SQL restrictions. It's the official and only supported way to create storage policies in Supabase.
