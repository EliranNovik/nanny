-- Tebnu Support bot: what the bot has learned about each person, kept across chats.
-- Only the API (service role) reads or writes it. No client policies.

create table if not exists public.support_bot_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'fact'
    check (kind in ('fact', 'preference', 'request', 'issue')),
  content text not null check (char_length(content) between 1 and 300),
  source_message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz
);

create unique index if not exists support_bot_memories_user_content_idx
  on public.support_bot_memories (user_id, lower(content));

create index if not exists support_bot_memories_user_recent_idx
  on public.support_bot_memories (user_id, updated_at desc);

alter table public.support_bot_memories enable row level security;
