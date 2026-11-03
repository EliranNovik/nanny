-- Verification is optional for posting help requests and offer/share posts.
-- Re-drop legacy KYC enforce triggers in case an older DB still has them.
-- Run this in the Supabase SQL Editor.

drop trigger if exists job_requests_require_kyc on public.job_requests;
drop trigger if exists profile_posts_require_kyc on public.profile_posts;
drop trigger if exists community_posts_require_kyc on public.community_posts;

drop function if exists public.enforce_job_create_kyc();
drop function if exists public.enforce_author_kyc_for_post();

comment on column public.profiles.kyc_status is
  'Didit KYC lifecycle. Optional for posting requests/offers. is_verified badge only from Didit approval.';
