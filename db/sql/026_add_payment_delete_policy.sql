-- 026_add_payment_delete_policy.sql
-- Allow freelancers to delete their own pending payments

-- Freelancers can delete their own pending payments
create policy "payments_delete_freelancer"
on public.payments for delete
using (
  auth.uid() = freelancer_id
  and status = 'pending'
);

-- Add comment
comment on policy "payments_delete_freelancer" on public.payments is 'Freelancers can delete their own pending payments';
