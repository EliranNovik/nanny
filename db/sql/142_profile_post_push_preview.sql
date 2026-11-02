-- Show the post type in favorite-profile push titles and use the post's
-- free-text caption as the notification preview.

create or replace function public.push_on_profile_post_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fav record;
  author_name text;
  post_type_label text;
  post_preview text;
begin
  select coalesce(full_name, 'Someone you follow') into author_name
  from public.profiles where id = new.author_id;

  post_type_label := case new.post_type_id
    when 'offer_service' then 'Offer'
    when 'event' then 'Event'
    else 'Community'
  end;

  -- A concise preview gives iOS and Android enough text for roughly two rows.
  post_preview := nullif(
    left(regexp_replace(trim(coalesce(new.caption, '')), '\s+', ' ', 'g'), 180),
    ''
  );

  for fav in
    select user_id
    from public.profile_favorites
    where favorite_user_id = new.author_id
      and user_id <> new.author_id
  loop
    perform public.enqueue_push_notification(
      fav.user_id,
      'favorite_profile_post',
      post_type_label || ' · ' || author_name,
      coalesce(
        post_preview,
        case new.post_type_id
          when 'offer_service' then 'Posted new offer'
          when 'event' then 'Posted new event'
          else 'Posted for the community'
        end
      ),
      jsonb_build_object(
        'type', 'favorite_profile_post',
        'post_id', new.id,
        'author_id', new.author_id,
        'post_type', new.post_type_id,
        'link', '/profile/' || new.author_id::text
      ),
      'favorite_post:' || new.id::text || ':' || fav.user_id::text
    );
  end loop;

  return new;
end;
$$;
