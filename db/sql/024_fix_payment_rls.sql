-- 024_fix_payment_rls.sql
-- Fix RLS policies for payment updates
-- The error "new row violates row-level security policy" suggests the WITH CHECK clause is failing

-- Drop existing client update policies if they exist
drop policy if exists "payments_update_client_accept_decline" on public.payments;
drop policy if exists "payments_update_client_paid" on public.payments;
drop policy if exists "payments_update_client" on public.payments;

-- Clients can update payment status from pending to accepted
create policy "payments_update_client_pending_to_accepted"
on public.payments for update
using (
  auth.uid() = client_id
  and status = 'pending'
)
with check (
  auth.uid() = client_id
  and status = 'accepted'
);

-- Clients can update payment status from pending to declined
create policy "payments_update_client_pending_to_declined"
on public.payments for update
using (
  auth.uid() = client_id
  and status = 'pending'
)
with check (
  auth.uid() = client_id
  and status = 'declined'
);

-- Clients can update payment status from accepted to paid
create policy "payments_update_client_accepted_to_paid"
on public.payments for update
using (
  auth.uid() = client_id
  and status = 'accepted'
)
with check (
  auth.uid() = client_id
  and status = 'paid'
);
