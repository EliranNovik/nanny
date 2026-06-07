-- Rename ai_generated_copy comments to reflect template-based generation (column name unchanged for compatibility).

comment on column public.profile_posts.ai_generated_copy is
  'Template-generated display copy: title, short_text, feed_preview, tags (jsonb). Set once on create/edit.';

comment on column public.job_requests.ai_generated_copy is
  'Template-generated display copy: title, short_text, feed_preview, tags (jsonb). Set once on create.';
