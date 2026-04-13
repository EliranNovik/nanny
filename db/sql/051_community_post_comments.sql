-- 051_community_post_comments.sql
-- Comments on community availability posts. RLS mirrors visibility on community_posts:
-- authors see their own posts (any expiry/status); others only active + not expired.

create table if not exists public.community_post_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.community_posts(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint community_post_comments_body_len check (
    char_length(body) >= 1
    and char_length(body) <= 4000
  )
);

create index if not exists idx_community_post_comments_post_id_created_at
  on public.community_post_comments (post_id, created_at asc);

create index if not exists idx_community_post_comments_author_id
  on public.community_post_comments (author_id);

comment on table public.community_post_comments is
  'User comments on a public community post; visible when the parent post is visible under RLS.';

do $$ begin
  create trigger community_post_comments_set_updated_at
    before update on public.community_post_comments
    for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

alter table public.community_post_comments enable row level security;

-- Helper predicate: same as reading the parent row via community_posts_select_visible
-- (author always; others only active + unexpired)

create policy "community_post_comments_select_if_post_visible"
  on public.community_post_comments
  for select
  using (
    exists (
      select 1
      from public.community_posts p
      where p.id = community_post_comments.post_id
        and (
          p.author_id = auth.uid()
          or (
            p.status = 'active'
            and p.expires_at > now()
          )
        )
    )
  );

-- Authenticated users may comment only on posts they are allowed to see (same predicate)
create policy "community_post_comments_insert_if_post_visible"
  on public.community_post_comments
  for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1
      from public.community_posts p
      where p.id = community_post_comments.post_id
        and (
          p.author_id = auth.uid()
          or (
            p.status = 'active'
            and p.expires_at > now()
          )
        )
    )
  );

create policy "community_post_comments_update_own"
  on public.community_post_comments
  for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "community_post_comments_delete_own_or_post_author"
  on public.community_post_comments
  for delete
  using (
    author_id = auth.uid()
    or exists (
      select 1
      from public.community_posts p
      where p.id = community_post_comments.post_id
        and p.author_id = auth.uid()
    )
  );

-- Optional: live comment threads in the app (uncomment if you use Supabase Realtime)
-- alter publication supabase_realtime add table public.community_post_comments;
