-- Admins can switch the support bot off in one chat to talk to the person themselves.
-- The bot stays off while the chat is active and turns itself back on after
-- one day with no messages (counted from the pause or the last message, whichever is later).

alter table public.support_bot_threads
  add column if not exists ai_paused_at timestamptz;

comment on column public.support_bot_threads.ai_paused_at is
  'When an admin switched the bot off in this chat. Null means the bot is on. Ignored (and cleared by the API) after one day with no messages.';

drop policy if exists support_bot_threads_insert_admin on public.support_bot_threads;
create policy support_bot_threads_insert_admin
  on public.support_bot_threads
  for insert
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

drop policy if exists support_bot_threads_update_admin on public.support_bot_threads;
create policy support_bot_threads_update_admin
  on public.support_bot_threads
  for update
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

grant select, insert, update on public.support_bot_threads to authenticated;

-- The chat switch calls this. It runs as the table owner, so the save is not
-- blocked by row level security, and it still checks the caller is an admin
-- in that conversation.
create or replace function public.set_support_bot_ai_paused(
  p_conversation_id uuid,
  p_paused boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and coalesce(is_admin, false) = true
  ) then
    raise exception 'not allowed';
  end if;

  if not exists (
    select 1
    from public.conversations
    where id = p_conversation_id
      and (client_id = auth.uid() or freelancer_id = auth.uid())
  ) then
    raise exception 'not allowed';
  end if;

  insert into public.support_bot_threads (conversation_id, ai_paused_at, updated_at)
  values (
    p_conversation_id,
    case when p_paused then now() else null end,
    now()
  )
  on conflict (conversation_id) do update
    set ai_paused_at = excluded.ai_paused_at,
        updated_at = now();
end;
$$;

revoke all on function public.set_support_bot_ai_paused(uuid, boolean) from public;
grant execute on function public.set_support_bot_ai_paused(uuid, boolean) to authenticated;
