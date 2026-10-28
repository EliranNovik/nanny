-- Public profile parity fields. These values are read-only on the website;
-- users manage them in the mobile app.

alter table public.profiles
  add column if not exists availability jsonb;

alter table public.freelancer_profiles
  add column if not exists show_rates boolean not null default false;

comment on column public.profiles.availability is
  'Public weekly availability configured in the mobile app.';
comment on column public.freelancer_profiles.show_rates is
  'Helper-controlled opt-in for displaying hourly rates publicly.';

-- Existing public-profile RLS policies still apply. These grants expose only
-- the fields needed by the public cards and do not permit writes.
grant select (availability) on public.profiles to anon, authenticated;
grant select (hourly_rate_min, hourly_rate_max, show_rates)
  on public.freelancer_profiles to anon, authenticated;
