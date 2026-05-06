-- Enable Realtime for messages and conversations
-- This allows the frontend to subscribe to changes and update the UI instantly.

-- 1. Ensure the supabase_realtime publication exists
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- 2. Add tables to the publication
-- We use a do block to avoid errors if the table is already in the publication
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.conversations;
exception
  when duplicate_object then null;
end $$;

-- 3. Set replica identity to FULL for messages to ensure we get all data in the payload (optional but recommended for some realtime logic)
alter table public.messages replica identity full;
alter table public.conversations replica identity full;
