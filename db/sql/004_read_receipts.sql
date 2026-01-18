-- Add read receipt columns to messages table
alter table public.messages 
  add column if not exists read_at timestamptz,
  add column if not exists read_by uuid references public.profiles(id) on delete set null;

-- Create index for read status queries
create index if not exists idx_messages_read_status on public.messages(conversation_id, read_at);

-- Add comment
comment on column public.messages.read_at is 'Timestamp when message was read by recipient';
comment on column public.messages.read_by is 'User ID who read the message';

