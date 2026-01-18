# 🗄️ Database Migration Instructions

## ⚠️ Error: "Could not find the table 'public.payments'"

This error means you need to run the payments migration in Supabase.

## Quick Fix: Run the Payments Migration

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Sign in and select your project

### Step 2: Open SQL Editor
1. Click **"SQL Editor"** in the left sidebar
2. Click **"New query"** button (top right)

### Step 3: Run the Migration
1. Open the file `db/sql/021_add_payments.sql` in your code editor
2. **Copy the entire contents** of the file
3. **Paste** it into the Supabase SQL Editor
4. Click **"Run"** button (or press `Cmd+Enter` / `Ctrl+Enter`)

### Step 4: Verify
1. Go to **"Table Editor"** in the left sidebar
2. You should see the `payments` table listed
3. If you see it, the migration was successful! ✅

### Step 5: Refresh Your App
1. **Hard refresh** your browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows/Linux)
2. Try creating a payment again

---

## Also Check: Stage Migration

If you're also getting errors about stages, make sure you've run:
- `db/sql/020_add_job_stage.sql`

Run it the same way as above.

---

## Complete Migration Order

If setting up from scratch, run migrations in this order:

1. `001_init.sql` - Base tables
2. `002_rls.sql` - Enable RLS
3. `003_policies.sql` - Initial policies
4. `004_read_receipts.sql` - Message read receipts
5. `005_fix_job_requests_policy.sql` - Job requests policy fix
6. `006_enable_realtime.sql` - Enable realtime
7. `007_fix_notifications_complete.sql` - Notifications fix
8. `008_add_message_attachments.sql` - Message attachments
9. `009_setup_storage_bucket.sql` - Storage setup
10. `010_add_messages_update_policy.sql` - Messages update policy
11. `011_add_notifications_delete_policy.sql` - Notifications delete
12. `012_add_job_requests_delete_policy.sql` - Job requests delete
13. `013_add_expired_acceptance.sql` - Expired acceptance
14. `014_rename_expired_to_open_job.sql` - Open job rename
15. `015_add_price_offer.sql` - Price offer fields
16. `016_allow_freelancer_price_offer_update.sql` - Freelancer price update
17. `017_add_schedule_confirmed.sql` - Schedule confirmed
18. `018_add_admin_role.sql` - Admin role
19. `019_admin_reports.sql` - Admin reports
20. `020_add_job_stage.sql` - **Job stages** ⚠️ Required
21. `021_add_payments.sql` - **Payments table** ⚠️ Required

---

## Troubleshooting

### Error: "relation already exists"
- The table already exists, which is fine
- The migration uses `create table if not exists` so it's safe to run again

### Error: "permission denied"
- Make sure you're running as the database owner
- In Supabase, you should have full permissions by default

### Error: "function set_updated_at() does not exist"
- Make sure you've run `001_init.sql` first
- That file creates the `set_updated_at()` function

### Table still not found after migration
1. Wait 10-20 seconds (Supabase needs to refresh schema cache)
2. Hard refresh your browser
3. Check Table Editor to confirm the table exists
4. If it exists in Table Editor but code still errors, restart your dev server

---

## Need Help?

If you continue to have issues:
1. Check the Supabase SQL Editor for any error messages
2. Verify the table exists in Table Editor
3. Make sure you're connected to the correct Supabase project
4. Check that your `.env` files point to the correct Supabase URL
