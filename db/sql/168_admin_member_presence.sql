-- Lets the admin member page tell a live login from an old session.
-- A member is online when they still have a session and that session was
-- refreshed within the last 75 minutes (the app keeps the login alive
-- about once an hour while it is open).
-- Run in the Supabase SQL editor.

create or replace function public.admin_member_presence(member_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  with live as (
    select coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at) as seen_at
    from auth.sessions s
    where s.user_id = member_id
      and (s.not_after is null or s.not_after > now())
  )
  select jsonb_build_object(
    'online', exists (
      select 1 from live where seen_at > now() - interval '75 minutes'
    ),
    'session_at', (select max(seen_at) from live)
  );
$$;

revoke all on function public.admin_member_presence(uuid) from public, anon, authenticated;
grant execute on function public.admin_member_presence(uuid) to service_role;
