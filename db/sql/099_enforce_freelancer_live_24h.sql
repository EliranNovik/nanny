-- Cap go-live windows to 24 hours and clear expired live_until on write.
create or replace function public.enforce_freelancer_live_24h_window()
returns trigger
language plpgsql
as $$
begin
  if new.live_until is not null then
    if new.live_until <= now() then
      new.live_until := null;
      new.live_categories := '{}'::text[];
    elsif new.live_until > now() + interval '24 hours' then
      new.live_until := now() + interval '24 hours';
    end if;
  end if;

  if new.live_until is null and tg_op = 'UPDATE' and old.live_until is not null and old.live_until <= now() then
    new.available_now := false;
  end if;

  return new;
end;
$$;

drop trigger if exists freelancer_profiles_live_24h_window on public.freelancer_profiles;

create trigger freelancer_profiles_live_24h_window
  before insert or update on public.freelancer_profiles
  for each row
  execute function public.enforce_freelancer_live_24h_window();

-- One-time cleanup for rows with stale or over-long live windows.
update public.freelancer_profiles
set
  live_until = null,
  live_categories = '{}'::text[],
  available_now = false
where live_until is not null
  and live_until <= now();

update public.freelancer_profiles
set live_until = now() + interval '24 hours'
where live_until is not null
  and live_until > now() + interval '24 hours';
