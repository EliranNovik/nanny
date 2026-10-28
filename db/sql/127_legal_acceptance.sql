-- Versioned affirmative legal acceptance for Tebnu accounts.
alter table public.profiles
  add column if not exists legal_terms_version text,
  add column if not exists legal_terms_accepted_at timestamptz,
  add column if not exists privacy_version text,
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists age_18_confirmed_at timestamptz;

comment on column public.profiles.legal_terms_version is
  'Version of the Tebnu Terms affirmatively accepted by the user.';
comment on column public.profiles.privacy_version is
  'Version of the Tebnu Privacy Policy acknowledged by the user.';
comment on column public.profiles.age_18_confirmed_at is
  'Timestamp when the user confirmed they were at least 18.';
