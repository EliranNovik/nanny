# Quick Setup Guide

## 🚀 Starting the Project

### Step 1: Install Dependencies (Already Done ✅)
```bash
# Backend
cd apps/api
npm install

# Frontend  
cd apps/web
npm install
```

### Step 2: Setup Supabase

1. Create a project at https://supabase.com
2. Go to **SQL Editor** and run these files **in order**:
   - `db/sql/001_init.sql`
   - `db/sql/002_rls.sql`
   - `db/sql/003_policies.sql`
3. Enable Realtime:
   - Go to **Database → Replication**
   - Enable replication for `messages` table
   - Enable replication for `job_candidate_notifications` table

### Step 3: Create Environment Files

#### Backend (`apps/api/.env`)
```env
PORT=4000
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
CORS_ORIGIN=http://localhost:5173
```

**Where to find:**
- `SUPABASE_URL`: Project Settings → API → Project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Project Settings → API → service_role key (⚠️ Keep secret!)

#### Frontend (`apps/web/.env`)
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_API_BASE_URL=http://localhost:4000
```

**Where to find:**
- `VITE_SUPABASE_URL`: Same as above
- `VITE_SUPABASE_ANON_KEY`: Project Settings → API → anon public key

### Step 4: Start Servers

**Terminal 1 - Backend:**
```bash
cd apps/api
npm run dev
```
Should see: `🚀 API running on port 4000`

**Terminal 2 - Frontend:**
```bash
cd apps/web
npm run dev
```
Should see: `Local: http://localhost:5173`

### Step 5: Open in Browser
Go to: **http://localhost:5173**

---

## 🧪 Testing the Flow

1. **Sign up** as a Client
2. **Complete onboarding** (name + city)
3. **Create a job request** through the wizard
4. **Sign up** as a Freelancer (use different email)
5. **Complete onboarding** (name + city)
6. **Go to Profile**, toggle "Available Now"
7. **Go to Notifications** - you should see the job request
8. **Tap "I'm Available"** within 90 seconds
9. **Switch back to Client** - see confirmed freelancer
10. **Select freelancer** - chat opens!

---

## ⚠️ Troubleshooting

### Backend won't start
- Check `.env` file exists in `apps/api/`
- Verify all environment variables are set
- Check Node version (should be 20+, but 18.19 should work)

### Frontend won't start
- Check `.env` file exists in `apps/web/`
- Verify all environment variables are set
- Clear browser cache

### "Missing bearer token" errors
- Make sure you're logged in
- Check browser console for auth errors

### Realtime not working
- Verify Realtime is enabled in Supabase Dashboard
- Check browser console for WebSocket errors

---

## 📝 Next Steps After Setup

1. Test the full user flow (see above)
2. Customize the UI colors in `apps/web/tailwind.config.js`
3. Add your logo/branding
4. Deploy when ready (see `docs/05-DEPLOY.md`)

