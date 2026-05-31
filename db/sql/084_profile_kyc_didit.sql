-- Didit KYC fields on profiles (identity verification during onboarding).

alter table public.profiles
  add column if not exists kyc_status text not null default 'approved'
    check (
      kyc_status in (
        'not_started',
        'in_progress',
        'approved',
        'declined',
        'in_review',
        'pending_review',
        'expired',
        'abandoned'
      )
    );

comment on column public.profiles.kyc_status is
  'Didit KYC lifecycle. Existing users default approved; new signups set not_started.';

alter table public.profiles
  add column if not exists kyc_session_id uuid;

alter table public.profiles
  add column if not exists kyc_verified_at timestamptz;

alter table public.profiles
  add column if not exists kyc_legal_name text;

alter table public.profiles
  add column if not exists kyc_date_of_birth date;

create index if not exists idx_profiles_kyc_session_id
  on public.profiles (kyc_session_id)
  where kyc_session_id is not null;

create index if not exists idx_profiles_kyc_status
  on public.profiles (kyc_status);
