-- Teach the quality reviewer to block illegal-drug posts.
-- Notes are loaded on every POST /api/quality/review (no API redeploy required).
-- Apply in Supabase SQL editor.

insert into public.quality_manager_notes (kind, title, body, sort_order)
select * from (values
  (
    'category'::text,
    'Illegal drugs'::text,
    'Buying, selling, offering, using, promoting, or celebrating illegal drugs or controlled substances. Includes clear statements like "let''s do drugs", "taking drugs", "drugs are good", dealing, or named hard drugs (cocaine, heroin, meth, fentanyl, etc.). Confidence must be 90 or higher so the post is blocked. Do not allow and do not only flag.'::text,
    5
  ),
  (
    'standard'::text,
    'Illegal drugs are not allowed'::text,
    'Posts about buying, selling, using, or promoting illegal drugs must be blocked (confidence 90+). Do not return allow or flag for that content.'::text,
    1
  )
) as seed(kind, title, body, sort_order)
where not exists (
  select 1 from public.quality_manager_notes existing
  where existing.kind = seed.kind and existing.title = seed.title
);
