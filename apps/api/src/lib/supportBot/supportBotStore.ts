import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "../../supabase";

type StoreError = { code?: string; message?: string } | null;

const CLAIM_OWNER = randomUUID();
const CLAIM_STALE_MS = 5 * 60_000;
let claimsUnavailable = false;

const memoryEscalated = new Set<string>();
const memoryBotMessages = new Set<string>();
const memoryReports = new Set<string>();
let persistenceDisabled = false;

function missingTable(error: StoreError): boolean {
  if (!error) return false;
  // A missing column (handoff_at is not applied yet) must not disable the bot.
  if (error.code === "42703" || error.code === "PGRST204") return false;
  const message = error.message ?? "";
  if (/\bcolumn\b/i.test(message)) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (/support_bot_/i.test(message) &&
      /does not exist|schema cache|could not find the table/i.test(message))
  );
}

function noteMissingTable(error: StoreError): void {
  if (!missingTable(error) || persistenceDisabled) return;
  persistenceDisabled = true;
  console.warn(
    "[SupportBot] State tables are missing. Run db/sql/149_support_bot.sql. Using in-memory state until the API restarts.",
  );
}

export async function isSupportThreadEscalated(
  conversationId: string,
): Promise<boolean> {
  if (memoryEscalated.has(conversationId) || persistenceDisabled) {
    return memoryEscalated.has(conversationId);
  }
  const { data, error } = await supabaseAdmin
    .from("support_bot_threads")
    .select("status")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (error) {
    noteMissingTable(error);
    return memoryEscalated.has(conversationId);
  }
  return data?.status === "escalated";
}

/** The bot moved this chat to the Tebnu admins. A later human reply clears it from the waiting list. */
export async function markSupportHandoff(conversationId: string): Promise<void> {
  memoryEscalated.add(conversationId);
  if (persistenceDisabled) return;
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("support_bot_threads").upsert(
    {
      conversation_id: conversationId,
      status: "escalated",
      handoff_at: now,
      updated_at: now,
    },
    { onConflict: "conversation_id" },
  );
  if (error) {
    noteMissingTable(error);
    console.error("[SupportBot] Handoff mark failed:", error.message);
  }
}

export async function escalateSupportThread(
  conversationId: string,
): Promise<void> {
  memoryEscalated.add(conversationId);
  if (persistenceDisabled) return;
  const { error } = await supabaseAdmin.from("support_bot_threads").upsert(
    {
      conversation_id: conversationId,
      status: "escalated",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id" },
  );
  if (error) noteMissingTable(error);
}

/** An admin pause ends on its own after this long with no messages in the chat. */
export const AI_PAUSE_IDLE_MS = 24 * 60 * 60 * 1000;
let aiPauseColumnMissing = false;

/**
 * True while an admin has switched the bot off in this chat. `before` is the
 * time of the first unanswered message: activity is measured up to it, so a
 * person writing again after a quiet day gets the bot back.
 */
export async function isAiPaused(conversationId: string, before: string): Promise<boolean> {
  if (persistenceDisabled || aiPauseColumnMissing) return false;
  const { data, error } = await supabaseAdmin
    .from("support_bot_threads")
    .select("ai_paused_at")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (error) {
    if (error.code === "42703" || /ai_paused_at/i.test(error.message ?? "")) {
      aiPauseColumnMissing = true;
      console.warn(
        "[SupportBot] ai_paused_at is missing. Run db/sql/158_support_bot_ai_pause.sql; until then the AI switch in chats has no effect.",
      );
    } else {
      noteMissingTable(error);
    }
    return false;
  }
  const pausedAt = data?.ai_paused_at as string | null | undefined;
  if (!pausedAt) return false;

  const { data: last } = await supabaseAdmin
    .from("messages")
    .select("created_at")
    .eq("conversation_id", conversationId)
    .lt("created_at", before)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastActivity = Math.max(
    Date.parse(pausedAt),
    last?.created_at ? Date.parse(last.created_at as string) : 0,
  );
  if (Date.parse(before) - lastActivity < AI_PAUSE_IDLE_MS) return true;

  await supabaseAdmin
    .from("support_bot_threads")
    .update({ ai_paused_at: null, updated_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("ai_paused_at", pausedAt);
  console.log("[SupportBot] AI back on after a quiet day", { conversationId });
  return false;
}

/**
 * While the bot is on, hand-typed messages at or before this time are not a new
 * takeover. The switch sets this when an admin turns the bot back on, so those
 * older messages do not immediately switch it off again.
 * Infinity means the bot is already paused.
 * null means every hand-typed message still counts.
 */
export async function supportTakeoverCutoff(conversationId: string): Promise<number | null> {
  if (persistenceDisabled || aiPauseColumnMissing) return null;
  const { data, error } = await supabaseAdmin
    .from("support_bot_threads")
    .select("ai_paused_at, updated_at")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (error) {
    if (error.code === "42703" || /ai_paused_at/i.test(error.message ?? "")) {
      aiPauseColumnMissing = true;
    } else {
      noteMissingTable(error);
    }
    return null;
  }
  if (!data) return null;
  if (data.ai_paused_at) return Number.POSITIVE_INFINITY;
  const updated = Date.parse(String(data.updated_at ?? ""));
  return Number.isFinite(updated) ? updated : null;
}

/** An admin turned the bot back on, or asked it to follow up. */
export async function resumeSupportAi(conversationId: string): Promise<void> {
  if (persistenceDisabled || aiPauseColumnMissing) return;
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("support_bot_threads").upsert(
    {
      conversation_id: conversationId,
      ai_paused_at: null,
      updated_at: now,
    },
    { onConflict: "conversation_id" },
  );
  if (error) {
    if (error.code === "42703" || /ai_paused_at/i.test(error.message ?? "")) {
      aiPauseColumnMissing = true;
    } else {
      noteMissingTable(error);
    }
  }
}

/** An admin typed in this chat, so the bot steps back until the chat goes quiet for a day. */
export async function pauseSupportAi(conversationId: string): Promise<void> {
  if (persistenceDisabled || aiPauseColumnMissing) return;
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("support_bot_threads").upsert(
    {
      conversation_id: conversationId,
      ai_paused_at: now,
      updated_at: now,
    },
    { onConflict: "conversation_id" },
  );
  if (error) {
    if (error.code === "42703" || /ai_paused_at/i.test(error.message ?? "")) {
      aiPauseColumnMissing = true;
    } else {
      noteMissingTable(error);
    }
  }
}

export async function isBotMessage(messageId: string): Promise<boolean> {
  if (memoryBotMessages.has(messageId) || persistenceDisabled) {
    return memoryBotMessages.has(messageId);
  }
  const { data, error } = await supabaseAdmin
    .from("support_bot_messages")
    .select("message_id")
    .eq("message_id", messageId)
    .maybeSingle();
  if (error) {
    noteMissingTable(error);
    return memoryBotMessages.has(messageId);
  }
  return Boolean(data?.message_id);
}

const DEFAULT_DAILY_CAP = 20;
let dailyCapCache: { value: number; at: number } | null = null;
let settingsTableMissing = false;

/** Messages the bot may write to one person per UTC day. 0 means no limit. */
export async function dailyMessageCap(): Promise<number> {
  if (settingsTableMissing) return DEFAULT_DAILY_CAP;
  if (dailyCapCache && Date.now() - dailyCapCache.at < 30_000) return dailyCapCache.value;
  const { data, error } = await supabaseAdmin
    .from("support_bot_settings")
    .select("daily_message_cap")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      settingsTableMissing = true;
      console.warn(
        "[SupportBot] support_bot_settings is missing. Run db/sql/160_support_bot_daily_cap.sql. Using a cap of 20 until then.",
      );
    }
    return dailyCapCache?.value ?? DEFAULT_DAILY_CAP;
  }
  const parsed = Number(data?.daily_message_cap ?? DEFAULT_DAILY_CAP);
  const value = Number.isFinite(parsed) ? Math.max(0, Math.min(500, Math.floor(parsed))) : DEFAULT_DAILY_CAP;
  dailyCapCache = { value, at: Date.now() };
  return value;
}

/** Bot messages already written in this chat since the start of the UTC day. */
export async function botMessagesSentToday(conversationId: string): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { count, error } = await supabaseAdmin
    .from("support_bot_messages")
    .select("message_id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .gte("created_at", start.toISOString());
  if (error) {
    noteMissingTable(error);
    return 0;
  }
  return count ?? 0;
}

export async function rememberBotMessage(
  messageId: string,
  conversationId: string,
): Promise<void> {
  memoryBotMessages.add(messageId);
  if (persistenceDisabled) return;
  const { error } = await supabaseAdmin.from("support_bot_messages").insert({
    message_id: messageId,
    conversation_id: conversationId,
  });
  if (error && error.code !== "23505") noteMissingTable(error);
}

export async function wasReportHandled(reportId: string): Promise<boolean> {
  if (memoryReports.has(reportId) || persistenceDisabled) {
    return memoryReports.has(reportId);
  }
  const { data, error } = await supabaseAdmin
    .from("support_bot_reports")
    .select("report_id")
    .eq("report_id", reportId)
    .maybeSingle();
  if (error) {
    noteMissingTable(error);
    return memoryReports.has(reportId);
  }
  return Boolean(data?.report_id);
}

/**
 * Take exclusive ownership of a piece of bot work across every running API.
 * Returns false when another server already holds it. A claim older than
 * CLAIM_STALE_MS is treated as abandoned (that server crashed mid-reply).
 */
export async function claimSupportWork(key: string): Promise<boolean> {
  if (claimsUnavailable) return true;
  const { error } = await supabaseAdmin
    .from("support_bot_claims")
    .insert({ key, owner: CLAIM_OWNER });
  if (!error) return true;
  if (error.code !== "23505") {
    if (error.code === "42P01" || error.code === "PGRST205") {
      claimsUnavailable = true;
      console.warn(
        "[SupportBot] support_bot_claims is missing. Run db/sql/156_support_bot_claims.sql; until then two running APIs can both reply.",
      );
    } else {
      console.error("[SupportBot] Claim failed:", error.message);
    }
    return true;
  }
  const { data } = await supabaseAdmin
    .from("support_bot_claims")
    .update({ owner: CLAIM_OWNER, claimed_at: new Date().toISOString() })
    .eq("key", key)
    .lt("claimed_at", new Date(Date.now() - CLAIM_STALE_MS).toISOString())
    .select("key");
  return (data?.length ?? 0) > 0;
}

/** Give work back after a failed reply so a later tick (on any server) can retry it. */
export async function releaseSupportWork(key: string): Promise<void> {
  if (claimsUnavailable) return;
  await supabaseAdmin
    .from("support_bot_claims")
    .delete()
    .eq("key", key)
    .eq("owner", CLAIM_OWNER);
}

export async function rememberReport(
  reportId: string,
  conversationId: string | null,
): Promise<void> {
  memoryReports.add(reportId);
  if (persistenceDisabled) return;
  const { error } = await supabaseAdmin.from("support_bot_reports").insert({
    report_id: reportId,
    conversation_id: conversationId,
  });
  if (error && error.code !== "23505") noteMissingTable(error);
}
