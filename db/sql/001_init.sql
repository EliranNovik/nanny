-- 001_init.sql
-- Nanny Marketplace MVP - Database Schema

create extension if not exists "pgcrypto";

-- Role type for profiles
do $$ begin
  create type public.user_role as enum ('client', 'freelancer');
exception when duplicate_object then null;
end $$;

-- Job status
do $$ begin
  create type public.job_status as enum (
    'draft','ready','notifying','confirmations_closed','locked','active','completed','cancelled'
  );
exception when duplicate_object then null;
end $$;

-- Notification status
do $$ begin
  create type public.notification_status as enum (
    'pending','opened','expired','withdrawn','selected','closed'
  );
exception when duplicate_object then null;
end $$;

-- Confirmation status
do $$ begin
  create type public.confirmation_status as enum (
    'available','declined','expired'
  );
exception when duplicate_object then null;
end $$;

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null,
  full_name text,
  phone text,
  photo_url text,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Freelancer-specific profile fields
create table if not exists public.freelancer_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  bio text,
  languages text[] not null default '{}',
  has_first_aid boolean not null default false,
  newborn_experience boolean not null default false,
  special_needs_experience boolean not null default false,
  max_children int not null default 2,
  hourly_rate_min int,
  hourly_rate_max int,
  available_now boolean not null default false,
  availability_note text,
  rating_avg numeric(3,2) not null default 0,
  rating_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Job requests
create table if not exists public.job_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  status public.job_status not null default 'draft',

  -- Core structured answers
  care_type text not null,                 -- e.g. "full_time", "part_time", "occasional"
  children_count int not null,
  children_age_group text not null,        -- e.g. "newborn", "infant", "toddler", "mixed"
  location_city text not null,
  location_lat numeric,
  location_lng numeric,

  start_at timestamptz,
  shift_hours text,                        -- "up_to_4", "4_8", "full_day", "night"
  languages_pref text[] not null default '{}',
  requirements text[] not null default '{}', -- e.g. ["first_aid","special_needs"]
  budget_min int,
  budget_max int,

  notes text,

  -- Confirmation window
  confirm_window_seconds int not null default 90,
  confirm_starts_at timestamptz,
  confirm_ends_at timestamptz,

  -- Final selection
  selected_freelancer_id uuid references public.profiles(id),
  locked_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_job_requests_client_id on public.job_requests(client_id);
create index if not exists idx_job_requests_status on public.job_requests(status);

-- Candidate notifications (sent to freelancers)
create table if not exists public.job_candidate_notifications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_requests(id) on delete cascade,
  freelancer_id uuid not null references public.profiles(id) on delete cascade,
  status public.notification_status not null default 'pending',
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  closed_at timestamptz,
  unique(job_id, freelancer_id)
);

create index if not exists idx_candidate_job on public.job_candidate_notifications(job_id);
create index if not exists idx_candidate_freelancer on public.job_candidate_notifications(freelancer_id);

-- Availability confirmations
create table if not exists public.job_confirmations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_requests(id) on delete cascade,
  freelancer_id uuid not null references public.profiles(id) on delete cascade,
  status public.confirmation_status not null,
  created_at timestamptz not null default now(),
  unique(job_id, freelancer_id)
);

create index if not exists idx_confirm_job on public.job_confirmations(job_id);

-- Conversations per job
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid unique not null references public.job_requests(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  freelancer_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_conversation on public.messages(conversation_id);
create index if not exists idx_messages_created_at on public.messages(created_at);

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$ begin
  create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger freelancer_profiles_set_updated_at
  before update on public.freelancer_profiles
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger job_requests_set_updated_at
  before update on public.job_requests
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

