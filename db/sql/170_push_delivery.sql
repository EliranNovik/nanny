-- Quiet hours, lock-screen message previews, and a badge refresh when a
-- chat is opened. The API worker applies grouping and wording on its own.
-- Run once in the Supabase SQL editor.

alter table public.push_notification_preferences
  add column if not exists show_message_preview boolean not null default false;

alter table public.push_notification_preferences
  add column if not exists quiet_hours_enabled boolean not null default true;

comment on column public.push_notification_preferences.show_message_preview is
  'When false, message alerts name the sender and hide the message text.';

comment on column public.push_notification_preferences.quiet_hours_enabled is
  'When true, non-job alerts wait until 07:00 in the user timezone.';

alter type public.push_notification_type add value if not exists 'badge';

create or replace function public.push_on_message_read()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reader uuid;
begin
  if old.read_at is not null or new.read_at is null then
    return new;
  end if;

  reader := new.read_by;
  if reader is null then
    select case
      when c.client_id = new.sender_id then c.freelancer_id
      else c.client_id
    end
    into reader
    from public.conversations c
    where c.id = new.conversation_id;
  end if;

  if reader is null or reader = new.sender_id then
    return new;
  end if;

  -- One badge refresh per person per 15 seconds, even if a whole thread is marked read.
  perform public.enqueue_push_notification(
    reader,
    'badge',
    'Badge',
    'Unread',
    jsonb_build_object('type', 'badge', 'badge_only', '1'),
    'badge:' || reader::text || ':' || floor(extract(epoch from now()) / 15)::bigint::text
  );

  return new;
exception
  when others then
    raise warning 'Badge push enqueue error for %: %', new.id, SQLERRM;
    return new;
end;
$$;

drop trigger if exists push_message_read on public.messages;
create trigger push_message_read
  after update of read_at on public.messages
  for each row execute function public.push_on_message_read();
