-- Quality manager: separate from the support chat.
-- Admins edit the standards. The API records posts it allowed through but was unsure about.

create table if not exists public.quality_manager_notes (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'standard'
    check (kind in ('standard', 'category')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 4000),
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quality_manager_notes_order_idx
  on public.quality_manager_notes (kind, sort_order, created_at);

alter table public.quality_manager_notes enable row level security;

drop policy if exists quality_manager_notes_admin_select on public.quality_manager_notes;
create policy quality_manager_notes_admin_select
  on public.quality_manager_notes for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists quality_manager_notes_admin_insert on public.quality_manager_notes;
create policy quality_manager_notes_admin_insert
  on public.quality_manager_notes for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists quality_manager_notes_admin_update on public.quality_manager_notes;
create policy quality_manager_notes_admin_update
  on public.quality_manager_notes for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists quality_manager_notes_admin_delete on public.quality_manager_notes;
create policy quality_manager_notes_admin_delete
  on public.quality_manager_notes for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

grant select, insert, update, delete on public.quality_manager_notes to authenticated;

create table if not exists public.quality_post_flags (
  id uuid primary key default gen_random_uuid(),
  profile_post_id uuid references public.profile_posts(id) on delete cascade,
  community_post_id uuid references public.community_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  excerpt text,
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint quality_post_flags_one_post check (
    (profile_post_id is not null and community_post_id is null)
    or (profile_post_id is null and community_post_id is not null)
  )
);

create index if not exists quality_post_flags_recent_idx
  on public.quality_post_flags (created_at desc);

alter table public.quality_post_flags enable row level security;

drop policy if exists quality_post_flags_admin_select on public.quality_post_flags;
create policy quality_post_flags_admin_select
  on public.quality_post_flags for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

grant select on public.quality_post_flags to authenticated;

insert into public.quality_manager_notes (kind, title, body, sort_order)
select * from (values
  (
    'standard',
    'What to leave alone',
    'Do not flag ordinary requests for help, offers, prices, event details, disagreements, or care questions that are not graphic. Everyday photos of homes, food, pets, and people are fine.',
    0
  ),
  (
    'category',
    'Violence',
    'Open violence, graphic injury, or a direct threat to hurt someone.',
    0
  ),
  (
    'category',
    'Sexual content',
    'Sexual content or nudity.',
    1
  ),
  (
    'category',
    'Abuse',
    'Harassment, bullying, or abuse aimed at a person.',
    2
  ),
  (
    'category',
    'Hate',
    'Hate toward a group of people.',
    3
  ),
  (
    'category',
    'Scam',
    'A post that tries to trick someone out of money.',
    4
  )
) as seed(kind, title, body, sort_order)
where not exists (
  select 1 from public.quality_manager_notes existing
  where existing.kind = seed.kind and existing.title = seed.title
);
