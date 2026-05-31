-- Block unverified users from sharing posts (profile_posts + community_posts).

create or replace function public.enforce_author_kyc_for_post()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.profiles p
    where p.id = new.author_id
      and coalesce(p.is_admin, false) = false
      and p.kyc_status is distinct from 'approved'
  ) then
    raise exception 'KYC_REQUIRED: Identity verification is required before sharing a post';
  end if;
  return new;
end;
$$;

drop trigger if exists profile_posts_require_kyc on public.profile_posts;

create trigger profile_posts_require_kyc
  before insert on public.profile_posts
  for each row
  execute function public.enforce_author_kyc_for_post();

drop trigger if exists community_posts_require_kyc on public.community_posts;

create trigger community_posts_require_kyc
  before insert on public.community_posts
  for each row
  execute function public.enforce_author_kyc_for_post();
