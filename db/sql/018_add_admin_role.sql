-- 018_add_admin_role.sql
-- Add 'admin' role to user_role enum

-- First, alter the enum type to add 'admin'
alter type public.user_role add value if not exists 'admin';

-- Note: You may need to manually update a user's role to 'admin' in Supabase dashboard
-- Example SQL to set a user as admin:
-- update public.profiles set role = 'admin' where id = 'your-user-id';

