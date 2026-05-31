-- 085_profile_city_place_id.sql
-- Google Places ID for profile city (picked from autocomplete during onboarding)

alter table public.profiles
  add column if not exists city_place_id text;

comment on column public.profiles.city_place_id is
  'Google Places place_id for profiles.city — used for stable geocoding and location matching';
