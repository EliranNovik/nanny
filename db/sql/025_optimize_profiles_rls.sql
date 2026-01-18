-- 025_optimize_profiles_rls.sql
-- Optimize RLS policies for profiles table to prevent timeouts

-- Drop existing policies
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_public" on public.profiles;

-- Recreate with optimized policies
-- Users can always select their own profile (most common case, should be fast)
create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = id);

-- Allow public read for displaying freelancer cards (but only if authenticated)
-- This ensures the query doesn't hang if auth.uid() is null
create policy "profiles_select_public"
on public.profiles for select
using (auth.uid() is not null);

-- Add index on id for faster lookups
create index if not exists idx_profiles_id on public.profiles(id);

-- Add comment
comment on policy "profiles_select_own" on public.profiles is 'Users can read their own profile';
comment on policy "profiles_select_public" on public.profiles is 'Authenticated users can read all profiles (for freelancer cards)';
