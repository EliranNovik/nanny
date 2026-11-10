-- Tebnu Support bot: knowledge and behaviour entries edited in Admin → AI Bot.
-- "behavior" entries change how the bot talks (tone, style, rules).
-- "knowledge" entries are facts it may use when answering (about Tebnu, policies, FAQs).
-- "rules" entries are hard limits: what it must not say or do.
-- Admins edit them from the web app. The API reads them with the service role.

create table if not exists public.support_bot_knowledge (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'knowledge' check (kind in ('behavior', 'knowledge', 'rules')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 8000),
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_bot_knowledge_order_idx
  on public.support_bot_knowledge (kind, sort_order, created_at);

create or replace function public.support_bot_knowledge_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

drop trigger if exists support_bot_knowledge_touch on public.support_bot_knowledge;
create trigger support_bot_knowledge_touch
  before update on public.support_bot_knowledge
  for each row execute function public.support_bot_knowledge_touch();

alter table public.support_bot_knowledge enable row level security;

drop policy if exists support_bot_knowledge_admin_select on public.support_bot_knowledge;
create policy support_bot_knowledge_admin_select
  on public.support_bot_knowledge for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists support_bot_knowledge_admin_insert on public.support_bot_knowledge;
create policy support_bot_knowledge_admin_insert
  on public.support_bot_knowledge for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists support_bot_knowledge_admin_update on public.support_bot_knowledge;
create policy support_bot_knowledge_admin_update
  on public.support_bot_knowledge for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists support_bot_knowledge_admin_delete on public.support_bot_knowledge;
create policy support_bot_knowledge_admin_delete
  on public.support_bot_knowledge for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- Starter entries. Edit or replace them in Admin → AI Bot.
insert into public.support_bot_knowledge (kind, title, body, sort_order)
select * from (values
  (
    'behavior',
    'Tone of voice',
    'Warm, calm, and short. Talk like a helpful neighbour, not a call centre. Use the person''s first name once when you know it. No exclamation marks in a row. No emojis unless the person uses them first.',
    0
  ),
  (
    'knowledge',
    'What Tebnu is',
    'Tebnu connects people who need help with people nearby who can help: babysitting, cleaning, moving, errands, and more. People post a request or an offer, chat in Messages, and agree on the job together. There are also community posts and events on the Feed.',
    0
  )
) as seed(kind, title, body, sort_order)
where not exists (select 1 from public.support_bot_knowledge);
