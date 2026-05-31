-- Allow users to skip KYC during onboarding; enforce verification for key actions.

alter table public.profiles drop constraint if exists profiles_kyc_status_check;

alter table public.profiles
  add constraint profiles_kyc_status_check
  check (
    kyc_status in (
      'not_started',
      'skipped',
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
  'Didit KYC lifecycle. skipped = user deferred verification; restricted from posting requests and going live.';

create or replace function public.enforce_job_create_kyc()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.profiles p
    where p.id = new.client_id
      and coalesce(p.is_admin, false) = false
      and p.kyc_status is distinct from 'approved'
  ) then
    raise exception 'KYC_REQUIRED: Identity verification is required before posting a request';
  end if;
  return new;
end;
$$;

drop trigger if exists job_requests_require_kyc on public.job_requests;

create trigger job_requests_require_kyc
  before insert on public.job_requests
  for each row
  execute function public.enforce_job_create_kyc();

create or replace function public.enforce_go_live_kyc()
returns trigger
language plpgsql
as $$
begin
  if new.live_until is not null and new.live_until > now() then
    if exists (
      select 1
      from public.profiles p
      where p.id = new.user_id
        and coalesce(p.is_admin, false) = false
        and p.kyc_status is distinct from 'approved'
    ) then
      raise exception 'KYC_REQUIRED: Identity verification is required before going live';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists freelancer_profiles_go_live_kyc on public.freelancer_profiles;

create trigger freelancer_profiles_go_live_kyc
  before insert or update on public.freelancer_profiles
  for each row
  execute function public.enforce_go_live_kyc();
