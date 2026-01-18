-- 027_verify_profiles_rls.sql
-- Verify and fix profiles RLS policies to ensure they work correctly

-- First, check if policies exist and drop them
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_public" on public.profiles;

-- Recreate the policies with explicit conditions
-- Users can always select their own profile (most common case, should be fast)
create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = id);

-- Allow authenticated users to read all profiles (for freelancer cards)
-- This ensures the query doesn't hang if auth.uid() is null
create policy "profiles_select_public"
on public.profiles for select
using (auth.uid() is not null);

-- Ensure index exists for faster lookups
create index if not exists idx_profiles_id on public.profiles(id);

-- Add comments
comment on policy "profiles_select_own" on public.profiles is 'Users can read their own profile - checked first for performance';
comment on policy "profiles_select_public" on public.profiles is 'Authenticated users can read all profiles (for freelancer cards)';

-- Verify RLS is enabled
alter table public.profiles enable row level security;
