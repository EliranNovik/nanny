-- ============================================================
-- 101_push_notifications.sql
-- Push notifications: device tokens, user preferences, queue,
-- expiry schedules, and DB triggers for iOS + Android (via FCM).
--
-- Run once in Supabase Dashboard → SQL Editor.
-- Backend: apps/api (Firebase Cloud Messaging HTTP v1).
-- ============================================================

-- ── Types ────────────────────────────────────────────────────

do $$ begin
  create type public.push_platform as enum ('ios', 'android', 'web');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.push_notification_type as enum (
    'message',
    'new_match',
    'request_accepted',
    'match_selected',
    'favorite_profile_post',
    'comment',
    'like',
    'post_expiry'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.push_expiry_timing as enum ('at_expiry', 'today', 'tomorrow');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.push_queue_status as enum ('pending', 'sent', 'failed', 'skipped');
exception when duplicate_object then null;
end $$;

-- ── Device tokens (FCM) ─────────────────────────────────────

create table if not exists public.push_device_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  token         text not null,
  platform      public.push_platform not null,
  device_id     text,
  app_version   text,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint push_device_tokens_token_len check (char_length(token) between 20 and 4096)
);

create unique index if not exists push_device_tokens_token_uidx
  on public.push_device_tokens (token);

create index if not exists push_device_tokens_user_id_idx
  on public.push_device_tokens (user_id);

comment on table public.push_device_tokens is
  'FCM registration tokens for iOS/Android. One row per device token; upsert on register.';

-- ── User preferences ──────────────────────────────────────────

create table if not exists public.push_notification_preferences (
  user_id                      uuid primary key references public.profiles(id) on delete cascade,
  push_enabled                 boolean not null default true,
  messages_enabled             boolean not null default true,
  new_match_enabled            boolean not null default true,
  request_accepted_enabled     boolean not null default true,
  match_selected_enabled       boolean not null default true,
  favorite_profile_post_enabled boolean not null default true,
  comment_enabled              boolean not null default true,
  like_enabled                 boolean not null default true,
  post_expiry_enabled          boolean not null default true,
  post_expiry_timing           public.push_expiry_timing not null default 'at_expiry',
  timezone                     text not null default 'UTC',
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);

comment on column public.push_notification_preferences.post_expiry_timing is
  'at_expiry = when listing expires; today = morning of expiry day; tomorrow = morning of day before expiry.';

-- ── Outbox queue (processed by apps/api cron) ─────────────────

create table if not exists public.push_notification_queue (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  notification_type public.push_notification_type not null,
  title          text not null,
  body           text not null,
  data           jsonb not null default '{}'::jsonb,
  dedupe_key     text,
  status         public.push_queue_status not null default 'pending',
  attempts       int not null default 0,
  last_error     text,
  scheduled_for  timestamptz not null default now(),
  sent_at        timestamptz,
  created_at     timestamptz not null default now()
);

create unique index if not exists push_notification_queue_dedupe_uidx
  on public.push_notification_queue (dedupe_key)
  where dedupe_key is not null;

create index if not exists push_notification_queue_pending_idx
  on public.push_notification_queue (scheduled_for asc)
  where status = 'pending';

-- ── Post / request expiry reminder schedules ────────────────────

create table if not exists public.push_post_expiry_schedules (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  entity_type     text not null check (entity_type in ('community_post', 'job_request')),
  entity_id       uuid not null,
  expires_at      timestamptz not null,
  reminder_timing public.push_expiry_timing not null,
  reminder_at     timestamptz not null,
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (entity_type, entity_id, user_id, reminder_timing)
);

create index if not exists push_post_expiry_schedules_due_idx
  on public.push_post_expiry_schedules (reminder_at asc)
  where sent_at is null;

-- ── Helpers ───────────────────────────────────────────────────

create or replace function public.touch_push_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists push_device_tokens_touch on public.push_device_tokens;
create trigger push_device_tokens_touch
  before update on public.push_device_tokens
  for each row execute function public.touch_push_updated_at();

drop trigger if exists push_notification_preferences_touch on public.push_notification_preferences;
create trigger push_notification_preferences_touch
  before update on public.push_notification_preferences
  for each row execute function public.touch_push_updated_at();

drop trigger if exists push_post_expiry_schedules_touch on public.push_post_expiry_schedules;
create trigger push_post_expiry_schedules_touch
  before update on public.push_post_expiry_schedules
  for each row execute function public.touch_push_updated_at();

create or replace function public.ensure_push_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.push_notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_ensure_push_prefs on public.profiles;
create trigger profiles_ensure_push_prefs
  after insert on public.profiles
  for each row execute function public.ensure_push_notification_preferences();

-- Backfill preferences for existing users
insert into public.push_notification_preferences (user_id)
select p.id from public.profiles p
on conflict (user_id) do nothing;

create or replace function public.push_type_enabled(
  p_user_id uuid,
  p_type public.push_notification_type
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  prefs public.push_notification_preferences%rowtype;
begin
  select * into prefs
  from public.push_notification_preferences
  where user_id = p_user_id;

  if not found then
    return true;
  end if;

  if not prefs.push_enabled then
    return false;
  end if;

  case p_type
    when 'message' then return prefs.messages_enabled;
    when 'new_match' then return prefs.new_match_enabled;
    when 'request_accepted' then return prefs.request_accepted_enabled;
    when 'match_selected' then return prefs.match_selected_enabled;
    when 'favorite_profile_post' then return prefs.favorite_profile_post_enabled;
    when 'comment' then return prefs.comment_enabled;
    when 'like' then return prefs.like_enabled;
    when 'post_expiry' then return prefs.post_expiry_enabled;
    else return true;
  end case;
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
begin
  if p_user_id is null then
    return null;
  end if;

  if not public.push_type_enabled(p_user_id, p_type) then
    return null;
  end if;

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
    coalesce(p_data, '{}'::jsonb),
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

-- Morning reminder in user timezone (fallback UTC)
create or replace function public.push_morning_on_day(
  p_day date,
  p_timezone text default 'UTC'
)
returns timestamptz
language plpgsql
immutable
as $$
begin
  begin
    return (p_day::timestamp + time '09:00') at time zone coalesce(nullif(trim(p_timezone), ''), 'UTC');
  exception when others then
    return (p_day::timestamp + time '09:00') at time zone 'UTC';
  end;
end;
$$;

create or replace function public.compute_job_request_expires_at(
  p_when_timeframe text,
  p_custom_when_at timestamptz,
  p_created_at timestamptz,
  p_confirm_ends_at timestamptz
)
returns timestamptz
language plpgsql
immutable
as $$
declare
  base_day date;
begin
  if p_confirm_ends_at is not null then
    return p_confirm_ends_at;
  end if;

  base_day := (coalesce(p_created_at, now()) at time zone 'UTC')::date;

  case coalesce(p_when_timeframe, '')
    when 'now' then
      return coalesce(p_created_at, now()) + interval '24 hours';
    when 'today' then
      return (base_day + 1)::timestamp at time zone 'UTC';
    when 'tomorrow' then
      return (base_day + 2)::timestamp at time zone 'UTC';
    when 'this_week' then
      return (base_day + (7 - extract(isodow from base_day)::int))::timestamp at time zone 'UTC' + interval '1 day';
    when 'custom' then
      return coalesce(p_custom_when_at, p_created_at + interval '7 days');
    else
      return coalesce(p_created_at, now()) + interval '7 days';
  end case;
end;
$$;

create or replace function public.refresh_push_post_expiry_schedules(
  p_user_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tz text;
  expiry_day date;
begin
  if p_user_id is null or p_expires_at is null then
    return;
  end if;

  select coalesce(p.timezone, 'UTC') into tz
  from public.push_notification_preferences p
  where p.user_id = p_user_id;

  if not found then
    tz := 'UTC';
  end if;

  expiry_day := (p_expires_at at time zone tz)::date;

  delete from public.push_post_expiry_schedules
  where entity_type = p_entity_type
    and entity_id = p_entity_id
    and user_id = p_user_id;

  insert into public.push_post_expiry_schedules (
    user_id, entity_type, entity_id, expires_at, reminder_timing, reminder_at
  )
  values
    (p_user_id, p_entity_type, p_entity_id, p_expires_at, 'at_expiry', p_expires_at),
    (p_user_id, p_entity_type, p_entity_id, p_expires_at, 'today', public.push_morning_on_day(expiry_day, tz)),
    (p_user_id, p_entity_type, p_entity_id, p_expires_at, 'tomorrow', public.push_morning_on_day(expiry_day - 1, tz))
  on conflict (entity_type, entity_id, user_id, reminder_timing) do update
    set expires_at = excluded.expires_at,
        reminder_at = excluded.reminder_at,
        sent_at = null,
        updated_at = now();
end;
$$;

-- ── Event triggers ────────────────────────────────────────────

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

  select coalesce(full_name, 'Someone') into sender_name
  from public.profiles where id = new.sender_id;

  perform public.enqueue_push_notification(
    recipient,
    'message',
    sender_name,
    coalesce(left(new.body, 120), 'Sent you a message'),
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

drop trigger if exists push_messages_insert on public.messages;
create trigger push_messages_insert
  after insert on public.messages
  for each row execute function public.push_on_message_insert();

create or replace function public.push_on_job_candidate_notification_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  job_city text;
begin
  select location_city into job_city
  from public.job_requests where id = new.job_id;

  perform public.enqueue_push_notification(
    new.freelancer_id,
    'new_match',
    'New job match',
    coalesce('New help request in ' || job_city, 'You have a new job match nearby'),
    jsonb_build_object(
      'type', 'new_match',
      'job_id', new.job_id,
      'notification_id', new.id,
      'link', '/freelancer/jobs/match?jobId=' || new.job_id::text
    ),
    'new_match:' || new.id::text
  );

  return new;
end;
$$;

drop trigger if exists push_job_candidate_notification_insert on public.job_candidate_notifications;
create trigger push_job_candidate_notification_insert
  after insert on public.job_candidate_notifications
  for each row execute function public.push_on_job_candidate_notification_insert();

create or replace function public.push_on_job_confirmation_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  client uuid;
  helper_name text;
begin
  if new.status <> 'available' then
    return new;
  end if;

  select client_id into client from public.job_requests where id = new.job_id;
  if client is null then
    return new;
  end if;

  select coalesce(full_name, 'A helper') into helper_name
  from public.profiles where id = new.freelancer_id;

  perform public.enqueue_push_notification(
    client,
    'request_accepted',
    'Request accepted',
    helper_name || ' is available for your request',
    jsonb_build_object(
      'type', 'request_accepted',
      'job_id', new.job_id,
      'freelancer_id', new.freelancer_id,
      'link', '/client/jobs/' || new.job_id::text || '/confirmed'
    ),
    'request_accepted:' || new.id::text
  );

  return new;
end;
$$;

drop trigger if exists push_job_confirmation_insert on public.job_confirmations;
create trigger push_job_confirmation_insert
  after insert on public.job_confirmations
  for each row execute function public.push_on_job_confirmation_insert();

create or replace function public.push_on_job_selected()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  client_name text;
begin
  if new.selected_freelancer_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.selected_freelancer_id is not distinct from new.selected_freelancer_id then
    return new;
  end if;

  select coalesce(full_name, 'A client') into client_name
  from public.profiles where id = new.client_id;

  perform public.enqueue_push_notification(
    new.selected_freelancer_id,
    'match_selected',
    'You were selected',
    client_name || ' chose you for their request',
    jsonb_build_object(
      'type', 'match_selected',
      'job_id', new.id,
      'client_id', new.client_id,
      'link', '/freelancer/jobs/' || new.id::text
    ),
    'match_selected:' || new.id::text
  );

  return new;
end;
$$;

drop trigger if exists push_job_selected on public.job_requests;
create trigger push_job_selected
  after insert or update of selected_freelancer_id on public.job_requests
  for each row execute function public.push_on_job_selected();

create or replace function public.push_on_profile_post_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fav record;
  author_name text;
begin
  select coalesce(full_name, 'Someone you follow') into author_name
  from public.profiles where id = new.author_id;

  for fav in
    select user_id
    from public.profile_favorites
    where favorite_user_id = new.author_id
      and user_id <> new.author_id
  loop
    perform public.enqueue_push_notification(
      fav.user_id,
      'favorite_profile_post',
      author_name,
      'Posted something new',
      jsonb_build_object(
        'type', 'favorite_profile_post',
        'post_id', new.id,
        'author_id', new.author_id,
        'link', '/profile/' || new.author_id::text
      ),
      'favorite_post:' || new.id::text || ':' || fav.user_id::text
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists push_profile_post_insert on public.profile_posts;
create trigger push_profile_post_insert
  after insert on public.profile_posts
  for each row execute function public.push_on_profile_post_insert();

create or replace function public.push_on_profile_post_comment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author uuid;
  commenter_name text;
begin
  select author_id into post_author from public.profile_posts where id = new.post_id;
  if post_author is null or post_author = new.author_id then
    return new;
  end if;

  select coalesce(full_name, 'Someone') into commenter_name
  from public.profiles where id = new.author_id;

  perform public.enqueue_push_notification(
    post_author,
    'comment',
    'New comment',
    commenter_name || ' commented on your post',
    jsonb_build_object(
      'type', 'comment',
      'post_id', new.post_id,
      'comment_id', new.id,
      'link', '/profile/' || post_author::text
    ),
    'profile_comment:' || new.id::text
  );

  return new;
end;
$$;

drop trigger if exists push_profile_post_comment_insert on public.profile_post_comments;
create trigger push_profile_post_comment_insert
  after insert on public.profile_post_comments
  for each row execute function public.push_on_profile_post_comment_insert();

create or replace function public.push_on_profile_post_like_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author uuid;
  liker_name text;
begin
  select author_id into post_author from public.profile_posts where id = new.post_id;
  if post_author is null or post_author = new.user_id then
    return new;
  end if;

  select coalesce(full_name, 'Someone') into liker_name
  from public.profiles where id = new.user_id;

  perform public.enqueue_push_notification(
    post_author,
    'like',
    'New like',
    liker_name || ' liked your post',
    jsonb_build_object(
      'type', 'like',
      'post_id', new.post_id,
      'link', '/profile/' || post_author::text
    ),
    'profile_like:' || new.post_id::text || ':' || new.user_id::text
  );

  return new;
end;
$$;

drop trigger if exists push_profile_post_like_insert on public.profile_post_likes;
create trigger push_profile_post_like_insert
  after insert on public.profile_post_likes
  for each row execute function public.push_on_profile_post_like_insert();

create or replace function public.push_on_job_request_comment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  commenter_name text;
begin
  select client_id into owner_id from public.job_requests where id = new.job_request_id;
  if owner_id is null or owner_id = new.author_id then
    return new;
  end if;

  select coalesce(full_name, 'Someone') into commenter_name
  from public.profiles where id = new.author_id;

  perform public.enqueue_push_notification(
    owner_id,
    'comment',
    'New comment',
    commenter_name || ' commented on your request',
    jsonb_build_object(
      'type', 'comment',
      'job_request_id', new.job_request_id,
      'comment_id', new.id,
      'link', '/client/jobs'
    ),
    'job_comment:' || new.id::text
  );

  return new;
end;
$$;

drop trigger if exists push_job_request_comment_insert on public.job_request_comments;
create trigger push_job_request_comment_insert
  after insert on public.job_request_comments
  for each row execute function public.push_on_job_request_comment_insert();

create or replace function public.push_on_job_request_like_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  liker_name text;
begin
  select client_id into owner_id from public.job_requests where id = new.job_id;
  if owner_id is null or owner_id = new.user_id then
    return new;
  end if;

  select coalesce(full_name, 'Someone') into liker_name
  from public.profiles where id = new.user_id;

  perform public.enqueue_push_notification(
    owner_id,
    'like',
    'New like',
    liker_name || ' liked your request',
    jsonb_build_object(
      'type', 'like',
      'job_request_id', new.job_id,
      'link', '/client/jobs'
    ),
    'job_like:' || new.job_id::text || ':' || new.user_id::text
  );

  return new;
end;
$$;

drop trigger if exists push_job_request_like_insert on public.job_request_likes;
create trigger push_job_request_like_insert
  after insert on public.job_request_likes
  for each row execute function public.push_on_job_request_like_insert();

create or replace function public.push_on_community_post_comment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author uuid;
  commenter_name text;
begin
  select author_id into post_author from public.community_posts where id = new.post_id;
  if post_author is null or post_author = new.author_id then
    return new;
  end if;

  select coalesce(full_name, 'Someone') into commenter_name
  from public.profiles where id = new.author_id;

  perform public.enqueue_push_notification(
    post_author,
    'comment',
    'New comment',
    commenter_name || ' commented on your post',
    jsonb_build_object(
      'type', 'comment',
      'community_post_id', new.post_id,
      'comment_id', new.id,
      'link', '/community/posts'
    ),
    'community_comment:' || new.id::text
  );

  return new;
end;
$$;

drop trigger if exists push_community_post_comment_insert on public.community_post_comments;
create trigger push_community_post_comment_insert
  after insert on public.community_post_comments
  for each row execute function public.push_on_community_post_comment_insert();

-- Expiry schedule maintenance
create or replace function public.push_on_community_post_expiry_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_push_post_expiry_schedules(
    new.author_id,
    'community_post',
    new.id,
    new.expires_at
  );
  return new;
end;
$$;

drop trigger if exists push_community_post_expiry_schedule on public.community_posts;
create trigger push_community_post_expiry_schedule
  after insert or update of expires_at on public.community_posts
  for each row execute function public.push_on_community_post_expiry_schedule();

create or replace function public.push_on_job_request_expiry_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  exp_at timestamptz;
begin
  exp_at := public.compute_job_request_expires_at(
    new.when_timeframe,
    new.custom_when_at,
    new.created_at,
    new.confirm_ends_at
  );

  perform public.refresh_push_post_expiry_schedules(
    new.client_id,
    'job_request',
    new.id,
    exp_at
  );

  return new;
end;
$$;

drop trigger if exists push_job_request_expiry_schedule on public.job_requests;
create trigger push_job_request_expiry_schedule
  after insert or update of when_timeframe, custom_when_at, confirm_ends_at on public.job_requests
  for each row execute function public.push_on_job_request_expiry_schedule();

-- Due expiry reminders → queue (called by API cron)
create or replace function public.enqueue_due_post_expiry_pushes(p_limit int default 200)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  enqueued int := 0;
  user_timing public.push_expiry_timing;
begin
  for rec in
    select s.*, p.post_expiry_timing as user_timing
    from public.push_post_expiry_schedules s
    join public.push_notification_preferences p on p.user_id = s.user_id
    where s.sent_at is null
      and s.reminder_at <= now()
      and s.reminder_timing = p.post_expiry_timing
    order by s.reminder_at asc
    limit greatest(p_limit, 1)
  loop
    perform public.enqueue_push_notification(
      rec.user_id,
      'post_expiry',
      'Listing expired',
      case rec.entity_type
        when 'community_post' then 'Your community post has expired'
        else 'Your help request window has ended'
      end,
      jsonb_build_object(
        'type', 'post_expiry',
        'entity_type', rec.entity_type,
        'entity_id', rec.entity_id,
        'expires_at', rec.expires_at,
        'link', case rec.entity_type
          when 'community_post' then '/community/posts'
          else '/client/jobs'
        end
      ),
      'post_expiry:' || rec.entity_type || ':' || rec.entity_id::text || ':' || rec.reminder_timing::text
    );

    update public.push_post_expiry_schedules
    set sent_at = now(), updated_at = now()
    where id = rec.id;

    enqueued := enqueued + 1;
  end loop;

  return enqueued;
end;
$$;

revoke all on function public.enqueue_due_post_expiry_pushes(int) from public;
grant execute on function public.enqueue_due_post_expiry_pushes(int) to service_role;

create or replace function public.refresh_user_push_expiry_schedules(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cp record;
  jr record;
begin
  for cp in
    select id, author_id, expires_at
    from public.community_posts
    where author_id = p_user_id
      and expires_at > now() - interval '1 day'
  loop
    perform public.refresh_push_post_expiry_schedules(
      cp.author_id, 'community_post', cp.id, cp.expires_at
    );
  end loop;

  for jr in
    select id, client_id, when_timeframe, custom_when_at, created_at, confirm_ends_at
    from public.job_requests
    where client_id = p_user_id
  loop
    perform public.refresh_push_post_expiry_schedules(
      jr.client_id,
      'job_request',
      jr.id,
      public.compute_job_request_expires_at(
        jr.when_timeframe,
        jr.custom_when_at,
        jr.created_at,
        jr.confirm_ends_at
      )
    );
  end loop;
end;
$$;

revoke all on function public.refresh_user_push_expiry_schedules(uuid) from public;
grant execute on function public.refresh_user_push_expiry_schedules(uuid) to service_role;

-- Backfill expiry schedules for active content
insert into public.push_post_expiry_schedules (
  user_id, entity_type, entity_id, expires_at, reminder_timing, reminder_at
)
select
  cp.author_id,
  'community_post',
  cp.id,
  cp.expires_at,
  timing.reminder_timing,
  case timing.reminder_timing
    when 'at_expiry' then cp.expires_at
    when 'today' then public.push_morning_on_day((cp.expires_at at time zone coalesce(p.timezone, 'UTC'))::date, coalesce(p.timezone, 'UTC'))
    when 'tomorrow' then public.push_morning_on_day(((cp.expires_at at time zone coalesce(p.timezone, 'UTC'))::date - 1), coalesce(p.timezone, 'UTC'))
  end
from public.community_posts cp
left join public.push_notification_preferences p on p.user_id = cp.author_id
cross join (
  select unnest(enum_range(null::public.push_expiry_timing)) as reminder_timing
) timing
where cp.expires_at > now() - interval '1 day'
on conflict (entity_type, entity_id, user_id, reminder_timing) do nothing;

-- ── RLS ───────────────────────────────────────────────────────

alter table public.push_device_tokens enable row level security;
alter table public.push_notification_preferences enable row level security;
alter table public.push_notification_queue enable row level security;
alter table public.push_post_expiry_schedules enable row level security;

drop policy if exists push_device_tokens_own on public.push_device_tokens;
create policy push_device_tokens_own on public.push_device_tokens
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists push_notification_preferences_own on public.push_notification_preferences;
create policy push_notification_preferences_own on public.push_notification_preferences
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Queue + schedules: service role only (API worker)
drop policy if exists push_notification_queue_service on public.push_notification_queue;
create policy push_notification_queue_service on public.push_notification_queue
  for all using (false);

drop policy if exists push_post_expiry_schedules_service on public.push_post_expiry_schedules;
create policy push_post_expiry_schedules_service on public.push_post_expiry_schedules
  for select using (auth.uid() = user_id);

comment on table public.push_notification_queue is
  'Outbox for mobile push. Rows inserted by triggers; apps/api sends via FCM and marks sent/failed.';
