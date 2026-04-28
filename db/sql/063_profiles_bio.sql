-- Add a shared bio field for all users (clients + freelancers).
-- Freelancers previously used `freelancer_profiles.bio` only.

alter table public.profiles
  add column if not exists bio text;

