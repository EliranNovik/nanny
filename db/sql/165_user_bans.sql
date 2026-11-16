-- Member bans for the admin tools on Flagged, Blocked, and Blocked users.
-- A ban does not delete the account. It blocks sign-in inside the app,
-- hides the member from everyone else, and stops messages to or from them.
-- expires_at null means the ban does not expire.
-- Run in the Supabase SQL editor.

create table if not exists public.user_bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  banned_by uuid references public.profiles(id) on delete set null,
  reason text not null,
  duration text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  lifted_at timestamptz,
  lifted_by uuid references public.profiles(id) on delete set null,
  constraint user_bans_reason_len check (char_length(btrim(reason)) between 3 and 500),
  constraint user_bans_duration_check check (duration in ('2d', '1w', '1m', 'forever')),
  constraint user_bans_forever_has_no_end check (
    (duration = 'forever' and expires_at is null)
    or (duration <> 'forever' and expires_at is not null)
  )
);

create unique index if not exists user_bans_one_open_idx
  on public.user_bans (user_id)
  where lifted_at is null;

comment on table public.user_bans is
  'Admin bans. One open row per member. Null expires_at means the ban does not expire. The profile row stays.';

create or replace function public.viewer_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  );
$$;

create or replace function public.profile_is_banned(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_bans b
    where b.user_id = p_user_id
      and b.lifted_at is null
      and (b.expires_at is null or b.expires_at > now())
  );
$$;

create or replace function public.actor_may_write()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.viewer_is_admin()
    or not public.profile_is_banned(auth.uid());
$$;

create or replace function public.my_active_ban()
returns table (
  reason text,
  duration text,
  created_at timestamptz,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select b.reason, b.duration, b.created_at, b.expires_at
  from public.user_bans b
  where b.user_id = auth.uid()
    and b.lifted_at is null
    and (b.expires_at is null or b.expires_at > now())
  order by b.created_at desc
  limit 1;
$$;

create or replace function public.admin_ban_user(
  p_user_id uuid,
  p_duration text,
  p_reason text
)
returns public.user_bans
language plpgsql
security definer
set search_path = public
as $$
declare
  ban public.user_bans;
  expires timestamptz;
  clean_reason text;
begin
  if not public.viewer_is_admin() then
    raise exception 'Not allowed';
  end if;
  if p_user_id is null or p_user_id = auth.uid() then
    raise exception 'Choose another member';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Member not found';
  end if;
  if exists (
    select 1 from public.profiles
    where id = p_user_id and is_admin = true
  ) then
    raise exception 'Admins cannot be banned';
  end if;

  clean_reason := btrim(coalesce(p_reason, ''));
  if char_length(clean_reason) < 3 or char_length(clean_reason) > 500 then
    raise exception 'Add a reason';
  end if;

  if p_duration = '2d' then
    expires := now() + interval '2 days';
  elsif p_duration = '1w' then
    expires := now() + interval '7 days';
  elsif p_duration = '1m' then
    expires := now() + interval '30 days';
  elsif p_duration = 'forever' then
    expires := null;
  else
    raise exception 'Unknown ban length';
  end if;

  update public.user_bans
  set lifted_at = now(),
      lifted_by = auth.uid()
  where user_id = p_user_id
    and lifted_at is null;

  insert into public.user_bans (user_id, banned_by, reason, duration, expires_at)
  values (p_user_id, auth.uid(), clean_reason, p_duration, expires)
  returning * into ban;

  return ban;
end;
$$;

create or replace function public.admin_lift_ban(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.viewer_is_admin() then
    raise exception 'Not allowed';
  end if;

  update public.user_bans
  set lifted_at = now(),
      lifted_by = auth.uid()
  where user_id = p_user_id
    and lifted_at is null;
end;
$$;

grant execute on function public.viewer_is_admin() to anon, authenticated;
grant execute on function public.profile_is_banned(uuid) to anon, authenticated;
grant execute on function public.actor_may_write() to anon, authenticated;
grant execute on function public.my_active_ban() to authenticated;
grant execute on function public.admin_ban_user(uuid, text, text) to authenticated;
grant execute on function public.admin_lift_ban(uuid) to authenticated;

alter table public.user_bans enable row level security;

drop policy if exists user_bans_select_own_or_admin on public.user_bans;
create policy user_bans_select_own_or_admin
  on public.user_bans
  for select
  to authenticated
  using (user_id = auth.uid() or public.viewer_is_admin());

-- Hide a banned member from search, profiles, and cards.
-- They can still read their own row, which the sign-in modal needs.
drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public"
  on public.profiles
  for select
  using (
    public.viewer_is_admin()
    or not public.profile_is_banned(id)
  );

-- A banned member can still read their own profile. They cannot browse anyone else.
drop policy if exists profiles_banned_reader_only_self on public.profiles;
create policy profiles_banned_reader_only_self
  on public.profiles
  as restrictive
  for select
  to authenticated
  using (
    public.viewer_is_admin()
    or id = auth.uid()
    or not public.profile_is_banned(auth.uid())
  );

drop policy if exists profiles_no_update_while_banned on public.profiles;
create policy profiles_no_update_while_banned
  on public.profiles
  as restrictive
  for update
  to authenticated
  using (public.actor_may_write())
  with check (public.actor_may_write());

drop policy if exists freelancer_hide_banned on public.freelancer_profiles;
create policy freelancer_hide_banned
  on public.freelancer_profiles
  as restrictive
  for select
  to anon, authenticated
  using (
    user_id = auth.uid()
    or public.viewer_is_admin()
    or not public.profile_is_banned(user_id)
  );

drop policy if exists public_profile_media_hide_banned on public.public_profile_media;
create policy public_profile_media_hide_banned
  on public.public_profile_media
  as restrictive
  for select
  to anon, authenticated
  using (
    user_id = auth.uid()
    or public.viewer_is_admin()
    or not public.profile_is_banned(user_id)
  );

drop policy if exists profile_posts_hide_banned on public.profile_posts;
create policy profile_posts_hide_banned
  on public.profile_posts
  as restrictive
  for select
  to anon, authenticated
  using (
    author_id = auth.uid()
    or public.viewer_is_admin()
    or not public.profile_is_banned(author_id)
  );

drop policy if exists profile_posts_no_insert_while_banned on public.profile_posts;
create policy profile_posts_no_insert_while_banned
  on public.profile_posts
  as restrictive
  for insert
  to authenticated
  with check (public.actor_may_write());

drop policy if exists community_posts_hide_banned on public.community_posts;
create policy community_posts_hide_banned
  on public.community_posts
  as restrictive
  for select
  to anon, authenticated
  using (
    author_id = auth.uid()
    or public.viewer_is_admin()
    or not public.profile_is_banned(author_id)
  );

drop policy if exists community_posts_no_insert_while_banned on public.community_posts;
create policy community_posts_no_insert_while_banned
  on public.community_posts
  as restrictive
  for insert
  to authenticated
  with check (public.actor_may_write());

drop policy if exists profile_post_comments_hide_banned on public.profile_post_comments;
create policy profile_post_comments_hide_banned
  on public.profile_post_comments
  as restrictive
  for select
  to anon, authenticated
  using (
    author_id = auth.uid()
    or public.viewer_is_admin()
    or not public.profile_is_banned(author_id)
  );

drop policy if exists profile_post_comments_no_insert_while_banned on public.profile_post_comments;
create policy profile_post_comments_no_insert_while_banned
  on public.profile_post_comments
  as restrictive
  for insert
  to authenticated
  with check (public.actor_may_write());

drop policy if exists community_post_comments_hide_banned on public.community_post_comments;
create policy community_post_comments_hide_banned
  on public.community_post_comments
  as restrictive
  for select
  to anon, authenticated
  using (
    author_id = auth.uid()
    or public.viewer_is_admin()
    or not public.profile_is_banned(author_id)
  );

drop policy if exists community_post_comments_no_insert_while_banned on public.community_post_comments;
create policy community_post_comments_no_insert_while_banned
  on public.community_post_comments
  as restrictive
  for insert
  to authenticated
  with check (public.actor_may_write());

drop policy if exists job_request_comments_hide_banned on public.job_request_comments;
create policy job_request_comments_hide_banned
  on public.job_request_comments
  as restrictive
  for select
  to anon, authenticated
  using (
    author_id = auth.uid()
    or public.viewer_is_admin()
    or not public.profile_is_banned(author_id)
  );

drop policy if exists job_request_comments_no_insert_while_banned on public.job_request_comments;
create policy job_request_comments_no_insert_while_banned
  on public.job_request_comments
  as restrictive
  for insert
  to authenticated
  with check (public.actor_may_write());

drop policy if exists job_requests_no_insert_while_banned on public.job_requests;
create policy job_requests_no_insert_while_banned
  on public.job_requests
  as restrictive
  for insert
  to authenticated
  with check (public.actor_may_write());

-- Messages: a banned member cannot take part, and nobody else can open a thread with them.
-- Admins who are already in the thread can still read it.
drop policy if exists "conversations_select_participants" on public.conversations;
create policy "conversations_select_participants"
  on public.conversations
  for select
  using (
    (auth.uid() = client_id or auth.uid() = freelancer_id)
    and (
      public.viewer_is_admin()
      or (
        not public.profile_is_banned(auth.uid())
        and not public.profile_is_banned(client_id)
        and not public.profile_is_banned(freelancer_id)
      )
    )
  );

drop policy if exists "conversations_insert_participants" on public.conversations;
create policy "conversations_insert_participants"
  on public.conversations
  for insert
  with check (
    (auth.uid() = client_id or auth.uid() = freelancer_id)
    and public.actor_may_write()
    and (
      public.viewer_is_admin()
      or (
        not public.profile_is_banned(client_id)
        and not public.profile_is_banned(freelancer_id)
      )
    )
  );

drop policy if exists "messages_select_participants" on public.messages;
create policy "messages_select_participants"
  on public.messages
  for select
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.client_id or auth.uid() = c.freelancer_id)
        and (
          public.viewer_is_admin()
          or (
            not public.profile_is_banned(auth.uid())
            and not public.profile_is_banned(c.client_id)
            and not public.profile_is_banned(c.freelancer_id)
          )
        )
    )
  );

drop policy if exists "messages_insert_participants" on public.messages;
create policy "messages_insert_participants"
  on public.messages
  for insert
  with check (
    public.actor_may_write()
    and exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.client_id or auth.uid() = c.freelancer_id)
        and (
          public.viewer_is_admin()
          or (
            not public.profile_is_banned(c.client_id)
            and not public.profile_is_banned(c.freelancer_id)
          )
        )
    )
  );

drop policy if exists "messages_update_participants" on public.messages;
create policy "messages_update_participants"
  on public.messages
  for update
  using (
    public.actor_may_write()
    and exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.client_id or auth.uid() = c.freelancer_id)
        and (
          public.viewer_is_admin()
          or (
            not public.profile_is_banned(c.client_id)
            and not public.profile_is_banned(c.freelancer_id)
          )
        )
    )
  )
  with check (
    public.actor_may_write()
    and exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.client_id or auth.uid() = c.freelancer_id)
    )
  );

-- Helper search bypasses RLS. Drop banned members from the results.
create or replace function public.get_helpers_near_location(
  search_lat double precision,
  search_lng double precision,
  radius_km double precision,
  search_query text default '',
  viewer_city_norm text default '',
  geocode_matched_place boolean default false
)
returns table (
  id uuid,
  full_name text,
  photo_url text,
  city text,
  location_lat double precision,
  location_lng double precision,
  service_radius double precision,
  average_rating double precision,
  total_ratings integer,
  role text,
  is_available_for_jobs boolean,
  freelancer_profiles jsonb,
  distance_km double precision,
  whatsapp_contact_available boolean,
  telegram_contact_available boolean,
  is_verified boolean,
  avg_reply_seconds float,
  reply_sample_count int,
  live_help_week_count int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  found_ids uuid[];
begin
  -- 1. Identify relevant helpers based on location/query
  with filtered_profiles as (
    select
      p.id,
      (
        case
          when p.location_lat is not null and p.location_lng is not null then
            6371 * acos(
              least(1.0, greatest(-1.0,
                cos(radians(search_lat)) * cos(radians(p.location_lat)) *
                cos(radians(p.location_lng) - radians(search_lng)) +
                sin(radians(search_lat)) * sin(radians(p.location_lat))
              ))
            )
          else null
        end
      )::double precision as dist_km
    from profiles p
    where (p.role = 'freelancer' or (p.role = 'client' and p.is_available_for_jobs = true))
      and coalesce(p.is_admin, false) is false
      and not public.profile_is_banned(p.id)
  )
  select array_agg(f.id) into found_ids
  from filtered_profiles f
  join profiles p on p.id = f.id
  where
    case
      when f.dist_km is not null then
        f.dist_km <= radius_km
        and (
          search_query = ''
          or geocode_matched_place = true
          or lower(p.full_name) like '%' || lower(search_query) || '%'
          or lower(p.city) like '%' || lower(search_query) || '%'
        )
      else
        (
          search_query != ''
          and (
            lower(p.full_name) like '%' || lower(search_query) || '%'
            or lower(p.city) like '%' || lower(search_query) || '%'
          )
        )
        or
        (
          search_query = ''
          and viewer_city_norm != ''
          and lower(regexp_replace(trim(p.city), '\s+', ' ', 'g')) = viewer_city_norm
        )
    end;

  if found_ids is null or array_length(found_ids, 1) = 0 then
    return;
  end if;

  -- 2. Return enriched data for the found helpers
  return query
  with stats as (
    select s.helper_id, s.avg_seconds, s.sample_count
    from public.get_helper_chat_response_stats(found_ids) s
  ),
  week_counts as (
    select w.helper_id, w.live_help_week_count
    from public.get_helpers_live_help_week_counts(found_ids) w
  )
  select
    p.id,
    p.full_name,
    p.photo_url,
    p.city,
    (p.location_lat)::double precision,
    (p.location_lng)::double precision,
    (p.service_radius)::double precision,
    (p.average_rating)::double precision,
    p.total_ratings,
    (p.role)::text,
    p.is_available_for_jobs,
    jsonb_build_object(
      'hourly_rate_min', fp.hourly_rate_min,
      'hourly_rate_max', fp.hourly_rate_max,
      'bio', coalesce(fp.bio, p.bio),
      'available_now', fp.available_now,
      'live_until', fp.live_until,
      'live_categories', coalesce(fp.live_categories, '{}'::text[]),
      'live_can_start_in', fp.live_can_start_in
    ) as freelancer_profiles,
    (
      case
        when p.location_lat is not null and p.location_lng is not null then
          6371 * acos(
            least(1.0, greatest(-1.0,
              cos(radians(search_lat)) * cos(radians(p.location_lat)) *
              cos(radians(p.location_lng) - radians(search_lng)) +
              sin(radians(search_lat)) * sin(radians(p.location_lat))
            ))
          )
        else null
      end
    )::double precision as distance_km,
    (
      p.share_whatsapp is true
      and p.whatsapp_number_e164 is not null
      and length(trim(p.whatsapp_number_e164)) > 0
    ) as whatsapp_contact_available,
    (
      p.share_telegram is true
      and p.telegram_username is not null
      and length(trim(p.telegram_username)) > 0
    ) as telegram_contact_available,
    coalesce(p.is_verified, false) as is_verified,
    s.avg_seconds::float as avg_reply_seconds,
    s.sample_count::int as reply_sample_count,
    coalesce(w.live_help_week_count, 0)::int as live_help_week_count
  from profiles p
  left join freelancer_profiles fp on p.id = fp.user_id
  left join stats s on s.helper_id = p.id
  left join week_counts w on w.helper_id = p.id
  where p.id = any(found_ids)
  order by
    case
      when p.location_lat is not null and p.location_lng is not null then
        6371 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(search_lat)) * cos(radians(p.location_lat)) *
            cos(radians(p.location_lng) - radians(search_lng)) +
            sin(radians(search_lat)) * sin(radians(p.location_lat))
          ))
        )
      else 999999
    end asc
  limit 100;
end;
$$;


-- Open help requests bypass RLS.
create or replace function public.get_discover_open_help_requests(p_limit int default 8)
returns table (
  id uuid,
  service_type text,
  location_city text,
  location_lat float,
  location_lng float,
  start_at timestamptz,
  created_at timestamptz,
  shift_hours text,
  time_duration text,
  care_type text,
  care_frequency text,
  client_photo_url text,
  client_display_name text,
  client_id uuid,
  status text,
  client_average_rating float,
  client_total_ratings int,
  is_verified boolean,
  client_avg_reply_seconds float,
  client_reply_sample_count int,
  service_details jsonb,
  notes text,
  when_timeframe text,
  custom_when_at timestamptz,
  budget_min int,
  budget_max int,
  budget_rate_type text,
  ai_generated_copy jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  with base_requests as (
    select
      jr.id,
      jr.service_type,
      jr.location_city,
      jr.location_lat,
      jr.location_lng,
      jr.start_at,
      jr.created_at,
      jr.shift_hours,
      jr.time_duration,
      jr.care_type,
      jr.care_frequency,
      jr.client_id,
      jr.status::text as status,
      jr.service_details,
      jr.notes,
      jr.when_timeframe,
      jr.custom_when_at,
      jr.budget_min,
      jr.budget_max,
      jr.budget_rate_type,
      jr.ai_generated_copy
    from public.job_requests jr
    where jr.status::text in ('ready', 'notifying', 'confirmations_closed')
      and jr.community_post_id is null
    order by jr.created_at desc
    limit greatest(1, least(coalesce(p_limit, 8), 500))
  ),
  stats as (
    select
      client_id,
      avg_seconds,
      sample_count
    from public.get_client_chat_response_stats(
      (select array_agg(distinct client_id) from base_requests)
    )
  )
  select
    br.id,
    br.service_type,
    br.location_city,
    br.location_lat,
    br.location_lng,
    br.start_at,
    br.created_at,
    br.shift_hours,
    br.time_duration,
    br.care_type,
    br.care_frequency,
    p.photo_url as client_photo_url,
    left(coalesce(nullif(trim(p.full_name), ''), 'Member'), 48) as client_display_name,
    br.client_id,
    br.status,
    (p.average_rating)::float,
    p.total_ratings,
    coalesce(p.is_verified, false),
    s.avg_seconds::float,
    s.sample_count::int,
    br.service_details,
    br.notes,
    br.when_timeframe,
    br.custom_when_at,
    br.budget_min,
    br.budget_max,
    br.budget_rate_type,
    br.ai_generated_copy
  from base_requests br
  inner join public.profiles p on p.id = br.client_id
  left join stats s on s.client_id = br.client_id
  where coalesce(p.is_admin, false) is false
    and not public.profile_is_banned(br.client_id);
$$;


-- One shared help request bypasses RLS.
create or replace function public.get_discover_open_help_request_by_id(p_id uuid)
returns table (
  id uuid,
  service_type text,
  location_city text,
  location_lat float,
  location_lng float,
  start_at timestamptz,
  created_at timestamptz,
  shift_hours text,
  time_duration text,
  care_type text,
  care_frequency text,
  client_photo_url text,
  client_display_name text,
  client_id uuid,
  status text,
  client_average_rating float,
  client_total_ratings int,
  is_verified boolean,
  client_avg_reply_seconds float,
  client_reply_sample_count int,
  service_details jsonb,
  notes text,
  when_timeframe text,
  custom_when_at timestamptz,
  budget_min int,
  budget_max int,
  budget_rate_type text,
  ai_generated_copy jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  with base_requests as (
    select
      jr.id,
      jr.service_type,
      jr.location_city,
      jr.location_lat,
      jr.location_lng,
      jr.start_at,
      jr.created_at,
      jr.shift_hours,
      jr.time_duration,
      jr.care_type,
      jr.care_frequency,
      jr.client_id,
      jr.status::text as status,
      jr.service_details,
      jr.notes,
      jr.when_timeframe,
      jr.custom_when_at,
      jr.budget_min,
      jr.budget_max,
      jr.budget_rate_type,
      jr.ai_generated_copy
    from public.job_requests jr
    where jr.id = p_id
      and jr.status::text in ('ready', 'notifying', 'confirmations_closed')
      and jr.community_post_id is null
    limit 1
  ),
  stats as (
    select
      client_id,
      avg_seconds,
      sample_count
    from public.get_client_chat_response_stats(
      (select array_agg(distinct client_id) from base_requests)
    )
  )
  select
    br.id,
    br.service_type,
    br.location_city,
    br.location_lat,
    br.location_lng,
    br.start_at,
    br.created_at,
    br.shift_hours,
    br.time_duration,
    br.care_type,
    br.care_frequency,
    p.photo_url as client_photo_url,
    left(coalesce(nullif(trim(p.full_name), ''), 'Member'), 48) as client_display_name,
    br.client_id,
    br.status,
    (p.average_rating)::float,
    p.total_ratings,
    coalesce(p.is_verified, false),
    s.avg_seconds::float,
    s.sample_count::int,
    br.service_details,
    br.notes,
    br.when_timeframe,
    br.custom_when_at,
    br.budget_min,
    br.budget_max,
    br.budget_rate_type,
    br.ai_generated_copy
  from base_requests br
  inner join public.profiles p on p.id = br.client_id
  left join stats s on s.client_id = br.client_id
  where coalesce(p.is_admin, false) is false
    and not public.profile_is_banned(br.client_id);
$$;


-- Community feed bypasses RLS.
create or replace function public.get_community_feed_public(
  p_category text default null,
  p_limit int default 400
)
returns table (
  id uuid,
  author_id uuid,
  category text,
  title text,
  body text,
  note text,
  created_at timestamptz,
  expires_at timestamptz,
  availability_payload jsonb,
  author_full_name text,
  author_photo_url text,
  author_city text,
  author_role text,
  author_is_verified boolean,
  author_average_rating numeric,
  author_total_ratings int
)
language sql
security definer
set search_path = public
stable
as $$
  select
    cp.id,
    cp.author_id,
    cp.category,
    cp.title,
    cp.body,
    cp.note,
    cp.created_at,
    cp.expires_at,
    cp.availability_payload,
    p.full_name,
    p.photo_url,
    p.city,
    p.role::text,
    coalesce(p.is_verified, false),
    coalesce(round(p.average_rating::numeric, 2), 0)::numeric,
    coalesce(p.total_ratings, 0)::int
  from public.community_posts cp
  inner join public.profiles p on p.id = cp.author_id
  where cp.status = 'active'
    and cp.expires_at > now()
    and not public.profile_is_banned(cp.author_id)
    and (
      p_category is null
      or trim(p_category) = ''
      or cp.category = p_category
    )
  order by cp.expires_at asc
  limit greatest(1, least(coalesce(nullif(p_limit, 0), 400), 800));
$$;


-- Nearby requests bypass RLS.
create or replace function public.get_job_requests_near_location(
  search_lat double precision,
  search_lng double precision,
  radius_km double precision,
  service_filters text[] default null,
  viewer_id uuid default null,
  p_limit int default 200
)
returns table (
  id uuid,
  client_id uuid,
  service_type text,
  location_city text,
  location_lat double precision,
  location_lng double precision,
  start_at timestamptz,
  created_at timestamptz,
  shift_hours text,
  time_duration text,
  care_frequency text,
  service_details jsonb,
  notes text,
  requirements text[],
  languages_pref text[],
  budget_min int,
  budget_max int,
  client_display_name text,
  client_photo_url text,
  distance_km double precision,
  client_is_verified boolean,
  client_posted_requests_count bigint,
  open_accept_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with base as (
    select
      jr.id,
      jr.client_id,
      jr.service_type::text,
      jr.location_city,
      coalesce(jr.location_lat, p.location_lat)::double precision as location_lat,
      coalesce(jr.location_lng, p.location_lng)::double precision as location_lng,
      jr.start_at,
      jr.created_at,
      jr.shift_hours,
      jr.time_duration,
      jr.care_frequency,
      coalesce(jr.service_details::jsonb, '{}'::jsonb) as service_details,
      jr.notes,
      jr.requirements,
      jr.languages_pref,
      jr.budget_min,
      jr.budget_max,
      left(coalesce(nullif(trim(p.full_name), ''), 'Member'), 48) as client_display_name,
      p.photo_url as client_photo_url,
      (
        case
          when coalesce(jr.location_lat, p.location_lat) is not null
            and coalesce(jr.location_lng, p.location_lng) is not null then
            6371 * acos(
              least(1.0, greatest(-1.0,
                cos(radians(search_lat)) * cos(radians(coalesce(jr.location_lat, p.location_lat))) *
                cos(radians(coalesce(jr.location_lng, p.location_lng)) - radians(search_lng)) +
                sin(radians(search_lat)) * sin(radians(coalesce(jr.location_lat, p.location_lat)))
              ))
            )
          else null
        end
      )::double precision as distance_km,
      coalesce(p.is_verified, false) as client_is_verified,
      (
        select count(*)::bigint
        from public.job_requests jposted
        where jposted.client_id = jr.client_id
      ) as client_posted_requests_count,
      (
        select count(*)::bigint
        from public.job_confirmations jc
        where jc.job_id = jr.id
          and jc.status = 'available'
      ) as open_accept_count
    from public.job_requests jr
    inner join public.profiles p on p.id = jr.client_id
    where jr.status::text in ('ready', 'notifying', 'confirmations_closed')
      and jr.community_post_id is null
      and not public.profile_is_banned(jr.client_id)
      and (viewer_id is null or jr.client_id <> viewer_id)
      and (
        service_filters is null
        or array_length(service_filters, 1) is null
        or jr.service_type::text = any(service_filters)
      )
  ),
  filtered as (
    select *
    from base
    where (distance_km is null or distance_km <= greatest(0, radius_km))
      and (
        viewer_id is null
        or (
          not exists (
            select 1
            from public.job_confirmations jc
            where jc.job_id = base.id
              and jc.freelancer_id = viewer_id
              and jc.status in ('available', 'declined')
          )
        )
      )
  )
  select *
  from filtered
  order by distance_km asc nulls last, created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 500));
$$;


-- Saved requests bypass RLS.
-- Drop first: CREATE OR REPLACE cannot change an existing OUT-row type.
drop function if exists public.get_saved_open_help_requests();
create or replace function public.get_saved_open_help_requests()
returns table (
  id uuid,
  client_id uuid,
  service_type text,
  location_city text,
  start_at timestamptz,
  created_at timestamptz,
  shift_hours text,
  time_duration text,
  care_type text,
  care_frequency text,
  service_details jsonb,
  notes text,
  when_timeframe text,
  custom_when_at timestamptz,
  budget_min int,
  budget_max int,
  budget_rate_type text,
  status text,
  client_display_name text,
  client_photo_url text,
  ai_generated_copy jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select
    jr.id,
    jr.client_id,
    coalesce(nullif(trim(jr.service_type::text), ''), 'other_help') as service_type,
    jr.location_city,
    jr.start_at,
    jr.created_at,
    jr.shift_hours::text as shift_hours,
    jr.time_duration::text as time_duration,
    jr.care_type::text as care_type,
    jr.care_frequency::text as care_frequency,
    coalesce(jr.service_details::jsonb, '{}'::jsonb) as service_details,
    jr.notes,
    jr.when_timeframe::text as when_timeframe,
    jr.custom_when_at,
    jr.budget_min,
    jr.budget_max,
    jr.budget_rate_type::text as budget_rate_type,
    jr.status::text as status,
    left(coalesce(nullif(trim(p.full_name), ''), 'Member'), 64) as client_display_name,
    p.photo_url as client_photo_url,
    jr.ai_generated_copy
  from public.job_request_favorites jrf
  inner join public.job_requests jr on jr.id = jrf.job_id
  inner join public.profiles p on p.id = jr.client_id
  where jrf.user_id = auth.uid()
    and not public.profile_is_banned(jr.client_id)
  order by jrf.created_at desc;
$$;

grant execute on function public.get_saved_open_help_requests() to authenticated;

drop function if exists public.get_discover_posted_help_requests_public(integer);
create or replace function public.get_discover_posted_help_requests_public(p_limit int default 12)
returns table (
  job_id uuid,
  community_post_id uuid,
  service_type text,
  location_city text,
  time_duration text,
  shift_hours text,
  created_at timestamptz,
  client_id uuid,
  author_full_name text,
  author_photo_url text,
  author_average_rating numeric,
  author_total_ratings int
)
language sql
security definer
set search_path = public
stable
as $$
  select
    jr.id as job_id,
    jr.community_post_id,
    coalesce(nullif(trim(jr.service_type::text), ''), 'other_help')::text as service_type,
    jr.location_city,
    jr.time_duration::text as time_duration,
    jr.shift_hours::text as shift_hours,
    jr.created_at,
    jr.client_id,
    left(coalesce(nullif(trim(p.full_name), ''), 'Member'), 64) as author_full_name,
    p.photo_url as author_photo_url,
    coalesce(p.average_rating, 0)::numeric as author_average_rating,
    coalesce(p.total_ratings, 0)::int as author_total_ratings
  from public.job_requests jr
  inner join public.profiles p on p.id = jr.client_id
  where jr.status::text in ('ready', 'notifying', 'confirmations_closed')
    and (auth.uid() is null or jr.client_id <> auth.uid())
    and not public.profile_is_banned(jr.client_id)
  order by (jr.community_post_id is not null) desc, jr.created_at desc
  limit greatest(1, least(coalesce(p_limit, 12), 50));
$$;

grant execute on function public.get_discover_posted_help_requests_public(integer) to anon, authenticated;

drop function if exists public.get_job_request_public_summary_for_match(uuid);
create or replace function public.get_job_request_public_summary_for_match(p_job_id uuid)
returns table (
  id uuid,
  client_id uuid,
  service_type text,
  location_city text,
  location_lat double precision,
  location_lng double precision,
  start_at timestamptz,
  created_at timestamptz,
  shift_hours text,
  time_duration text,
  care_frequency text,
  service_details jsonb,
  notes text,
  budget_min int,
  budget_max int
)
language sql
security definer
set search_path = public
stable
as $$
  select
    jr.id,
    jr.client_id,
    coalesce(nullif(trim(jr.service_type::text), ''), 'other_help') as service_type,
    jr.location_city,
    coalesce(jr.location_lat::double precision, p.location_lat::double precision) as location_lat,
    coalesce(jr.location_lng::double precision, p.location_lng::double precision) as location_lng,
    jr.start_at,
    jr.created_at,
    jr.shift_hours,
    jr.time_duration,
    jr.care_frequency,
    coalesce(jr.service_details::jsonb, '{}'::jsonb) as service_details,
    jr.notes,
    jr.budget_min,
    jr.budget_max
  from public.job_requests jr
  inner join public.profiles p on p.id = jr.client_id
  where jr.id = p_job_id
    and jr.status::text in ('ready', 'notifying', 'confirmations_closed')
    and not public.profile_is_banned(jr.client_id);
$$;

grant execute on function public.get_job_request_public_summary_for_match(uuid) to anon, authenticated;

drop function if exists public.get_public_profile_client_job_requests(uuid);
create or replace function public.get_public_profile_client_job_requests(p_client_id uuid)
returns table (
  id uuid,
  service_type text,
  status text,
  created_at timestamptz,
  location_city text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    jr.id,
    coalesce(nullif(trim(jr.service_type), ''), nullif(trim(jr.care_type), ''), 'other_help')::text as service_type,
    jr.status::text,
    jr.created_at,
    jr.location_city
  from public.job_requests jr
  where jr.client_id = p_client_id
    and jr.status::text not in ('draft', 'completed', 'cancelled')
    and not public.profile_is_banned(jr.client_id)
  order by jr.created_at desc
  limit 40;
$$;

grant execute on function public.get_public_profile_client_job_requests(uuid) to anon, authenticated;

drop function if exists public.get_public_job_request_preview(uuid);
create or replace function public.get_public_job_request_preview(p_job_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select (to_jsonb(jr) || jsonb_build_object('profiles', to_jsonb(p)))
  from public.job_requests jr
  inner join public.profiles p on p.id = jr.client_id
  where jr.id = p_job_id
    and jr.status::text not in ('draft', 'cancelled')
    and not public.profile_is_banned(jr.client_id)
  limit 1;
$$;

grant execute on function public.get_public_job_request_preview(uuid) to anon, authenticated;
