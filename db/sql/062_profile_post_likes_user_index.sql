-- ============================================================
-- 062_profile_post_likes_user_index.sql
-- Speed up "Liked posts" per-user queries for the new social feed.
-- ============================================================

create index if not exists profile_post_likes_user_id_created_at_idx
  on public.profile_post_likes (user_id, created_at desc);

