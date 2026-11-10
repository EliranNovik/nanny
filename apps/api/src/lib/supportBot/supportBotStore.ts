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
