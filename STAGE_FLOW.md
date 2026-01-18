# Job Stage Flow - Aligned with Job Steps

## Stage Progression

The stages are now perfectly aligned with the job steps shown in the ChatPage sidebar:

### Stage Flow:

1. **Request** (Before Step 1)
   - **When**: Job is created
   - **Backend**: Set in `jobsRouter.post("/")` when job is created
   - **UI**: Step 0 in Job Steps sidebar
   - **Next**: Moves to "Price Offer" when freelancer sends price offer

2. **Price Offer** (Step 1)
   - **When**: Freelancer sends a price offer
   - **Frontend**: Set in ChatPage when price offer is sent (line ~1304)
   - **UI**: Step 1 in Job Steps sidebar
   - **Next**: Stays at "Price Offer" when accepted, moves to "Schedule" when schedule is confirmed

3. **Schedule** (Step 2)
   - **When**: Schedule is confirmed by both parties
   - **Frontend**: Set in ChatPage when schedule is confirmed (multiple places)
   - **UI**: Step 2 in Job Steps sidebar
   - **Next**: Moves to "Job in Progress" when job starts

4. **Job in Progress** (Step 3)
   - **When**: Job start is confirmed by client
   - **Frontend**: Set in ChatPage when job start is confirmed (line ~2009)
   - **UI**: Step 3 in Job Steps sidebar
   - **Next**: Moves to "Job Ended" when freelancer ends the job

5. **Job Ended** (Step 4)
   - **When**: Job end is confirmed by client
   - **Frontend**: Set in ChatPage when job end is confirmed (line ~2189)
   - **UI**: Step 4 in Job Steps sidebar
   - **Next**: Moves to "Payment" when payment request is created

6. **Payment** (Step 5)
   - **When**: Freelancer creates payment request
   - **Frontend**: Set in ChatPage when payment is created (line ~2673)
   - **UI**: Step 5 in Job Steps sidebar
   - **Next**: Moves to "Completed" when payment is marked as paid

7. **Completed** (After Step 5)
   - **When**: Payment is marked as paid by client
   - **Frontend**: Set in ChatPage when payment is completed (line ~2347)
   - **UI**: Final state after all steps
   - **Next**: Final state - no further transitions

## Stage Transition Points

### Backend (apps/api/src/routes/jobs.ts):
- **Job Creation**: `stage: "Request"` (line 41)
- **Job Selection**: Sets stage based on price offer status:
  - No price offer → `"Request"`
  - Price offer pending → `"Price Offer"`
  - Price offer accepted → `"Price Offer"` (will move to Schedule when schedule confirmed)
- **Job Restart**: Resets to `"Request"` (line 487)

### Frontend (apps/web/src/pages/ChatPage.tsx):
- **Price Offer Sent**: `stage: "Price Offer"` (line ~1304)
- **Price Offer Revised**: `stage: "Price Offer"` (line ~2783)
- **Price Offer Accepted**: `stage: "Price Offer"` (line ~1389) - stays at Price Offer, doesn't jump to Schedule
- **Schedule Confirmed**: `stage: "Schedule"` (multiple places: lines 461, 609, 1491, 1609, 1828)
- **Job Started**: `stage: "Job in Progress"` (line ~2009)
- **Job Ended**: `stage: "Job Ended"` (line ~2189)
- **Payment Created**: `stage: "Payment"` (line ~2673)
- **Payment Paid**: `stage: "Completed"` (line ~2347)

## Verification Checklist

✅ **Request Stage**
- Set when job is created
- Shown as Step 0 in Job Steps
- Remains until price offer is sent

✅ **Price Offer Stage**
- Set when freelancer sends price offer
- Shown as Step 1 in Job Steps
- Remains when price offer is accepted (doesn't jump to Schedule)
- Only moves to Schedule when schedule is confirmed

✅ **Schedule Stage**
- Set when schedule is confirmed
- Shown as Step 2 in Job Steps
- Remains until job starts

✅ **Job in Progress Stage**
- Set when job start is confirmed
- Shown as Step 3 in Job Steps
- Remains until job ends

✅ **Job Ended Stage**
- Set when job end is confirmed
- Shown as Step 4 in Job Steps
- Remains until payment is created

✅ **Payment Stage**
- Set when payment request is created
- Shown as Step 5 in Job Steps
- Remains until payment is paid

✅ **Completed Stage**
- Set when payment is marked as paid
- Final state after all steps
- No further transitions

## Important Notes

1. **Price Offer Acceptance**: When a price offer is accepted, the stage stays at "Price Offer" (not "Schedule"). It only moves to "Schedule" when the schedule is actually confirmed.

2. **Job Selection**: When a client selects a freelancer, the stage is set based on whether a price offer has been sent:
   - No price offer → "Request"
   - Price offer pending → "Price Offer"
   - Price offer accepted → "Price Offer" (will move to Schedule when schedule confirmed)

3. **Stage Badges**: Stage badges appear throughout the app wherever jobs are displayed, showing the current stage aligned with the job steps.
