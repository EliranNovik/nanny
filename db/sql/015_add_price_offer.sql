-- 015_add_price_offer.sql
-- Add price offer fields to job_requests table

-- Add price offer fields
alter table public.job_requests 
  add column if not exists offered_hourly_rate int,
  add column if not exists price_offer_status text default null; -- 'pending', 'accepted', 'declined'

-- Add comment
comment on column public.job_requests.offered_hourly_rate is 'Hourly rate offered by freelancer';
comment on column public.job_requests.price_offer_status is 'Status of price offer: pending, accepted, declined';

-- Create index for querying jobs with pending price offers
create index if not exists idx_job_requests_price_offer_status on public.job_requests(price_offer_status) where price_offer_status is not null;

