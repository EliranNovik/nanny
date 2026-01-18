-- 022_add_payment_to_enum.sql
-- Add 'Payment' value to job_stage enum if it doesn't exist

do $$ 
begin
  -- Check if 'Payment' already exists in the enum
  if not exists (
    select 1 
    from pg_enum 
    where enumlabel = 'Payment' 
    and enumtypid = (select oid from pg_type where typname = 'job_stage')
  ) then
    -- Add 'Payment' before 'Completed' (PostgreSQL 9.1+)
    -- If your PostgreSQL version doesn't support BEFORE, remove "before 'Completed'" 
    -- and it will add at the end
    alter type public.job_stage add value 'Payment' before 'Completed';
  end if;
end $$;

-- Add comment
comment on type public.job_stage is 'Job progression stages: Request, Price Offer, Schedule, Job in Progress, Job Ended, Payment, Completed';
