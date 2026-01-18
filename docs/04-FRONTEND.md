# Frontend (React Vite + TypeScript + shadcn/ui)

## Setup

From apps/web:

```bash
npm install
npm run dev
```

## Environment Variables

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=http://localhost:4000
```

## File Structure

```
apps/web/
  src/
    main.tsx
    App.tsx
    index.css
    lib/
      supabase.ts      # Supabase client
      api.ts           # Backend API helpers
      utils.ts         # cn() utility
    context/
      AuthContext.tsx  # Auth state
    components/
      ui/              # shadcn/ui components
    pages/
      LoginPage.tsx
      OnboardingPage.tsx
      ChatPage.tsx
      client/
        CreateJobPage.tsx
        ConfirmedListPage.tsx
      freelancer/
        ProfilePage.tsx
        NotificationsPage.tsx
```

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| /login | LoginPage | Sign up / Sign in |
| /onboarding | OnboardingPage | Role selection + name/city |
| /client/create | CreateJobPage | Job wizard |
| /client/jobs/:jobId/confirmed | ConfirmedListPage | Confirmed freelancers |
| /freelancer/profile | ProfilePage | Freelancer profile |
| /freelancer/notifications | NotificationsPage | Job requests |
| /chat/:conversationId | ChatPage | Realtime chat |

## Key Components

### AuthContext
Manages user authentication state:
- user (Supabase User object)
- session
- profile (from profiles table)
- signIn, signUp, signOut functions

### lib/api.ts
Helper functions for backend calls:
```typescript
apiPost(path, body)  // POST with auth header
apiGet(path)         // GET with auth header
```

### lib/supabase.ts
Supabase client for:
- Auth
- Direct table queries (RLS enforced)
- Realtime subscriptions

## Page Details

### LoginPage
- Toggle between sign up and sign in
- Email + password auth
- Redirects to /onboarding on success

### OnboardingPage
- Step 1: Choose role (client or freelancer)
- Step 2: Enter name and city
- Creates/updates profile in profiles table
- If freelancer, also creates freelancer_profiles entry
- Redirects based on role

### CreateJobPage (Client)
Button-based wizard with 6 steps:
1. Care type (occasional, part-time, full-time)
2. Number of children
3. Age group
4. City (text input)
5. Shift duration
6. Budget and requirements

On submit:
- Calls POST /api/jobs
- Redirects to confirmed list

### ConfirmedListPage (Client)
- Shows countdown timer (90s default)
- Polls /api/jobs/:jobId/confirmed every 5s
- Displays freelancer cards with:
  - Avatar, name, city
  - Rating
  - Badges (first aid, experience)
  - Hourly rate
- "Select & Chat" button
- On select: POST /api/jobs/:jobId/select → redirect to chat

### ProfilePage (Freelancer)
- "Available Now" toggle (prominent)
- Bio textarea
- Language selection (multi-select buttons)
- Experience toggles (first aid, newborn, special needs)
- Max children selector
- Hourly rate range inputs
- Floating save button

### NotificationsPage (Freelancer)
- Lists pending job notifications
- Each shows:
  - Countdown timer
  - Job details (city, children, age group, budget)
  - Requirements badges
- "I'm Available" button
- Realtime subscription for new notifications

### ChatPage
- Header with other user's info
- Messages with date headers
- Own messages right-aligned (primary color)
- Other messages left-aligned (muted)
- Input field with send button
- Realtime subscription for new messages
- Auto-scroll to latest

## Styling

Using shadcn/ui components with custom theme:
- Primary: Orange/amber tones
- Secondary: Teal
- Accent: Pink
- Clean, modern UI
- Smooth animations
- DM Sans font

