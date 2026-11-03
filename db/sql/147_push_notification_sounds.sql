-- ============================================================
-- 147_push_notification_sounds.sql
-- Attach custom Tebnu push sound + Android channel id to every
-- queued push so the API worker can set APNs aps.sound and
-- FCM android.notification.channelId.
--
-- iOS bundled files: tebnu_request.mp3 | tebnu_notify.mp3
-- Android channels:  tebnu_requests | tebnu_messages_v2 | tebnu_general
-- ============================================================

create or replace function public.push_sound_for_type(
  p_type public.push_notification_type
)
returns text
language sql
immutable
as $$
  select case
    when p_type::text in ('new_request', 'new_match') then 'tebnu_request.mp3'
    else 'tebnu_notify.mp3'
  end;
$$;

create or replace function public.push_android_channel_for_type(
  p_type public.push_notification_type
)
returns text
language sql
immutable
as $$
  select case
    when p_type::text in ('new_request', 'new_match') then 'tebnu_requests'
    when p_type::text = 'message' then 'tebnu_messages_v2'
    else 'tebnu_general'
  end;
$$;

create or replace function public.enqueue_push_notification(
  p_user_id uuid,
  p_type public.push_notification_type,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb,
  p_dedupe_key text default null,
  p_scheduled_for timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  enriched jsonb;
begin
  if p_user_id is null then
    return null;
  end if;

  if not public.push_type_enabled(p_user_id, p_type) then
    return null;
  end if;

  enriched := coalesce(p_data, '{}'::jsonb)
    || jsonb_build_object(
      'sound', public.push_sound_for_type(p_type),
      'android_channel_id', public.push_android_channel_for_type(p_type),
      'notification_type', p_type::text
    );

  insert into public.push_notification_queue (
    user_id,
    notification_type,
    title,
    body,
    data,
    dedupe_key,
    scheduled_for
  )
  values (
    p_user_id,
    p_type,
    left(p_title, 200),
    left(p_body, 500),
    enriched,
    p_dedupe_key,
    coalesce(p_scheduled_for, now())
  )
  on conflict (dedupe_key) where dedupe_key is not null do nothing
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.enqueue_push_notification(uuid, public.push_notification_type, text, text, jsonb, text, timestamptz) from public;
grant execute on function public.enqueue_push_notification(uuid, public.push_notification_type, text, text, jsonb, text, timestamptz) to service_role;

comment on function public.push_sound_for_type(public.push_notification_type) is
  'iOS APNs aps.sound filename bundled in the mobile app.';

comment on function public.push_android_channel_for_type(public.push_notification_type) is
  'Android 8+ FCM notification channel id that owns the custom sound.';
