-- ============================================================
-- 089_add_post_types.sql
-- Support categories/badges for profile posts
-- Run in Supabase SQL Editor
-- ============================================================

-- Create the new table for post types
create table if not exists public.post_types (
  id          text primary key,
  name        text not null,
  emoji       text not null,
  color       text not null,
  created_at  timestamptz not null default now()
);

-- Enable RLS
alter table public.post_types enable row level security;

-- Allow anyone to read post types
drop policy if exists "post_types_read" on public.post_types;
create policy "post_types_read" on public.post_types
  for select using (true);

-- Add columns to profile_posts table
alter table public.profile_posts
  add column if not exists post_type_id text references public.post_types(id) on delete set null,
  add column if not exists post_metadata jsonb default '{}'::jsonb;

-- Seed the initial post types
insert into public.post_types (id, name, emoji, color) values
  ('request_help', 'Request Help', '🔴', 'red'),
  ('offer_service', 'Offer Service', '🟢', 'green'),
  ('community', 'Community', '🔵', 'blue'),
  ('event', 'Event', '🟣', 'purple')
on conflict (id) do update set
  name = excluded.name,
  emoji = excluded.emoji,
  color = excluded.color;
