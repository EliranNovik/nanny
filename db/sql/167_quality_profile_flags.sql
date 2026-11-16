-- Bios and reviews scored by the same quality manager as posts and chats.
-- One open row per bio, and one open row per review. Dismiss from Flagged profiles.
-- Safe to re-run.

create table if not exists public.quality_profile_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  about_user_id uuid references public.profiles(id) on delete set null,
  review_id uuid,
  kind text not null check (kind in ('bio', 'review')),
  summary text not null,
  excerpt text,
  reasons jsonb not null default '[]'::jsonb,
  outcome text not null default 'flag' check (outcome in ('flag', 'block')),
  created_at timestamptz not null default now(),
  dismissed_at timestamptz
);

create unique index if not exists quality_profile_flags_open_bio_uidx
  on public.quality_profile_flags (user_id)
  where kind = 'bio' and dismissed_at is null;

create unique index if not exists quality_profile_flags_open_review_uidx
  on public.quality_profile_flags (review_id)
  where kind = 'review' and review_id is not null and dismissed_at is null;

create index if not exists quality_profile_flags_recent_idx
  on public.quality_profile_flags (created_at desc)
  where dismissed_at is null;

alter table public.quality_profile_flags enable row level security;

drop policy if exists quality_profile_flags_admin_select on public.quality_profile_flags;
create policy quality_profile_flags_admin_select
  on public.quality_profile_flags for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

grant select on public.quality_profile_flags to authenticated;

create table if not exists public.quality_text_scans (
  kind text not null check (kind in ('bio', 'review')),
  subject_id uuid not null,
  content_hash text not null,
  scanned_at timestamptz not null default now(),
  primary key (kind, subject_id)
);

alter table public.quality_text_scans enable row level security;

comment on table public.quality_profile_flags is
  'Profile bios and reviews the quality manager flagged. Admins read them under Flagged profiles.';
