-- 028_ensure_job_stage_enum_values.sql
-- Ensure all job_stage enum values exist
-- This migration safely adds any missing enum values

do $$ 
declare
  enum_type_oid oid;
begin
  -- Get the enum type OID
  select oid into enum_type_oid from pg_type where typname = 'job_stage';
  
  -- Only proceed if the enum type exists
  if enum_type_oid is not null then
    -- Check and add 'Request' if it doesn't exist
    if not exists (
      select 1 from pg_enum 
      where enumlabel = 'Request' 
      and enumtypid = enum_type_oid
    ) then
      alter type public.job_stage add value 'Request';
    end if;

    -- Check and add 'Price Offer' if it doesn't exist
    if not exists (
      select 1 from pg_enum 
      where enumlabel = 'Price Offer' 
      and enumtypid = enum_type_oid
    ) then
      -- Try to add before 'Schedule' if it exists, otherwise add at end
      if exists (
        select 1 from pg_enum 
        where enumlabel = 'Schedule' 
        and enumtypid = enum_type_oid
      ) then
        alter type public.job_stage add value 'Price Offer' before 'Schedule';
      else
        alter type public.job_stage add value 'Price Offer';
      end if;
    end if;

    -- Check and add 'Schedule' if it doesn't exist
    if not exists (
      select 1 from pg_enum 
      where enumlabel = 'Schedule' 
      and enumtypid = enum_type_oid
    ) then
      alter type public.job_stage add value 'Schedule';
    end if;

    -- Check and add 'Job in Progress' if it doesn't exist
    if not exists (
      select 1 from pg_enum 
      where enumlabel = 'Job in Progress' 
      and enumtypid = enum_type_oid
    ) then
      alter type public.job_stage add value 'Job in Progress';
    end if;

    -- Check and add 'Job Ended' if it doesn't exist
    if not exists (
      select 1 from pg_enum 
      where enumlabel = 'Job Ended' 
      and enumtypid = enum_type_oid
    ) then
      alter type public.job_stage add value 'Job Ended';
    end if;

    -- Check and add 'Payment' if it doesn't exist
    if not exists (
      select 1 from pg_enum 
      where enumlabel = 'Payment' 
      and enumtypid = enum_type_oid
    ) then
      -- Try to add before 'Completed' if it exists
      if exists (
        select 1 from pg_enum 
        where enumlabel = 'Completed' 
        and enumtypid = enum_type_oid
      ) then
        alter type public.job_stage add value 'Payment' before 'Completed';
      else
        alter type public.job_stage add value 'Payment';
      end if;
    end if;

    -- Check and add 'Completed' if it doesn't exist
    if not exists (
      select 1 from pg_enum 
      where enumlabel = 'Completed' 
      and enumtypid = enum_type_oid
    ) then
      alter type public.job_stage add value 'Completed';
    end if;
  end if;
end $$;

-- Update comment
comment on type public.job_stage is 'Job progression stages: Request, Price Offer, Schedule, Job in Progress, Job Ended, Payment, Completed';
