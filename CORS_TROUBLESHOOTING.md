# 🔧 CORS Error Troubleshooting Guide

## The Problem
You're seeing errors like:
```
Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at https://vpdlhlxvhoiyoetugsfx.supabase.co/auth/v1/token
NetworkError when attempting to fetch resource
```

## Most Common Cause: Supabase Project is Paused

**Free tier Supabase projects automatically pause after 7 days of inactivity.**

### Solution: Restore Your Project

1. **Go to Supabase Dashboard**
   - Visit https://supabase.com/dashboard
   - Sign in to your account

2. **Check Project Status**
   - Look for your project in the list
   - If it shows "Paused" or has a pause icon, click on it

3. **Restore the Project**
   - Click the "Restore" or "Resume" button
   - Wait 1-2 minutes for the project to come back online

4. **Verify It's Active**
   - The project should show as "Active" in green
   - Try accessing your project settings

5. **Refresh Your Browser**
   - Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows/Linux)
   - Try logging in again

## Other Possible Causes

### 2. Network Connectivity Issues
- Check your internet connection
- Try accessing https://supabase.com in your browser
- Disable VPN if you're using one
- Check if your firewall is blocking requests

### 3. Browser Extensions
- Ad blockers or privacy extensions can block Supabase requests
- Try disabling extensions temporarily
- Use an incognito/private window to test

### 4. Environment Variables
- Make sure `apps/web/.env` has correct values:
  ```env
  VITE_SUPABASE_URL=https://vpdlhlxvhoiyoetugsfx.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  ```
- Restart the dev server after changing `.env`:
  ```bash
  # Stop server (Ctrl+C)
  cd apps/web
  npm run dev
  ```

### 5. Supabase Project Settings
- Go to **Authentication → URL Configuration** in Supabase dashboard
- Make sure `http://localhost:5175` is in the allowed URLs
- Add it to "Site URL" and "Redirect URLs" if needed

## Quick Test

To verify Supabase is reachable, open your browser console and run:
```javascript
fetch('https://vpdlhlxvhoiyoetugsfx.supabase.co/rest/v1/', {
  method: 'GET',
  headers: {
    'apikey': 'YOUR_ANON_KEY_HERE'
  }
})
.then(r => console.log('✅ Supabase is reachable', r))
.catch(e => console.error('❌ Cannot reach Supabase', e));
```

If this fails, your project is likely paused or there's a network issue.

## Still Not Working?

1. **Check Supabase Status Page**: https://status.supabase.com
2. **Verify Project URL**: Make sure the URL in `.env` matches your project
3. **Check Browser Console**: Look for more specific error messages
4. **Try Different Browser**: Rule out browser-specific issues
