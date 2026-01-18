# Backend (Node.js + Express + TypeScript) MVP

Backend responsibilities (trusted):
- Create job request and set it to "ready"
- Find matching freelancers
- Create candidate notifications records
- Open confirmation window (set confirm_starts_at/ends_at, status=notifying)
- Close window and mark expired notifications
- Lock job to selected freelancer
- Create conversation row (job chat)

## Setup

From apps/api:

```bash
npm install
npm run dev
```

## Environment Variables

```
PORT=4000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CORS_ORIGIN=http://localhost:5173
```

## File Structure

```
apps/api/
  src/
    index.ts           # Express app entry
    supabase.ts        # Admin client
    middleware/
      auth.ts          # Token verification
    logic/
      match.ts         # Candidate matching
    routes/
      jobs.ts          # All job endpoints
```

## API Endpoints

All endpoints require `Authorization: Bearer <token>` header.

### POST /api/jobs
Create job and start notifying candidates.

Request:
```json
{
  "care_type": "occasional",
  "children_count": 2,
  "children_age_group": "toddler",
  "location_city": "Tel Aviv",
  "shift_hours": "up_to_4",
  "languages_pref": ["Hebrew", "English"],
  "requirements": ["first_aid"],
  "budget_min": 50,
  "budget_max": 80,
  "confirm_window_seconds": 90
}
```

Response:
```json
{
  "job_id": "uuid",
  "confirm_ends_at": "2024-01-15T10:01:30.000Z"
}
```

### POST /api/jobs/:jobId/notifications/:notifId/open
Mark notification as opened (freelancer viewed it).

Response:
```json
{ "ok": true }
```

### POST /api/jobs/:jobId/confirm
Freelancer confirms availability within window.

Response:
```json
{ "ok": true }
```

### GET /api/jobs/:jobId/confirmed
Client fetches confirmed freelancers.

Response:
```json
{
  "freelancers": [
    {
      "id": "uuid",
      "full_name": "Jane Doe",
      "photo_url": null,
      "city": "Tel Aviv",
      "freelancer_profiles": {
        "bio": "...",
        "has_first_aid": true,
        "rating_avg": 4.8,
        "hourly_rate_min": 50,
        "hourly_rate_max": 70
      }
    }
  ]
}
```

### POST /api/jobs/:jobId/select
Client selects freelancer, locks job, creates conversation.

Request:
```json
{
  "freelancer_id": "uuid"
}
```

Response:
```json
{
  "conversation_id": "uuid"
}
```

### GET /api/jobs/:jobId
Get job details (for client or selected freelancer).

Response:
```json
{
  "job": { ... }
}
```

## Matching Logic

Located in `src/logic/match.ts`.

MVP matching criteria:
1. Same city
2. Freelancer has `available_now = true`
3. Freelancer's `max_children >= job.children_count`
4. If job requires first_aid, freelancer must have it
5. If job requires newborn experience, freelancer must have it
6. If job requires special_needs experience, freelancer must have it
7. Budget overlap check
8. Language preference check

Future improvements:
- Geo radius matching (PostGIS)
- Ranking by rating
- Distance-based sorting

