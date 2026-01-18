# Nanny Marketplace MVP (React + Vite + TS + shadcn/ui + Supabase + Node)

This MVP implements:

- Supabase Auth (email + password)
- Profiles (client + freelancer)
- Job Requests (structured answers)
- Candidate notifications (in-app + optional push later)
- Availability confirmations window
- Matching and job locking
- Realtime messaging per job

Tech:

- Frontend: React + Vite + TypeScript + shadcn/ui + Tailwind
- Backend: Node.js + Express + TypeScript
- DB + Auth + Realtime: Supabase

## High level architecture

- Supabase handles: Auth, Postgres tables, RLS, Realtime (chat, notifications).
- Node backend handles:
  - job creation orchestration
  - candidate selection logic
  - opening and closing confirmation windows
  - locking a job to the selected freelancer
  - server-only actions using Supabase service role key

Frontend calls backend endpoints for anything that must be trusted and not forged.

## Repo structure

```
repo/
  apps/
    web/            # React Vite app
    api/            # Node Express API
  db/
    sql/
      001_init.sql
      002_rls.sql
      003_policies.sql
  docs/
    01-README.md
    02-DB.md
    03-BACKEND.md
    04-FRONTEND.md
    05-DEPLOY.md
```

## Minimum feature set that "works"

1. User signs up, chooses role: client or freelancer
2. Freelancer completes profile with availability flags and preferences
3. Client creates nanny request through button steps
4. Backend finds candidates and inserts notifications
5. Freelancers tap "Available" within window
6. Client sees confirmed freelancer cards and selects one
7. Job becomes locked, chat opens, job lifecycle begins

## Environment variables

### Frontend (apps/web/.env)

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=http://localhost:4000
```

### Backend (apps/api/.env)

```
PORT=4000
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CORS_ORIGIN=http://localhost:5173
```

## Run locally

### 1. Setup Supabase

1. Create a new Supabase project at https://supabase.com
2. Go to SQL Editor and run the SQL files from `db/sql/` in order:
   - `001_init.sql`
   - `002_rls.sql`
   - `003_policies.sql`
3. Enable Realtime on the `messages` table:
   - Go to Database → Replication
   - Enable replication for `messages` table

### 2. Start Backend

```bash
cd apps/api
npm install
# Create .env with your Supabase credentials
npm run dev
```

### 3. Start Frontend

```bash
cd apps/web
npm install
# Create .env with your Supabase credentials
npm run dev
```

Go to http://localhost:5173

## User Flow

### Client Flow

1. Sign up / Login → Onboarding (select "I need a nanny")
2. Fill name + city → Redirected to Job Wizard
3. Step through wizard (care type → children count → age → city → duration → budget)
4. Submit → Matching freelancers notified
5. Wait for confirmations (90 second window)
6. See confirmed freelancer cards → Select one
7. Chat opens with selected freelancer

### Freelancer Flow

1. Sign up / Login → Onboarding (select "I'm a nanny")
2. Fill name + city → Redirected to Profile page
3. Complete profile (bio, languages, experience, rates)
4. Toggle "Available Now" to receive notifications
5. When job request matches → Notification appears
6. Tap "I'm Available" within window
7. If selected → Chat opens with client
