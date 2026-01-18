# 🔧 Quick Fix: Invalid Keys Error

## The Problem
Your `.env` file shows correct values in the editor, but the file on disk still has placeholders. This means **the file wasn't saved**.

## Solution (3 Steps)

### Step 1: Save the File
In VS Code, make sure you **save** the `apps/web/.env` file:
- Press **Cmd+S** (Mac) or **Ctrl+S** (Windows/Linux)
- Or go to **File → Save**
- You should see the file name in the tab change from having a dot (unsaved) to no dot (saved)

### Step 2: Verify It's Saved
Check that your `.env` file has these values (NOT placeholders):
```env
VITE_SUPABASE_URL=https://vpdlhlxvhoiyoetugsfx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (full key)
VITE_API_BASE_URL=http://localhost:4000
```

**Important:** Make sure the `VITE_SUPABASE_ANON_KEY` is the **complete** key (it's very long, usually 200+ characters).

### Step 3: Restart Dev Server
Vite **requires a restart** to pick up `.env` changes:

1. **Stop the current server:**
   - In the terminal where `npm run dev` is running
   - Press **Ctrl+C**

2. **Start it again:**
   ```bash
   cd apps/web
   npm run dev
   ```

3. **Refresh your browser** (hard refresh: Cmd+Shift+R or Ctrl+Shift+R)

## Still Not Working?

If you still see errors after restarting:

1. **Check the anon key is complete:**
   - The key should be very long (200+ characters)
   - It starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.`
   - Make sure it's all on one line, no line breaks

2. **Check for extra spaces:**
   - No spaces around the `=` sign
   - No quotes around the values
   - No trailing spaces

3. **Verify in Supabase:**
   - Go to your Supabase project
   - Settings → API
   - Make sure you're copying the **anon public** key (not service_role)

4. **Check browser console:**
   - Open DevTools (F12)
   - Look for any new error messages
   - The config check overlay should disappear once keys are valid

