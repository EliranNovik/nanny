-- One reply per message: a server inserts a claim before replying, and any other
-- server running the support bot skips work that is already claimed.
create table if not exists public.support_bot_claims (
  key text primary key,
  owner text not null,
  claimed_at timestamptz not null default now()
);

create index if not exists support_bot_claims_claimed_at_idx
  on public.support_bot_claims (claimed_at);

alter table public.support_bot_claims enable row level security;
