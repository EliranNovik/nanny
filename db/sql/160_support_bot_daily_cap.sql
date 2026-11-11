-- Daily cap on how many messages the support bot may write to one person.
-- 0 means no limit. The count resets at midnight UTC.
-- Admins change it from Admin → AI Bot. The API reads it with the service role.

create table if not exists public.support_bot_settings (
  id integer primary key default 1 check (id = 1),
  daily_message_cap integer not null default 20
    check (daily_message_cap >= 0 and daily_message_cap <= 500),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.support_bot_settings (id, daily_message_cap)
values (1, 20)
on conflict (id) do nothing;

alter table public.support_bot_settings enable row level security;

drop policy if exists support_bot_settings_admin_select on public.support_bot_settings;
create policy support_bot_settings_admin_select
  on public.support_bot_settings for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists support_bot_settings_admin_insert on public.support_bot_settings;
create policy support_bot_settings_admin_insert
  on public.support_bot_settings for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists support_bot_settings_admin_update on public.support_bot_settings;
create policy support_bot_settings_admin_update
  on public.support_bot_settings for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

grant select, insert, update on public.support_bot_settings to authenticated;
