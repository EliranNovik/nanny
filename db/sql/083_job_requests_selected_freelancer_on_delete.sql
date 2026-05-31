-- Allow profile / auth user deletion when a freelancer is still referenced
-- as job_requests.selected_freelancer_id. Clear the pointer instead of blocking.

alter table public.job_requests
  drop constraint if exists job_requests_selected_freelancer_id_fkey;

alter table public.job_requests
  add constraint job_requests_selected_freelancer_id_fkey
  foreign key (selected_freelancer_id)
  references public.profiles (id)
  on delete set null;
