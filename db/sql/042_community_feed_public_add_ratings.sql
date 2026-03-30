-- 042_community_feed_public_add_ratings.sql
-- Same as 038: RPC includes author rating aggregates from job_reviews (per profile / reviewee).
-- Apply if you already deployed an older get_community_feed_public without rating columns.

drop function if exists public.get_community_feed_public(text);

create function public.get_community_feed_public(p_category text default null)
returns table (
  id uuid,
  author_id uuid,
  category text,
  title text,
  body text,
  created_at timestamptz,
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
    cp.created_at,
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
    and (
      p_category is null
      or trim(p_category) = ''
      or cp.category = p_category
    )
  order by cp.created_at desc
$$;
