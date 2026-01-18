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

## Repo structure (suggested)

repo/
apps/
web/ # React Vite app
api/ # Node Express API
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

## Minimum feature set that "works"

1. User signs up, chooses role: client or freelancer
2. Freelancer completes profile with availability flags and preferences
3. Client creates nanny request through button steps
4. Backend finds candidates and inserts notifications
5. Freelancers tap "Available" within window
6. Client sees confirmed freelancer cards and selects one
7. Job becomes locked, chat opens, job lifecycle begins

## Environment variables

Frontend (apps/web/.env):

- VITE_SUPABASE_URL=
- VITE_SUPABASE_ANON_KEY=
- VITE_API_BASE_URL=http://localhost:4000

Backend (apps/api/.env):

- PORT=4000
- SUPABASE_URL=
- SUPABASE_SERVICE_ROLE_KEY=
- SUPABASE_JWT_SECRET= (optional if you verify Supabase JWT locally)
- CORS_ORIGIN=http://localhost:5173

## Run locally

1. Create Supabase project and run SQL files from db/sql in order
2. Start API:
   cd apps/api
   npm i
   npm run dev
3. Start Web:
   cd apps/web
   npm i
   npm run dev

Go to http://localhost:5173
