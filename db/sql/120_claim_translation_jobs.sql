-- Claim pending profile-post translation jobs for the Render worker.
-- Companion to 119_profile_post_translations.sql.
-- Service role only. SKIP LOCKED makes overlapping cron ticks safe.

create or replace function public.claim_translation_jobs(p_limit int default 20)
returns setof public.translation_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.translation_jobs
  set
    status = 'processing',
    attempts = attempts + 1,
    claimed_at = now(),
    updated_at = now()
  where id in (
    select id
    from public.translation_jobs
    where status = 'pending'
      and next_attempt_at <= now()
    order by next_attempt_at
    limit greatest(1, least(coalesce(p_limit, 20), 50))
    for update skip locked
  )
  returning *;
end;
$$;

revoke all on function public.claim_translation_jobs(int) from public, anon, authenticated;
grant execute on function public.claim_translation_jobs(int) to service_role;

comment on function public.claim_translation_jobs(int) is
  'Claim pending translation_jobs for POST /api/translate/process-queue. FOR UPDATE SKIP LOCKED.';
