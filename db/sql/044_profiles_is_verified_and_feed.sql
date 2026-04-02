-- 044_profiles_is_verified_and_feed.sql
-- Verified badge on public community feed; extend get_community_feed_public.

alter table public.profiles
  add column if not exists is_verified boolean not null default false;

comment on column public.profiles.is_verified is
  'Platform-verified identity/background; shown on public availability cards.';

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
  'Active availability pulses with author is_verified; soonest ending first.';

grant execute on function public.get_community_feed_public(text) to anon, authenticated;
