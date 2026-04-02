-- 043_community_posts_availability.sql
-- Short-lived structured availability: expires_at, optional note, JSON payload.
-- Public feed RPC filters unexpired rows; RLS hides expired posts from non-authors.

-- 1) Columns
alter table public.community_posts
  add column if not exists expires_at timestamptz,
  add column if not exists availability_payload jsonb not null default '{}'::jsonb,
  add column if not exists note text;

-- 2) Backfill existing rows (legacy long-form posts)
update public.community_posts
set expires_at = created_at + interval '7 days'
where expires_at is null;

alter table public.community_posts
  alter column expires_at set not null;

comment on column public.community_posts.expires_at is 'When this availability pulse stops appearing in the public feed.';
comment on column public.community_posts.availability_payload is 'Structured fields, e.g. duration_preset, area tag.';
comment on column public.community_posts.note is 'Optional short note (max 120 chars).';

-- 3) Constraints
alter table public.community_posts
  drop constraint if exists community_posts_note_len;
alter table public.community_posts
  add constraint community_posts_note_len
  check (note is null or char_length(note) <= 120);

alter table public.community_posts
  drop constraint if exists community_posts_expires_after_created;
alter table public.community_posts
  add constraint community_posts_expires_after_created
  check (expires_at > created_at);

-- 4) RLS: authors see all their rows; others only active + not expired
drop policy if exists "community_posts_select_visible" on public.community_posts;
create policy "community_posts_select_visible"
  on public.community_posts for select
  using (
    author_id = auth.uid()
    or (
      status = 'active'
      and expires_at > now()
    )
  );

drop policy if exists "community_post_images_select_if_post_visible" on public.community_post_images;
create policy "community_post_images_select_if_post_visible"
  on public.community_post_images for select
  using (
    exists (
      select 1 from public.community_posts p
      where p.id = post_id
        and (
          p.author_id = auth.uid()
          or (p.status = 'active' and p.expires_at > now())
        )
    )
  );

create index if not exists idx_community_posts_expires_at on public.community_posts (expires_at asc);

-- 5) Public feed RPC (ratings + expiry + payload)
drop function if exists public.get_community_feed_public(text);

create function public.get_community_feed_public(p_category text default null)
returns table (
  id uuid,
  author_id uuid,
  category text,
  title text,
  body text,
  note text,
  created_at timestamptz,
  expires_at timestamptz,
  availability_payload jsonb,
  author_full_name text,
  author_photo_url text,
  author_city text,
  author_role text,
  author_average_rating numeric,
  author_total_ratings int
)
language sql
security definer
set search_path = public
stable
as $$
  select
    cp.id,
    cp.author_id,
    cp.category,
    cp.title,
    cp.body,
    cp.note,
    cp.created_at,
    cp.expires_at,
    cp.availability_payload,
    p.full_name,
    p.photo_url,
    p.city,
    p.role::text,
    coalesce(rev.avg_rating, 0)::numeric,
    coalesce(rev.cnt, 0)::int
  from public.community_posts cp
  inner join public.profiles p on p.id = cp.author_id
  left join lateral (
    select
      round(avg(r.rating)::numeric, 2) as avg_rating,
      count(*)::int as cnt
    from public.job_reviews r
    where r.reviewee_id = p.id
  ) rev on true
  where cp.status = 'active'
    and cp.expires_at > now()
    and (
      p_category is null
      or trim(p_category) = ''
      or cp.category = p_category
    )
  order by cp.expires_at asc
$$;

comment on function public.get_community_feed_public(text) is
  'Active, unexpired community availability pulses; soonest ending first; author ratings from job_reviews.';

grant execute on function public.get_community_feed_public(text) to anon, authenticated;
