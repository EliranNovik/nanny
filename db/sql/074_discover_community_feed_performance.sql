-- 074_discover_community_feed_performance.sql
-- Faster Discover home + community feeds: cheaper feed RPC + supporting indexes.
-- Run in Supabase SQL Editor after prior migrations.

-- Replace single-arg overload (Postgres keeps both until dropped).
drop function if exists public.get_community_feed_public(text);
drop function if exists public.get_community_feed_public(text, integer);

-- Ratings come from profiles.average_rating / total_ratings (maintained by job_reviews trigger)
-- instead of a per-row lateral aggregate over job_reviews (major cost on large feeds).
-- p_limit caps rows returned (default 400); Discover category counts should pass a higher limit.
create function public.get_community_feed_public(
  p_category text default null,
  p_limit int default 400
)
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
  author_is_verified boolean,
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
    coalesce(p.is_verified, false),
    coalesce(round(p.average_rating::numeric, 2), 0)::numeric,
    coalesce(p.total_ratings, 0)::int
  from public.community_posts cp
  inner join public.profiles p on p.id = cp.author_id
  where cp.status = 'active'
    and cp.expires_at > now()
    and (
      p_category is null
      or trim(p_category) = ''
      or cp.category = p_category
    )
  order by cp.expires_at asc
  limit greatest(1, least(coalesce(nullif(p_limit, 0), 400), 800));
$$;

comment on function public.get_community_feed_public(text, integer) is
  'Active availability pulses; soonest ending first. Author ratings from profiles aggregates. Optional p_limit (max 800).';

grant execute on function public.get_community_feed_public(text, integer) to anon, authenticated;
grant execute on function public.get_community_feed_public(text, integer) to service_role;

-- Feed filter: active + not expired (matches RPC where clause)
create index if not exists idx_community_posts_feed_active_expires
  on public.community_posts (status, expires_at asc, category)
  where status = 'active';

-- Hire-interest lists on Discover “your posts” + CommunityPostsPage
create index if not exists idx_community_post_hire_interests_post_status_created
  on public.community_post_hire_interests (community_post_id, status, created_at desc);

create index if not exists idx_community_post_hire_interests_client_created
  on public.community_post_hire_interests (client_id, created_at desc);

-- community_post_comments(post_id, created_at) already indexed in 051_community_post_comments.sql
