-- 008_add_message_attachments.sql
-- Add attachment support to messages table

-- Add attachment columns to messages table
alter table public.messages 
  add column if not exists attachment_url text,
  add column if not exists attachment_type text, -- 'image', 'file', 'video', etc.
  add column if not exists attachment_name text,
  add column if not exists attachment_size bigint; -- size in bytes

-- Create index for attachment queries
create index if not exists idx_messages_attachments on public.messages(conversation_id, attachment_url) where attachment_url is not null;

-- Add comments
comment on column public.messages.attachment_url is 'URL to the attachment file in storage';
comment on column public.messages.attachment_type is 'Type of attachment: image, file, video, etc.';
comment on column public.messages.attachment_name is 'Original filename of the attachment';
comment on column public.messages.attachment_size is 'Size of attachment in bytes';

-- Note: Make body nullable since messages can be attachment-only
alter table public.messages 
  alter column body drop not null;

-- Add constraint: message must have either body or attachment
alter table public.messages 
  add constraint messages_body_or_attachment check (
    (body is not null and body != '') or attachment_url is not null
  );

