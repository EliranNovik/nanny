-- Tebnu Support bot: allow "rules" entries in Admin → AI Bot.
-- Rules are hard limits: what the bot must not say or do. Run after 154_support_bot_knowledge.sql.

alter table public.support_bot_knowledge
  drop constraint if exists support_bot_knowledge_kind_check;

alter table public.support_bot_knowledge
  add constraint support_bot_knowledge_kind_check
  check (kind in ('behavior', 'knowledge', 'rules'));
