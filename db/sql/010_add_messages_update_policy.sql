-- 010_add_messages_update_policy.sql
-- Add UPDATE policy for messages to allow marking messages as read

-- Allow participants to update messages (for marking as read)
create policy "messages_update_participants"
on public.messages for update
using (
  auth.uid() in (
    select client_id from public.conversations c where c.id = conversation_id
    union
    select freelancer_id from public.conversations c where c.id = conversation_id
  )
)
with check (
  auth.uid() in (
    select client_id from public.conversations c where c.id = conversation_id
    union
    select freelancer_id from public.conversations c where c.id = conversation_id
  )
);

-- Note: This policy allows participants to update any message in their conversations
-- The application logic ensures only read_at and read_by fields are updated
-- and only for messages sent by the other participant

