-- 036_profile_favorites.sql
-- Saved helpers / favorite profiles: one row per (user, favorite_user) pair.

create table if not exists public.profile_favorites (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  favorite_user_id   uuid not null references public.profiles(id) on delete cascade,
  created_at         timestamptz not null default now(),
  constraint profile_favorites_no_self check (user_id <> favorite_user_id),
  unique (user_id, favorite_user_id)
);

create index if not exists idx_profile_favorites_user_id
  on public.profile_favorites (user_id);

create index if not exists idx_profile_favorites_favorite_user_id
  on public.profile_favorites (favorite_user_id);

comment on table public.profile_favorites is 'A user bookmarks another profile (e.g. client favorites a helper on Find helpers).';

alter table public.profile_favorites enable row level security;

-- Users can read only their own favorite list
create policy "profile_favorites_select_own"
  on public.profile_favorites
  for select
  using (user_id = auth.uid());

-- Users can add favorites only for themselves, not themselves as target
create policy "profile_favorites_insert_own"
  on public.profile_favorites
  for insert
  with check (
    user_id = auth.uid()
    and favorite_user_id <> auth.uid()
  );

-- Users can remove only their own favorites
create policy "profile_favorites_delete_own"
  on public.profile_favorites
  for delete
  using (user_id = auth.uid());
