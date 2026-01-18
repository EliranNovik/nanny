-- 002_rls.sql
-- Enable Row Level Security on all tables

alter table public.profiles enable row level security;
alter table public.freelancer_profiles enable row level security;
alter table public.job_requests enable row level security;
alter table public.job_candidate_notifications enable row level security;
alter table public.job_confirmations enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

