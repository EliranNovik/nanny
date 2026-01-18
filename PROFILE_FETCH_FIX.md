# Profile Fetch Timeout Fix

## Problem
The profile fetch is timing out after 3 seconds, preventing users from accessing the app.

## Root Cause
The query to the `profiles` table is hanging, likely due to:
1. **RLS policies blocking the query** (most likely)
2. Supabase project being paused
3. Network connectivity issues

## Solution

### Step 1: Run the RLS Migration
**CRITICAL**: You must run this migration in Supabase SQL Editor:

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `db/sql/027_verify_profiles_rls.sql`
4. Click **Run**

This migration will:
- Drop and recreate the profiles RLS policies
- Ensure policies allow users to read their own profile
- Add an index for faster lookups

### Step 2: Verify Supabase Project Status
1. Go to https://supabase.com/dashboard
2. Check if your project is **Active** (not paused)
3. Free tier projects pause after 7 days of inactivity
4. If paused, click "Restore" to reactivate

### Step 3: Check Environment Variables
Verify `apps/web/.env` has correct values:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 4: Test the Fix
1. Clear browser cache and localStorage
2. Refresh the page
3. Check browser console for logs:
   - Should see "Query returned" within 3 seconds
   - If timeout, should see "⚠️ TIMEOUT" message
   - Should fall back to cached profile if available

## Debugging

If the issue persists after running the migration:

1. **Check Browser Network Tab**:
   - Open DevTools → Network tab
   - Look for requests to `profiles` table
   - Check if request is being sent
   - Check response status and headers

2. **Check Console Logs**:
   - Look for "[AuthContext] Query timeout" message
   - Check session details in logs
   - Verify access token is present

3. **Test Direct Query**:
   - In Supabase Dashboard → SQL Editor
   - Run: `SELECT * FROM profiles WHERE id = 'your-user-id';`
   - This will show if RLS is blocking the query

## Fallback Behavior

The app now includes:
- **3-second timeout** (reduced from 5 seconds)
- **Automatic cache fallback** if query times out
- **Better error logging** for debugging

If the query times out, the app will:
1. Try to use cached profile from localStorage
2. Allow user to proceed to onboarding if no cache
3. Log detailed error information for debugging
