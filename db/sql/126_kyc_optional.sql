-- Make identity verification optional.
-- Users can post help requests, share posts, and go live without Didit.
-- The verified badge still only comes from Didit (service role / webhook).
-- Run this in the Supabase SQL Editor.

drop trigger if exists job_requests_require_kyc on public.job_requests;
drop trigger if exists freelancer_profiles_go_live_kyc on public.freelancer_profiles;
drop trigger if exists profile_posts_require_kyc on public.profile_posts;
drop trigger if exists community_posts_require_kyc on public.community_posts;

drop function if exists public.enforce_job_create_kyc();
drop function if exists public.enforce_go_live_kyc();
drop function if exists public.enforce_author_kyc_for_post();

comment on column public.profiles.kyc_status is
  'Didit KYC lifecycle. Optional. Unverified users can post and go live; is_verified badge only from Didit approval.';
