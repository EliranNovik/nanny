-- When the support bot moves a chat to the Tebnu admins, and lets those admins see that list.

alter table public.support_bot_threads
  add column if not exists handoff_at timestamptz;

comment on column public.support_bot_threads.handoff_at is
  'Last time the support bot moved this chat to the Tebnu admins. The waiting filter hides it after an admin types a message later than this.';

drop policy if exists support_bot_threads_select_admin on public.support_bot_threads;
create policy support_bot_threads_select_admin
  on public.support_bot_threads
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );
