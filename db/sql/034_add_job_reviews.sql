-- 034_add_job_reviews.sql
-- Creates a job_reviews table for storing star ratings and optional review text.
-- A trigger keeps average_rating / total_ratings on profiles in sync.

-- 1. Table
create table if not exists public.job_reviews (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references public.job_requests(id) on delete cascade,
  reviewer_id     uuid not null references public.profiles(id) on delete cascade,
  reviewee_id     uuid not null references public.profiles(id) on delete cascade,
  rating          smallint not null check (rating between 1 and 5),
  review_text     text,
  created_at      timestamptz not null default now(),
  unique (job_id, reviewer_id)          -- one review per job per reviewer
);

-- 2. Add average_rating / total_ratings to profiles (if they don't exist)
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'profiles' and column_name = 'average_rating'
  ) then
    alter table public.profiles add column average_rating numeric(3,2) default 0;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'profiles' and column_name = 'total_ratings'
  ) then
    alter table public.profiles add column total_ratings int default 0;
  end if;
end $$;

-- 3. Function + trigger to recalculate the reviewee's aggregate
create or replace function public.recalculate_profile_rating()
returns trigger language plpgsql security definer as $$
declare
  v_avg  numeric(3,2);
  v_cnt  int;
  v_id   uuid;
begin
  -- after insert/delete/update find the affected reviewee
  if tg_op = 'DELETE' then
    v_id := old.reviewee_id;
  else
    v_id := new.reviewee_id;
  end if;

  select
    round(avg(rating)::numeric, 2),
    count(*)
  into v_avg, v_cnt
  from public.job_reviews
  where reviewee_id = v_id;

  -- update profiles
  update public.profiles
  set
    average_rating = coalesce(v_avg, 0),
    total_ratings  = coalesce(v_cnt, 0)
  where id = v_id;

  -- also update freelancer_profiles if the reviewee is a freelancer
  update public.freelancer_profiles
  set
    rating_avg   = coalesce(v_avg, 0),
    rating_count = coalesce(v_cnt, 0)
  where user_id = v_id;

  return new;
end;
$$;

drop trigger if exists trg_recalculate_profile_rating on public.job_reviews;
create trigger trg_recalculate_profile_rating
  after insert or update or delete on public.job_reviews
  for each row execute function public.recalculate_profile_rating();

-- 4. RLS
alter table public.job_reviews enable row level security;

-- Anyone can view reviews
create policy "job_reviews_select" on public.job_reviews
  for select using (true);

-- Only the reviewer can insert their own review
create policy "job_reviews_insert" on public.job_reviews
  for insert with check (reviewer_id = auth.uid());

-- Reviewer can update their own review
create policy "job_reviews_update" on public.job_reviews
  for update using (reviewer_id = auth.uid());
