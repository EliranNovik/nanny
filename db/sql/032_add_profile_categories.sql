-- 032_add_profile_categories.sql
-- Add categories array to profiles table so both clients and freelancers can select services

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT '{}';

-- Adding a comment for documentation
COMMENT ON COLUMN public.profiles.categories IS 'Array of selected service categories e.g. {"cleaning", "cooking", "pickup_delivery", "nanny", "other_help"}';
