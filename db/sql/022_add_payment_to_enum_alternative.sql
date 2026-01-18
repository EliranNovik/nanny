-- 022_add_payment_to_enum_alternative.sql
-- Alternative version that works in all PostgreSQL versions
-- Use this if the main migration fails with a "BEFORE" syntax error

do $$ 
begin
  -- Check if 'Payment' already exists in the enum
  if not exists (
    select 1 
    from pg_enum 
    where enumlabel = 'Payment' 
    and enumtypid = (select oid from pg_type where typname = 'job_stage')
  ) then
    -- Add 'Payment' at the end (works in all PostgreSQL versions)
    alter type public.job_stage add value 'Payment';
  end if;
end $$;

-- Add comment
comment on type public.job_stage is 'Job progression stages: Request, Price Offer, Schedule, Job in Progress, Job Ended, Payment, Completed';
