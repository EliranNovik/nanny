-- 037_community_posts.sql
-- Public "offer yourself" posts: users promote services; others browse and contact via messaging.

create table if not exists public.community_posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles(id) on delete cascade,
  category    text not null,
  title       text not null,
  body        text not null,
  status      text not null default 'active' check (status in ('active', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_community_posts_author_id on public.community_posts (author_id);
create index if not exists idx_community_posts_created_at on public.community_posts (created_at desc);
create index if not exists idx_community_posts_category on public.community_posts (category);
create index if not exists idx_community_posts_status on public.community_posts (status);

create table if not exists public.community_post_images (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.community_posts(id) on delete cascade,
  image_url   text not null,
  sort_order  int not null default 0
);

create index if not exists idx_community_post_images_post_id on public.community_post_images (post_id);

comment on table public.community_posts is 'User-visible service offers; separate from job_requests.';
comment on table public.community_post_images is 'Image URLs (e.g. Supabase Storage public URLs) attached to a community post.';

-- RLS
alter table public.community_posts enable row level security;
alter table public.community_post_images enable row level security;

create policy "community_posts_select_visible"
  on public.community_posts for select
  using (
    status = 'active'
    or author_id = auth.uid()
  );

create policy "community_posts_insert_own"
  on public.community_posts for insert
  with check (author_id = auth.uid());

create policy "community_posts_update_own"
  on public.community_posts for update
  using (author_id = auth.uid());

create policy "community_posts_delete_own"
  on public.community_posts for delete
  using (author_id = auth.uid());

create policy "community_post_images_select_if_post_visible"
  on public.community_post_images for select
  using (
    exists (
      select 1 from public.community_posts p
      where p.id = post_id
        and (p.status = 'active' or p.author_id = auth.uid())
    )
  );

create policy "community_post_images_insert_if_author"
  on public.community_post_images for insert
  with check (
    exists (
      select 1 from public.community_posts p
      where p.id = post_id and p.author_id = auth.uid()
    )
  );

create policy "community_post_images_delete_if_author"
  on public.community_post_images for delete
  using (
    exists (
      select 1 from public.community_posts p
      where p.id = post_id and p.author_id = auth.uid()
    )
  );

-- ============================================
-- Storage bucket: run 041_storage_community_posts_bucket.sql
-- (or Dashboard → Storage → New bucket: community-posts, public)
-- ============================================

drop policy if exists "community_posts_storage_read" on storage.objects;
drop policy if exists "community_posts_storage_upload_own" on storage.objects;
drop policy if exists "community_posts_storage_delete_own" on storage.objects;

create policy "community_posts_storage_read"
  on storage.objects for select
  using (bucket_id = 'community-posts');

create policy "community_posts_storage_upload_own"
  on storage.objects for insert
  with check (
    bucket_id = 'community-posts'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "community_posts_storage_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'community-posts'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
