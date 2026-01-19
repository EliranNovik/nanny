# Simple Avatars Bucket Setup

## Step 1: Create Public Bucket
1. Go to Supabase Dashboard → **Storage**
2. Click **"New bucket"**
3. Name: `avatars`
4. **Public bucket**: ✅ YES (check this!)
5. Click **"Create bucket"**

## Step 2: Create Simple Policies
Go to the `avatars` bucket → **"Policies"** tab

### Policy 1: Allow Authenticated Users to Upload
- Click **"New Policy"**
- Name: `avatars_upload`
- Operation: `INSERT`
- Target roles: `authenticated`
- Policy definition: Just enter:
  ```
  bucket_id = 'avatars'
  ```
- Save

### Policy 2: Allow Authenticated Users to Delete
- Click **"New Policy"**
- Name: `avatars_delete`
- Operation: `DELETE`
- Target roles: `authenticated`
- Policy definition: Just enter:
  ```
  bucket_id = 'avatars'
  ```
- Save

**That's it!** The bucket is public so anyone can read (view images), and authenticated users can upload/delete.

## Why This Works
- **Public bucket** = anyone can read/view images (no SELECT policy needed)
- **Simple INSERT policy** = any authenticated user can upload
- **Simple DELETE policy** = any authenticated user can delete

**Note:** This is less restrictive than checking filenames, but it's much simpler and will work immediately. If you need stricter security later, we can add filename checks.
