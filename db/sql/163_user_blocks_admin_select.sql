-- Let admins list every user block from the web admin.
-- Members keep the existing policy that only returns rows they created
-- (blocker_id = auth.uid()). Postgres ORs select policies.

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create index if not exists user_blocks_created_at_idx
  on public.user_blocks (created_at desc);

alter table public.user_blocks enable row level security;

drop policy if exists user_blocks_select_admin on public.user_blocks;
create policy user_blocks_select_admin
  on public.user_blocks
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

grant select on public.user_blocks to authenticated;
