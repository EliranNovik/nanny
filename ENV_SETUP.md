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
WEB_APP_ORIGIN=http://localhost:5175

# Didit identity verification (https://business.didit.me)
DIDIT_API_KEY=your-didit-api-key
DIDIT_WORKFLOW_ID=your-workflow-uuid-from-console
DIDIT_WEBHOOK_SECRET=your-webhook-destination-secret
APP_ORIGIN=http://localhost:5175
```

**Production webhook URL (Didit Console → Developers → Webhooks → Add destination):**
`https://YOUR-API-DOMAIN/api/kyc/webhook`

Subscribe to at least: `status.updated`, `data.updated`

**Note:** `DIDIT_WORKFLOW_ID` is the workflow **UUID** from Didit Console → Workflows (not the public `/u/...` link slug). The hosted link `https://verify.didit.me/u/-mQ_hAf4RVe-6MXsQvrsgw` maps to that workflow internally.

Run migration `db/sql/084_profile_kyc_didit.sql` in Supabase SQL Editor before testing.

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

## Post link previews (WhatsApp / iMessage)

When someone pastes a shared post link (`/community/feed?post=…`), messengers fetch Open Graph HTML from your **frontend** domain.

### Production URLs (MamaLama on Render)

| Service | URL |
|---------|-----|
| Frontend | `https://mamalama.onrender.com` |
| Backend API | `https://mamalama-backend.onrender.com` |

**Backend** (`mamalama-backend` on Render):

```env
WEB_APP_ORIGIN=https://mamalama.onrender.com
CORS_ORIGIN=https://mamalama.onrender.com
```

**Frontend** (`mamalama` on Render — must be a **Web Service**, not Static Site):

```env
VITE_API_BASE_URL=https://mamalama-backend.onrender.com
API_BASE_URL=https://mamalama-backend.onrender.com
```

Render frontend settings:

- Root directory: `apps/web`
- Build command: `npm install && npm run build`
- Start command: `npm start` (runs `server.mjs`, which serves OG HTML to crawlers)

Vercel uses `apps/web/middleware.ts`. Netlify uses `netlify.toml` + edge functions. Render uses `server.mjs`.

After deploy, test with [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) using:

`https://mamalama.onrender.com/community/feed?post={post-uuid}`

---

**Need help?** Check `SETUP.md` for more details.

