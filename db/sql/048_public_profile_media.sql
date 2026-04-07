-- 048_public_profile_media.sql
-- Public profile gallery: images & videos in Storage + metadata table.
-- Run in Supabase → SQL Editor.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.public_profile_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  storage_path text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_public_profile_media_user_sort
  on public.public_profile_media (user_id, sort_order, created_at);

comment on table public.public_profile_media is
  'Gallery items for public profile pages; files live in storage bucket public-profile-media under {user_id}/.';

alter table public.public_profile_media enable row level security;

drop policy if exists "public_profile_media_select_auth" on public.public_profile_media;
drop policy if exists "public_profile_media_insert_own" on public.public_profile_media;
drop policy if exists "public_profile_media_update_own" on public.public_profile_media;
drop policy if exists "public_profile_media_delete_own" on public.public_profile_media;

-- Logged-in users can read gallery rows (matches app: /profile/:userId is behind auth).
create policy "public_profile_media_select_auth"
  on public.public_profile_media for select
  to authenticated
  using (true);

create policy "public_profile_media_insert_own"
  on public.public_profile_media for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "public_profile_media_update_own"
  on public.public_profile_media for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "public_profile_media_delete_own"
  on public.public_profile_media for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage bucket (public URLs for gallery)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-profile-media',
  'public-profile-media',
  true,
  52428800, -- 50 MB per object (videos)
  null
)
on conflict (id) do nothing;

drop policy if exists "public_profile_media_storage_read" on storage.objects;
drop policy if exists "public_profile_media_storage_upload_own" on storage.objects;
drop policy if exists "public_profile_media_storage_delete_own" on storage.objects;

create policy "public_profile_media_storage_read"
  on storage.objects for select
  using (bucket_id = 'public-profile-media');

create policy "public_profile_media_storage_upload_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'public-profile-media'
    and (storage.foldername (name))[1] = auth.uid()::text
  );

create policy "public_profile_media_storage_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'public-profile-media'
    and (storage.foldername (name))[1] = auth.uid()::text
  );
