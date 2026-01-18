-- 003_policies.sql
-- RLS Policies for Nanny Marketplace

-- PROFILES
create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = id);

create policy "profiles_insert_own"
on public.profiles for insert
with check (auth.uid() = id);

-- Allow reading other profiles for displaying freelancer cards
create policy "profiles_select_public"
on public.profiles for select
using (true);

-- FREELANCER PROFILES
create policy "freelancer_select_public"
on public.freelancer_profiles for select
using (true);

create policy "freelancer_upsert_own"
on public.freelancer_profiles for insert
with check (auth.uid() = user_id);

create policy "freelancer_update_own"
on public.freelancer_profiles for update
using (auth.uid() = user_id);

-- JOB REQUESTS
create policy "job_requests_select_own_client_or_selected_freelancer"
on public.job_requests for select
using (
  auth.uid() = client_id
  or auth.uid() = selected_freelancer_id
);

create policy "job_requests_insert_client_only"
on public.job_requests for insert
with check (auth.uid() = client_id);

create policy "job_requests_update_client_only"
on public.job_requests for update
using (auth.uid() = client_id);

-- CANDIDATE NOTIFICATIONS
create policy "candidate_notifications_select_own"
on public.job_candidate_notifications for select
using (auth.uid() = freelancer_id);

create policy "candidate_notifications_update_own"
on public.job_candidate_notifications for update
using (auth.uid() = freelancer_id);

-- CONFIRMATIONS
create policy "confirmations_select_own_or_client"
on public.job_confirmations for select
using (
  auth.uid() = freelancer_id
  or auth.uid() in (select client_id from public.job_requests where id = job_id)
);

create policy "confirmations_insert_freelancer"
on public.job_confirmations for insert
with check (auth.uid() = freelancer_id);

create policy "confirmations_update_freelancer"
on public.job_confirmations for update
using (auth.uid() = freelancer_id);

-- CONVERSATIONS
create policy "conversations_select_participants"
on public.conversations for select
using (auth.uid() = client_id or auth.uid() = freelancer_id);

create policy "conversations_insert_participants"
on public.conversations for insert
with check (auth.uid() = client_id or auth.uid() = freelancer_id);

-- MESSAGES
create policy "messages_select_participants"
on public.messages for select
using (
  auth.uid() in (
    select client_id from public.conversations c where c.id = conversation_id
    union
    select freelancer_id from public.conversations c where c.id = conversation_id
  )
);

create policy "messages_insert_participants"
on public.messages for insert
with check (
  auth.uid() in (
    select client_id from public.conversations c where c.id = conversation_id
    union
    select freelancer_id from public.conversations c where c.id = conversation_id
  )
);

