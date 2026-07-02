-- ============================================================
-- 103_profile_post_listing_status.sql
-- Author-set listing status on profile posts (stored in post_metadata)
--
-- post_metadata.listing_status (optional):
--   request_help  → helper_found
--   offer_service → already_helping
--   event         → expired
--
-- Authors may update via profile_posts_update_own (see 100_*.sql).
-- Run once in Supabase SQL Editor
-- ============================================================

comment on column public.profile_posts.post_metadata is
  'JSON metadata for typed posts. Optional listing_status: helper_found | already_helping | expired (author-set on request/offer/event posts).';

create or replace function public.validate_profile_post_listing_status()
returns trigger
language plpgsql
as $$
declare
  status text;
  ptype text;
begin
  status := nullif(trim(both from coalesce(new.post_metadata->>'listing_status', '')), '');
  if status is null then
    return new;
  end if;

  if status not in ('helper_found', 'already_helping', 'expired') then
    raise exception 'invalid listing_status: %', status;
  end if;

  ptype := new.post_type_id;

  if ptype = 'request_help' and status <> 'helper_found' then
    raise exception 'request_help posts only allow listing_status helper_found';
  elsif ptype = 'offer_service' and status <> 'already_helping' then
    raise exception 'offer_service posts only allow listing_status already_helping';
  elsif ptype = 'event' and status <> 'expired' then
    raise exception 'event posts only allow listing_status expired';
  elsif ptype not in ('request_help', 'offer_service', 'event') then
    raise exception 'listing_status not allowed for post type %', ptype;
  end if;

  return new;
end;
$$;

drop trigger if exists profile_posts_validate_listing_status on public.profile_posts;

create trigger profile_posts_validate_listing_status
  before insert or update of post_metadata, post_type_id
  on public.profile_posts
  for each row
  execute function public.validate_profile_post_listing_status();
