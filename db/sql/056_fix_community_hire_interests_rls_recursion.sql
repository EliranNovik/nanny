-- Break RLS recursion between community_posts and community_post_hire_interests:
-- community_posts SELECT referenced hire_interests; hire_interests "post author" policy
-- subqueried community_posts → infinite recursion (42P17).

create or replace function public.community_post_author_matches_uid(
  p_community_post_id uuid,
  p_uid uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.community_posts cp
    where cp.id = p_community_post_id
      and cp.author_id = p_uid
  );
$$;

comment on function public.community_post_author_matches_uid(uuid, uuid) is
  'RLS-safe author check (SECURITY DEFINER) to avoid recursion with community_post_hire_interests policies.';

revoke all on function public.community_post_author_matches_uid(uuid, uuid) from public;
grant execute on function public.community_post_author_matches_uid(uuid, uuid) to authenticated;
grant execute on function public.community_post_author_matches_uid(uuid, uuid) to service_role;

drop policy if exists "community_post_hire_interests_select_post_author"
  on public.community_post_hire_interests;

create policy "community_post_hire_interests_select_post_author"
  on public.community_post_hire_interests for select
  using (
    public.community_post_author_matches_uid(community_post_id, auth.uid())
  );
