-- 019_admin_reports.sql
-- Support admin reports via conversations

-- Make job_id nullable in conversations to support admin reports
alter table public.conversations 
  alter column job_id drop not null;

-- Drop the unique constraint on job_id (since we need to allow nulls and multiple admin conversations)
-- Find and drop the unique constraint dynamically
do $$ 
declare
  constraint_name text;
begin
  -- Find the unique constraint on job_id column
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.conversations'::regclass
    and contype = 'u'
    and array_length(conkey, 1) = 1
    and (
      select attname 
      from pg_attribute 
      where attrelid = conrelid 
        and attnum = conkey[1]
    ) = 'job_id';
  
  -- Drop the constraint if found
  if constraint_name is not null then
    execute format('alter table public.conversations drop constraint %I', constraint_name);
  end if;
end $$;

-- Add a partial unique index to maintain one conversation per job (only for non-null job_id)
-- This ensures regular job conversations are still unique, while allowing multiple admin conversations
create unique index if not exists idx_conversations_job_unique 
  on public.conversations(job_id) 
  where job_id is not null;

-- Add index for admin conversations (where job_id is null)
create index if not exists idx_conversations_admin on public.conversations(client_id, freelancer_id) where job_id is null;

-- Note: For admin reports, we'll use:
-- - client_id: the user reporting
-- - freelancer_id: the admin user
-- - job_id: null (or reference to a special admin job if needed)

