-- ============================================================
-- 090_profile_posts_custom_category.sql
-- Free-text category label when user picks "Other help" on a post
-- Run in Supabase SQL Editor
-- ============================================================

alter table public.profile_posts
  add column if not exists custom_category text;

alter table public.profile_posts
  drop constraint if exists profile_posts_custom_category_len;

alter table public.profile_posts
  add constraint profile_posts_custom_category_len
  check (custom_category is null or char_length(custom_category) <= 15);

comment on column public.profile_posts.custom_category is
  'User-defined category label (max 15 chars) when post_metadata category/service is other_help';
