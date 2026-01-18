# 🔧 Environment Variables Setup

## ⚠️ Error: "supabaseUrl is required"

This error means your `.env` files are missing or incomplete. Follow these steps:

## Step 1: Get Your Supabase Credentials

1. Go to https://supabase.com and sign in
2. Create a new project (or use existing)
3. Go to **Project Settings** → **API**
4. Copy these values:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY` (frontend)
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (backend) ⚠️ Keep secret!

## Step 2: Update Frontend `.env`

Edit `apps/web/.env`:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_API_BASE_URL=http://localhost:4000
```

**Replace:**
- `xxxxxxxxxxxxx` with your actual project ID
- `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` with your actual anon key

## Step 3: Update Backend `.env`

Edit `apps/api/.env`:

```env
PORT=4000
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
CORS_ORIGIN=http://localhost:5175
```

**Replace:**
- `xxxxxxxxxxxxx` with your actual project ID (same as frontend)
- `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` with your actual service_role key

## Step 4: Restart Servers

After updating `.env` files, **restart both servers**:

1. Stop the current servers (Ctrl+C in terminals)
2. Restart backend:
   ```bash
   cd apps/api
   npm run dev
   ```
3. Restart frontend:
   ```bash
   cd apps/web
   npm run dev
   ```

## Step 5: Setup Database

Before the app works, you need to run the SQL migrations:

1. In Supabase Dashboard, go to **SQL Editor**
2. Run these files **in order**:
   - Copy/paste contents of `db/sql/001_init.sql` → Run
   - Copy/paste contents of `db/sql/002_rls.sql` → Run
   - Copy/paste contents of `db/sql/003_policies.sql` → Run
3. Enable Realtime:
   - Go to **Database** → **Replication**
   - Enable replication for `messages` table
   - Enable replication for `job_candidate_notifications` table

## ✅ Verification

After setup, you should see:
- No errors in browser console
- Backend running on http://localhost:4000
- Frontend running on http://localhost:5175
- Login page loads successfully

---

**Need help?** Check `SETUP.md` for more details.

