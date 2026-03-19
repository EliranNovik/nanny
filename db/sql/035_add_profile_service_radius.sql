-- 035_add_profile_service_radius.sql
-- Add map radius preference columns to profiles

alter table public.profiles
  add column if not exists address text,
  add column if not exists location_lat numeric,
  add column if not exists location_lng numeric,
  add column if not exists service_radius int default 10;
