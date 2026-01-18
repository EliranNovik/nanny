# Deployment MVP

## Supabase Setup

1. Create project at https://supabase.com
2. Run db/sql files in order via SQL Editor:
   - 001_init.sql
   - 002_rls.sql  
   - 003_policies.sql
3. Enable Realtime:
   - Go to Database → Replication
   - Enable for `messages` table
   - Enable for `job_candidate_notifications` table
4. Auth configuration:
   - Go to Authentication → URL Configuration
   - Add your frontend URLs to Site URL and Redirect URLs

## Backend Deployment (Render / Railway / Fly.io)

### Render
1. Create new Web Service
2. Connect GitHub repo
3. Settings:
   - Build Command: `cd apps/api && npm install && npm run build`
   - Start Command: `cd apps/api && npm start`
4. Environment Variables:
   ```
   PORT=4000
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   CORS_ORIGIN=https://your-frontend.vercel.app
   ```

### Railway
1. Create new project from GitHub
2. Add environment variables
3. Configure build/start commands

## Frontend Deployment (Vercel / Netlify)

### Vercel
1. Import GitHub repo
2. Framework Preset: Vite
3. Root Directory: `apps/web`
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Environment Variables:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_API_BASE_URL=https://your-backend.onrender.com
   ```

### Netlify
1. Import from GitHub
2. Base directory: `apps/web`
3. Build command: `npm run build`
4. Publish directory: `apps/web/dist`
5. Add environment variables

## Security Checklist

- [ ] Service role key is ONLY in backend environment
- [ ] Frontend only uses anon key
- [ ] CORS_ORIGIN matches frontend domain exactly
- [ ] RLS is enabled on all tables
- [ ] All trusted operations go through backend

## Post-Deploy Verification

1. Sign up a test client user
2. Sign up a test freelancer user
3. Freelancer: Complete profile, toggle available
4. Client: Create job request
5. Freelancer: Should see notification
6. Freelancer: Tap "I'm Available"
7. Client: Should see freelancer card
8. Client: Select freelancer
9. Both: Should be in chat, messages work realtime

## Next Upgrades (After MVP)

### Phase 1: Essential
- [ ] Geo radius matching (PostGIS or distance calc)
- [ ] Email notifications (job requests, selections)
- [ ] Profile photos upload
- [ ] Job history view

### Phase 2: Engagement
- [ ] Push notifications (FCM/APNs)
- [ ] Rating system after job completion
- [ ] Favorites/saved freelancers
- [ ] Repeat booking

### Phase 3: Monetization
- [ ] Payments (Stripe)
- [ ] Service fees
- [ ] Premium features for freelancers

### Phase 4: Trust & Safety
- [ ] Background check integration
- [ ] ID verification
- [ ] Dispute resolution
- [ ] Anti-abuse measures (rate limits, bot detection)

### Technical Debt
- [ ] Add comprehensive error handling
- [ ] Add input validation (more robust)
- [ ] Add loading states everywhere
- [ ] Add proper TypeScript types for Supabase
- [ ] Add tests
- [ ] Add logging/monitoring

