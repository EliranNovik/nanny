-- Contact form submissions. The API inserts with the service role, which bypasses RLS.
-- The insert policy lets a signed-out visitor save a message if the request does not go through the API.

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  topic text not null,
  topic_label text not null,
  message text not null,
  email_sent boolean not null default false,
  email_error text,
  created_at timestamptz not null default now(),
  constraint contact_messages_name_len check (char_length(name) between 1 and 120),
  constraint contact_messages_email_len check (char_length(email) between 3 and 254),
  constraint contact_messages_topic_len check (char_length(topic) between 1 and 80),
  constraint contact_messages_topic_label_len check (char_length(topic_label) between 1 and 120),
  constraint contact_messages_message_len check (char_length(message) between 15 and 5000)
);

create index if not exists contact_messages_created_idx
  on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;

drop policy if exists contact_messages_insert_anyone on public.contact_messages;
create policy contact_messages_insert_anyone
  on public.contact_messages
  for insert
  to anon, authenticated
  with check (
    char_length(name) between 1 and 120
    and char_length(message) between 15 and 5000
    and position('@' in email) > 1
  );

drop policy if exists contact_messages_select_admin on public.contact_messages;
create policy contact_messages_select_admin
  on public.contact_messages
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

grant insert on public.contact_messages to anon, authenticated;
grant select on public.contact_messages to authenticated;
grant all on public.contact_messages to service_role;
