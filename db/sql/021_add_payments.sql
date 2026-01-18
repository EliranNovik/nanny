-- 021_add_payments.sql
-- Add payments table to track job payments

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_requests(id) on delete cascade,
  freelancer_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  
  -- Payment details
  hours_worked numeric(5,2) not null,
  hourly_rate numeric(10,2) not null,
  subtotal numeric(10,2) not null,
  vat_rate numeric(5,2) not null default 18.00,
  vat_amount numeric(10,2) not null,
  total_amount numeric(10,2) not null,
  
  -- Payment status
  status text not null default 'pending', -- 'pending', 'accepted', 'declined', 'paid', 'cancelled'
  
  -- Timestamps
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Create indexes
create index if not exists idx_payments_job_id on public.payments(job_id);
create index if not exists idx_payments_freelancer_id on public.payments(freelancer_id);
create index if not exists idx_payments_client_id on public.payments(client_id);
create index if not exists idx_payments_status on public.payments(status);
create index if not exists idx_payments_created_at on public.payments(created_at);

-- Enable RLS
alter table public.payments enable row level security;

-- RLS Policies
-- Freelancers can view their own payments
create policy "payments_select_freelancer"
on public.payments for select
using (auth.uid() = freelancer_id);

-- Clients can view payments for their jobs
create policy "payments_select_client"
on public.payments for select
using (auth.uid() = client_id);

-- Freelancers can insert payments for their jobs
create policy "payments_insert_freelancer"
on public.payments for insert
with check (
  auth.uid() = freelancer_id
  and auth.uid() in (
    select selected_freelancer_id 
    from public.job_requests 
    where id = job_id
  )
);

-- Freelancers can update their own pending payments
create policy "payments_update_freelancer"
on public.payments for update
using (auth.uid() = freelancer_id and status = 'pending')
with check (auth.uid() = freelancer_id);

-- Clients can update payment status from pending to accepted or declined
create policy "payments_update_client_accept_decline"
on public.payments for update
using (
  auth.uid() = client_id
  and status = 'pending'
)
with check (
  auth.uid() = client_id
  and status in ('accepted', 'declined')
);

-- Clients can update payment status from accepted to paid
create policy "payments_update_client_paid"
on public.payments for update
using (
  auth.uid() = client_id
  and status = 'accepted'
)
with check (
  auth.uid() = client_id
  and status = 'paid'
);

-- Add comment
comment on table public.payments is 'Tracks payments for completed jobs';
comment on column public.payments.hours_worked is 'Number of hours worked';
comment on column public.payments.hourly_rate is 'Hourly rate in the payment';
comment on column public.payments.subtotal is 'Subtotal before VAT (hours_worked * hourly_rate)';
comment on column public.payments.vat_rate is 'VAT rate percentage (default 18%)';
comment on column public.payments.vat_amount is 'VAT amount calculated';
comment on column public.payments.total_amount is 'Total amount including VAT';
comment on column public.payments.status is 'Payment status: pending, paid, cancelled';

-- Add updated_at trigger
do $$ begin
  create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;
