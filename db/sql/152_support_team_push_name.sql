-- Support chats are sent from the admin account. Push titles should say
-- Support Team, the same name shown in the chat, not the admin's profile name.
-- Safe to re-run. Updates both the current message trigger and the older one,
-- if that older function is still installed.

create or replace function public.push_on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conv public.conversations%rowtype;
  recipient uuid;
  sender_name text;
  sender_is_admin boolean := false;
  body_text text;
begin
  select * into conv from public.conversations where id = new.conversation_id;
  if not found then
    return new;
  end if;

  if new.sender_id = conv.client_id then
    recipient := conv.freelancer_id;
  else
    recipient := conv.client_id;
  end if;

  if recipient is null or recipient = new.sender_id then
    return new;
  end if;

  select
    coalesce(nullif(trim(full_name), ''), 'Someone'),
    coalesce(is_admin, false)
    into sender_name, sender_is_admin
  from public.profiles
  where id = new.sender_id;

  if sender_is_admin then
    sender_name := 'Support Team';
  end if;

  body_text := coalesce(left(new.body, 120), 'Sent you a message');
  if sender_is_admin then
    body_text := regexp_replace(body_text, '^[' || chr(8203) || chr(8288) || ']+', '');
    body_text := coalesce(nullif(trim(body_text), ''), 'Sent you a message');
  end if;

  perform public.enqueue_push_notification(
    recipient,
    'message',
    sender_name,
    body_text,
    jsonb_build_object(
      'type', 'message',
      'conversation_id', new.conversation_id,
      'message_id', new.id,
      'sender_id', new.sender_id,
      'link', '/messages/' || new.conversation_id::text
    ),
    'message:' || new.id::text
  );

  return new;
end;
$$;


create or replace function public.trg_messages_enqueue_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
  v_sender_name text;
  v_sender_photo text;
  v_sender_is_admin boolean := false;
  v_title text;
  v_body text;
  v_data jsonb;
  v_dedupe text;
  v_push_enabled boolean;
  v_messages_enabled boolean;
begin
  if NEW.conversation_id is null or NEW.sender_id is null then
    return NEW;
  end if;

  select case
           when c.client_id = NEW.sender_id then c.freelancer_id
           when c.freelancer_id = NEW.sender_id then c.client_id
           else null
         end
    into v_recipient
  from public.conversations c
  where c.id = NEW.conversation_id;

  if v_recipient is null or v_recipient = NEW.sender_id then
    return NEW;
  end if;

  select
    nullif(trim(p.full_name), ''),
    nullif(trim(p.photo_url), ''),
    coalesce(p.is_admin, false)
    into v_sender_name, v_sender_photo, v_sender_is_admin
  from public.profiles p
  where p.id = NEW.sender_id;

  if v_sender_is_admin then
    v_sender_name := 'Support Team';
  end if;

  v_title := coalesce(v_sender_name, 'New message');

  if nullif(trim(coalesce(NEW.body, '')), '') is not null then
    v_body := left(trim(NEW.body), 140);
  elsif NEW.attachment_type is not null then
    v_body := case
      when NEW.attachment_type like 'image%' then 'Sent a photo'
      when NEW.attachment_type like 'video%' then 'Sent a video'
      when NEW.attachment_type like 'audio%' then 'Sent an audio message'
      else 'Sent an attachment'
    end;
  else
    v_body := 'Sent you a message';
  end if;

  if v_sender_is_admin then
    v_body := regexp_replace(v_body, '^[' || chr(8203) || chr(8288) || ']+', '');
    v_body := nullif(trim(v_body), '');
    if v_body is null then
      v_body := 'Sent you a message';
    end if;
  end if;

  v_data := jsonb_build_object(
    'type', 'message',
    'conversation_id', NEW.conversation_id::text,
    'message_id', NEW.id::text,
    'sender_id', NEW.sender_id::text,
    'actor_id', NEW.sender_id::text,
    'link', '/messages/' || NEW.conversation_id::text,
    'image', coalesce(v_sender_photo, ''),
    'actor_photo_url', coalesce(v_sender_photo, '')
  );
  v_dedupe := 'message:' || NEW.id::text;

  if to_regclass('public.push_notification_preferences') is not null then
    select
      coalesce(prefs.push_enabled, true),
      coalesce(prefs.messages_enabled, true)
      into v_push_enabled, v_messages_enabled
    from public.push_notification_preferences prefs
    where prefs.user_id = v_recipient;

    if not found then
      v_push_enabled := true;
      v_messages_enabled := true;
    end if;

    if not v_push_enabled or not v_messages_enabled then
      return NEW;
    end if;
  end if;

  perform public._tebnu_enqueue_push(
    v_recipient,
    'message',
    v_title,
    v_body,
    v_data,
    v_dedupe
  );

  return NEW;
exception
  when others then
    raise warning 'Message push enqueue error for %: %', NEW.id, SQLERRM;
    return NEW;
end;
$$;
