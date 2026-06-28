-- Cached on-demand translations (Google Cloud Translation via API service role)
create table if not exists public.content_translations (
  id uuid primary key default gen_random_uuid(),
  content_kind text not null check (
    content_kind in (
      'profile_post',
      'job_request',
      'profile_post_comment',
      'job_request_comment',
      'chat_message'
    )
  ),
  content_id uuid not null,
  field_name text not null check (field_name in ('title', 'body')),
  target_locale text not null check (target_locale in ('en', 'he', 'ru', 'fr')),
  source_locale text,
  source_fingerprint text not null,
  translated_text text not null,
  provider text not null default 'google',
  created_at timestamptz not null default now(),
  unique (content_kind, content_id, field_name, target_locale, source_fingerprint)
);

create index if not exists content_translations_lookup_idx
  on public.content_translations (content_kind, content_id, target_locale, source_fingerprint);

alter table public.content_translations enable row level security;

-- No client policies: only service role (API backend) reads/writes this table.
