-- 088_public_profile_guest_read.sql
-- Allow unsigned visitors to view public profile pages (/profile/:userId).

drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public"
  on public.profiles for select
  using (true);

drop policy if exists "public_profile_media_select_auth" on public.public_profile_media;
drop policy if exists "public_profile_media_select_public" on public.public_profile_media;
create policy "public_profile_media_select_public"
  on public.public_profile_media for select
  using (true);

grant execute on function public.get_helpers_live_help_week_counts(uuid[]) to anon;
