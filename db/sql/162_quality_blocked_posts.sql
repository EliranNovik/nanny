-- Keep posts the quality manager blocked, so admins can see them next to flagged posts.
-- Blocked rows have no live post. Flagged rows still point at the post that went up.

alter table public.quality_post_flags
  add column if not exists outcome text not null default 'flag';

alter table public.quality_post_flags
  drop constraint if exists quality_post_flags_outcome_check;

alter table public.quality_post_flags
  add constraint quality_post_flags_outcome_check
  check (outcome in ('flag', 'block'));

alter table public.quality_post_flags
  drop constraint if exists quality_post_flags_one_post;

alter table public.quality_post_flags
  add constraint quality_post_flags_one_post check (
    (
      outcome = 'block'
      and profile_post_id is null
      and community_post_id is null
    )
    or (
      outcome = 'flag'
      and (
        (profile_post_id is not null and community_post_id is null)
        or (profile_post_id is null and community_post_id is not null)
      )
    )
  );
