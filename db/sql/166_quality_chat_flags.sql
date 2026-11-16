-- Chat reviews from the same quality manager that scores posts.
-- One open row per conversation. Dismiss it from Flagged in chat.
-- Safe to re-run.

create table if not exists public.quality_chat_flags (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid,
  summary text not null,
  excerpt text,
  reasons jsonb not null default '[]'::jsonb,
  outcome text not null default 'flag' check (outcome in ('flag', 'block')),
  created_at timestamptz not null default now(),
  dismissed_at timestamptz
);

create unique index if not exists quality_chat_flags_open_conv_uidx
  on public.quality_chat_flags (conversation_id)
  where dismissed_at is null;

create index if not exists quality_chat_flags_recent_idx
  on public.quality_chat_flags (created_at desc)
  where dismissed_at is null;

alter table public.quality_chat_flags enable row level security;

drop policy if exists quality_chat_flags_admin_select on public.quality_chat_flags;
create policy quality_chat_flags_admin_select
  on public.quality_chat_flags for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

grant select on public.quality_chat_flags to authenticated;

create table if not exists public.quality_chat_scans (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  last_message_id uuid,
  scanned_at timestamptz not null default now()
);

alter table public.quality_chat_scans enable row level security;

comment on table public.quality_chat_flags is
  'Conversations the quality manager flagged. Admins read them under Flagged in chat.';
