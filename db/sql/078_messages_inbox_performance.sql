-- 078_messages_inbox_performance.sql
-- Faster Messages inbox: composite indexes + single RPC replacing N×2 round-trips per contact.
-- Safe to re-run (IF NOT EXISTS / OR REPLACE).

-- ── Conversations: inbox lists by participant + recency ──
create index if not exists idx_conversations_client_created
  on public.conversations (client_id, created_at desc);

create index if not exists idx_conversations_freelancer_created
  on public.conversations (freelancer_id, created_at desc);

-- ── Unread counts: filter by conversation + sender + read_at null ──
create index if not exists idx_messages_conversation_sender_unread
  on public.messages (conversation_id, sender_id)
  where read_at is null;

-- ── One inbox row per counterparty: latest activity + summed unread ──
create or replace function public.get_messages_inbox_preview(p_user_id uuid)
returns table (
  other_user_id uuid,
  conversation_id uuid,
  job_id uuid,
  client_id uuid,
  freelancer_id uuid,
  created_at timestamptz,
  last_body text,
  last_created_at timestamptz,
  last_sender_id uuid,
  last_read_at timestamptz,
  last_read_by uuid,
  last_attachment_type text,
  last_attachment_name text,
  unread_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with conv as (
    select
      c.id,
      c.job_id,
      c.client_id,
      c.freelancer_id,
      c.created_at as conversation_created_at,
      case
        when c.client_id = p_user_id then c.freelancer_id
        else c.client_id
      end as other_id
    from (
      select *
      from public.conversations c
      where
        p_user_id = auth.uid()
        and (c.client_id = p_user_id or c.freelancer_id = p_user_id)
      order by c.created_at desc
      limit 500
    ) c
  ),
  lm as (
    select distinct on (m.conversation_id)
      m.conversation_id,
      m.body,
      m.created_at,
      m.sender_id,
      m.read_at,
      m.read_by,
      m.attachment_type,
      m.attachment_name
    from public.messages m
    inner join conv on conv.id = m.conversation_id
    order by m.conversation_id, m.created_at desc
  ),
  uc as (
    select
      m.conversation_id,
      count(*)::bigint as cnt
    from public.messages m
    inner join conv on conv.id = m.conversation_id
    where m.sender_id = conv.other_id
      and m.read_at is null
    group by m.conversation_id
  ),
  enriched as (
    select
      conv.other_id as other_user_id,
      conv.id as conversation_id,
      conv.job_id,
      conv.client_id,
      conv.freelancer_id,
      conv.conversation_created_at,
      lm.body as last_body,
      lm.created_at as last_created_at,
      lm.sender_id as last_sender_id,
      lm.read_at as last_read_at,
      lm.read_by as last_read_by,
      lm.attachment_type as last_attachment_type,
      lm.attachment_name as last_attachment_name,
      coalesce(uc.cnt, 0)::bigint as conv_unread,
      coalesce(lm.created_at, conv.conversation_created_at) as sort_ts
    from conv
    left join lm on lm.conversation_id = conv.id
    left join uc on uc.conversation_id = conv.id
  ),
  per_other as (
    select
      e.other_user_id,
      sum(e.conv_unread)::bigint as unread_count
    from enriched e
    group by e.other_user_id
  ),
  picked as (
    select distinct on (e.other_user_id)
      e.other_user_id,
      e.conversation_id,
      e.job_id,
      e.client_id,
      e.freelancer_id,
      e.conversation_created_at as created_at,
      e.last_body,
      e.last_created_at,
      e.last_sender_id,
      e.last_read_at,
      e.last_read_by,
      e.last_attachment_type,
      e.last_attachment_name,
      p.unread_count
    from enriched e
    inner join per_other p on p.other_user_id = e.other_user_id
    order by e.other_user_id, e.sort_ts desc nulls last, e.conversation_id desc
  )
  select *
  from picked
  order by coalesce(last_created_at, created_at) desc nulls last;
$$;

comment on function public.get_messages_inbox_preview(uuid) is
  'Messages inbox: one row per counterparty (latest thread + summed unread). Replaces batched per-user message queries.';

grant execute on function public.get_messages_inbox_preview(uuid) to authenticated;
