-- 023_add_currencies.sql
-- Add currencies table and link to payments

-- Create currencies table
create table if not exists public.currencies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  iso text not null unique,
  icon text not null,
  created_at timestamptz not null default now()
);

-- Insert default currencies
insert into public.currencies (name, iso, icon) values
  ('EURO', 'EUR', '€'),
  ('DOLLARS', 'USD', '$'),
  ('NIS', 'ILS', '₪'),
  ('GBP', 'GBP', '£')
on conflict (name) do nothing;

-- Add currency_id column to payments table
alter table public.payments
  add column if not exists currency_id uuid references public.currencies(id) on delete restrict;

-- Create index for currency_id
create index if not exists idx_payments_currency_id on public.payments(currency_id);

-- Add comment
comment on table public.currencies is 'Supported currencies for payments';
comment on column public.payments.currency_id is 'Currency used for this payment';
