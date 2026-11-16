-- Why a member blocked another member.
-- The app writes `reason` when the blocker confirms the block sheet.
-- Existing rows stay valid with a null reason until the app starts sending one.
-- Admins already read every row via user_blocks_select_admin (163).

alter table public.user_blocks
  add column if not exists reason text,
  add column if not exists reason_note text;

alter table public.user_blocks
  drop constraint if exists user_blocks_reason_check;
alter table public.user_blocks
  add constraint user_blocks_reason_check
  check (
    reason is null
    or reason in (
      'spam',
      'harassment',
      'hate_speech',
      'nudity',
      'violence',
      'scam',
      'unwanted',
      'other'
    )
  );

alter table public.user_blocks
  drop constraint if exists user_blocks_reason_note_len;
alter table public.user_blocks
  add constraint user_blocks_reason_note_len
  check (reason_note is null or char_length(btrim(reason_note)) <= 280);

comment on column public.user_blocks.reason is
  'Block sheet code: spam, harassment, hate_speech, nudity, violence, scam, unwanted, other.';
comment on column public.user_blocks.reason_note is
  'Optional note, mainly when reason is other. Max 280 characters.';
