-- Create table for freelancer unavailable time slots
create table if not exists public.freelancer_unavailable_dates (
  id uuid primary key default gen_random_uuid(),
  freelancer_id uuid not null references public.profiles(id) on delete cascade,
  unavailable_date date not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(freelancer_id, unavailable_date, start_time, end_time),
  check (end_time > start_time)
);

-- Create index for faster queries
create index if not exists idx_freelancer_unavailable_dates_freelancer_id 
  on public.freelancer_unavailable_dates(freelancer_id);

create index if not exists idx_freelancer_unavailable_dates_date 
  on public.freelancer_unavailable_dates(unavailable_date);

create index if not exists idx_freelancer_unavailable_dates_freelancer_date 
  on public.freelancer_unavailable_dates(freelancer_id, unavailable_date);

-- Enable RLS
alter table public.freelancer_unavailable_dates enable row level security;

-- RLS Policies
-- Freelancers can view their own unavailable dates
create policy "Freelancers can view their own unavailable dates"
  on public.freelancer_unavailable_dates
  for select
  using (auth.uid() = freelancer_id);

-- Freelancers can insert their own unavailable dates
create policy "Freelancers can insert their own unavailable dates"
  on public.freelancer_unavailable_dates
  for insert
  with check (auth.uid() = freelancer_id);

-- Freelancers can delete their own unavailable dates
create policy "Freelancers can delete their own unavailable dates"
  on public.freelancer_unavailable_dates
  for delete
  using (auth.uid() = freelancer_id);

-- Clients can view unavailable dates of freelancers they have jobs with
-- This allows clients to see when freelancers are unavailable when scheduling
create policy "Clients can view unavailable dates of freelancers in their jobs"
  on public.freelancer_unavailable_dates
  for select
  using (
    exists (
      select 1
      from public.job_requests
      where job_requests.client_id = auth.uid()
        and job_requests.selected_freelancer_id = freelancer_unavailable_dates.freelancer_id
        and job_requests.status in ('locked', 'active', 'ready', 'notifying', 'confirmations_closed')
    )
  );

-- Create trigger to update updated_at
do $$ begin
  create trigger freelancer_unavailable_dates_set_updated_at
    before update on public.freelancer_unavailable_dates
    for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;
