import { supabaseAdmin } from "../../supabase";
import { supportBotConfigured } from "../supportBot/env";
import { scanProfileTexts } from "./scanProfileText";
import { reviewConversation } from "./reviewPost";

const LOOKBACK_MS = 6 * 60 * 60 * 1000;
const MAX_CONVERSATIONS = 4;
const MAX_MESSAGES = 16;

type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
};

const failures = new Map<string, number>();
const SCAN_MS = 60_000;
let scanTimer: ReturnType<typeof setInterval> | null = null;
let scanInFlight = false;

/** Review recent chats on its own timer, even when the support bot is off. */
export function startChatQualityScan(): void {
  if (scanTimer) return;
  if (!supportBotConfigured()) {
    console.warn("[QualityChat] Not started — OPENAI_API_KEY is missing");
    return;
  }
  console.log("[QualityChat] Watching recent chats");
  void runScan();
  scanTimer = setInterval(() => {
    void runScan();
  }, SCAN_MS);
}

async function runScan(): Promise<void> {
  if (scanInFlight) return;
  scanInFlight = true;
  try {
    const { data, error } = await supabaseAdmin.from("profiles").select("id").eq("is_admin", true);
    if (error) throw error;
    const admins = new Set((data ?? []).map((row) => row.id as string));
    try {
      await scanRecentChats(admins);
    } catch (err) {
      console.error("[QualityChat] Scan failed:", err instanceof Error ? err.message : err);
    }
    await scanProfileTexts(admins);
  } catch (err) {
    console.error("[QualityChat] Scan failed:", err instanceof Error ? err.message : err);
  } finally {
    scanInFlight = false;
  }
}

function isSystemNotice(body: string): boolean {
  return /^\[(USER BLOCK|POST REPORT|USER REPORT|REQUEST REPORT|PROFILE REPORT)\]/i.test(
    body.trim(),
  );
}

async function markScanned(conversationId: string, newestId: string): Promise<void> {
  await supabaseAdmin.from("quality_chat_scans").upsert({
    conversation_id: conversationId,
    last_message_id: newestId,
    scanned_at: new Date().toISOString(),
  });
}

function excerptOf(lines: string[]): string {
  return lines.join("\n").slice(0, 280);
}

/** Review recent chats with the post quality manager and keep the ones that fail. */
export async function scanRecentChats(adminIds: Set<string>): Promise<void> {
  const since = new Date(Date.now() - LOOKBACK_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(120);
  if (error || !data?.length) return;

  const newest = new Map<string, ChatMessage>();
  for (const row of data as ChatMessage[]) {
    if (!newest.has(row.conversation_id)) newest.set(row.conversation_id, row);
  }

  const ids = [...newest.keys()];
  const { data: scans } = await supabaseAdmin
    .from("quality_chat_scans")
    .select("conversation_id, last_message_id")
    .in("conversation_id", ids);
  const scanned = new Map(
    (scans ?? []).map((row) => [row.conversation_id as string, row.last_message_id as string | null]),
  );

  const pending = [...newest.values()]
    .filter((row) => scanned.get(row.conversation_id) !== row.id)
    .filter((row) => (failures.get(row.conversation_id) ?? 0) < 2)
    .slice(0, MAX_CONVERSATIONS);

  for (const head of pending) {
    try {
      await reviewOne(head.conversation_id, head.id, adminIds);
      failures.delete(head.conversation_id);
    } catch (err) {
      const attempts = (failures.get(head.conversation_id) ?? 0) + 1;
      failures.set(head.conversation_id, attempts);
      if (attempts >= 2) await markScanned(head.conversation_id, head.id);
      console.error(
        "[QualityChat] Review failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }
}

async function reviewOne(
  conversationId: string,
  newestId: string,
  adminIds: Set<string>,
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(MAX_MESSAGES);
  if (error) throw error;

  const rows = ((data ?? []) as ChatMessage[]).slice().reverse();
  const speakers = new Map<string, "A" | "B">();
  const lines: string[] = [];
  for (const row of rows) {
    const body = (row.body ?? "").replace(/^[\u200b\u2060]+/, "").trim();
    if (!body || isSystemNotice(body)) continue;
    if (adminIds.has(row.sender_id)) continue;
    let label = speakers.get(row.sender_id);
    if (!label) {
      if (speakers.size >= 2) continue;
      label = speakers.size === 0 ? "A" : "B";
      speakers.set(row.sender_id, label);
    }
    lines.push(`${label}: ${body.slice(0, 400)}`);
  }

  if (lines.length === 0) {
    await markScanned(conversationId, newestId);
    return;
  }

  const review = await reviewConversation({ transcript: lines.join("\n") });
  if (review.decision === "allow" || review.reasons.length === 0) {
    await markScanned(conversationId, newestId);
    return;
  }

  const speakerId = [...speakers.entries()].find(([, label]) => label === review.speaker)?.[0]
    ?? [...speakers.keys()][0];
  if (!speakerId || adminIds.has(speakerId)) return;

  const row = {
    conversation_id: conversationId,
    user_id: speakerId,
    message_id: newestId,
    summary: review.summary || review.reasons[0]?.detail || "Flagged in chat",
    excerpt: excerptOf(lines),
    reasons: review.reasons,
    outcome: review.decision,
    dismissed_at: null,
  };

  const { data: open } = await supabaseAdmin
    .from("quality_chat_flags")
    .select("id")
    .eq("conversation_id", conversationId)
    .is("dismissed_at", null)
    .maybeSingle();

  const write = open?.id
    ? await supabaseAdmin.from("quality_chat_flags").update(row).eq("id", open.id)
    : await supabaseAdmin.from("quality_chat_flags").insert(row);
  if (write.error) throw new Error(write.error.message);
  await markScanned(conversationId, newestId);
}
