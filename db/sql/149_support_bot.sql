-- Tebnu Support bot: which threads a person has taken over, which replies the bot sent,
-- and which automatic reports it already followed up on.

create table if not exists public.support_bot_threads (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'escalated')),
  handoff_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.support_bot_messages (
  message_id uuid primary key references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists support_bot_messages_conversation_idx
  on public.support_bot_messages (conversation_id, created_at desc);

create table if not exists public.support_bot_reports (
  report_id uuid primary key,
  conversation_id uuid references public.conversations(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.support_bot_threads enable row level security;
alter table public.support_bot_messages enable row level security;
alter table public.support_bot_reports enable row level security;
