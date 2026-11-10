import { supabaseAdmin } from "../../supabase";
import { classifyInboundHint } from "./classifyInbound";
import { supportBotConfigured } from "./env";
import { SupportBotError } from "./openaiClient";
import { decideSupportReply } from "./supportAgent";
import type { SupportTranscriptTurn } from "./supportAgent";
import {
  escalateSupportThread,
  isBotMessage,
  markSupportHandoff,
  rememberBotMessage,
  rememberReport,
  wasReportHandled,
} from "./supportBotStore";
import { beginSupportTyping, endSupportTyping } from "./supportTyping";

const TICK_MS = 1_000;
const BATCH_QUIET_MS = 2_500;
const HISTORY_LIMIT = 16;
const LOOKBACK_MS = 30 * 60 * 1000;
/** Invisible mark so the admin chat can tell a bot reply from a message typed by hand. */
const AI_SENT_MARK = "\u200b\u200b\u200b";
/** Same AI mark, plus a word joiner, only on a handoff to the Tebnu team. */
const HANDOFF_MARK = `${AI_SENT_MARK}\u2060`;

type ConversationRow = {
  id: string;
  job_id: string | null;
  client_id: string;
  freelancer_id: string;
};

type MessageRow = {
  id: string;
  body: string | null;
  sender_id: string;
  created_at: string;
  conversation_id: string;
  attachment_url?: string | null;
  attachment_type?: string | null;
};

function isImageAttachment(row: MessageRow): boolean {
  const type = row.attachment_type ?? "";
  return Boolean(row.attachment_url) && (type === "image" || type.startsWith("image/"));
}

function messageHasContent(row: MessageRow): boolean {
  return Boolean(row.body?.trim()) || isImageAttachment(row);
}

type ReportRow = {
  id: string;
  post_id: string | null;
  job_request_id: string | null;
  reporter_id: string;
  reason: string;
  details: string | null;
  created_at: string;
};

let timer: ReturnType<typeof setInterval> | null = null;
let tickInFlight = false;
let tickQueued = false;
let inboundWatchStarted = false;
const supportCache = new Map<string, { adminId: string; userId: string } | null>();
let watermark = new Date(Date.now() - LOOKBACK_MS).toISOString();
let adminIds = new Set<string>();
let adminIdsLoadedAt = 0;
const failures = new Map<string, number>();

function lookbackStart(): string {
  const rolling = new Date(Date.now() - LOOKBACK_MS).toISOString();
  return rolling > watermark ? rolling : watermark;
}

function otherParticipant(conversation: ConversationRow, adminId: string): string | null {
  if (conversation.client_id === adminId) return conversation.freelancer_id;
  if (conversation.freelancer_id === adminId) return conversation.client_id;
  return null;
}

async function loadAdminIds(): Promise<Set<string>> {
  if (adminIds.size > 0 && Date.now() - adminIdsLoadedAt < 60_000) return adminIds;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("is_admin", true);
  if (error) throw error;
  adminIds = new Set((data ?? []).map((row) => row.id as string));
  adminIdsLoadedAt = Date.now();
  return adminIds;
}

async function supportConversation(
  conversationId: string,
  admins: Set<string>,
): Promise<{ conversation: ConversationRow; adminId: string; userId: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .select("id, job_id, client_id, freelancer_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw error;
  const conversation = data as ConversationRow | null;
  if (!conversation) return null;
  const adminId = [conversation.client_id, conversation.freelancer_id].find((id) =>
    admins.has(id),
  );
  if (!adminId) return null;
  const userId = otherParticipant(conversation, adminId);
  if (!userId || admins.has(userId)) return null;
  return { conversation, adminId, userId };
}

async function findOrCreateSupportConversation(
  userId: string,
  adminId: string,
): Promise<string | null> {
  const existing = await supabaseAdmin
    .from("conversations")
    .select("id, client_id, freelancer_id")
    .is("job_id", null)
    .or(
      `and(client_id.eq.${userId},freelancer_id.eq.${adminId}),and(client_id.eq.${adminId},freelancer_id.eq.${userId})`,
    )
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.id) return existing.data.id as string;

  const created = await supabaseAdmin
    .from("conversations")
    .insert({
      job_id: null,
      client_id: userId,
      freelancer_id: adminId,
    })
    .select("id")
    .single();
  if (created.error) throw created.error;
  return (created.data?.id as string) ?? null;
}

async function recentHistory(
  conversationId: string,
  adminId: string,
  excludeIds: Set<string>,
): Promise<SupportTranscriptTurn[]> {
  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("id, sender_id, body, attachment_url, attachment_type")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw error;
  return (data ?? [])
    .slice()
    .reverse()
    .filter(
      (row) =>
        !excludeIds.has(row.id as string) &&
        (typeof row.body === "string" && row.body.trim() ||
          isImageAttachment(row as MessageRow)),
    )
    .map((row) => ({
      role: row.sender_id === adminId ? "assistant" : "user",
      body: String(row.body ?? "").replace(/^\u200b\u200b\u200b/, "").trim() || "[photo]",
    }));
}

async function sendAsSupport(
  conversationId: string,
  adminId: string,
  body: string,
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: adminId,
      body: body.startsWith(AI_SENT_MARK) ? body : `${AI_SENT_MARK}${body}`,
    })
    .select("id")
    .single();
  if (error) throw error;
  if (data?.id) await rememberBotMessage(data.id as string, conversationId);
}

function withoutWebsitePages(reply: string): string {
  return reply
    .replace(/[ \t]*\[[^\]\n]*\]\(https?:\/\/[^)\s]*\)[ \t]*/gi, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\bwww\.\S+/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function latestClientPlatform(
  userId: string,
): Promise<"ios" | "android" | "web" | "unknown"> {
  const { data, error } = await supabaseAdmin
    .from("push_device_tokens")
    .select("platform")
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.platform) return "unknown";
  if (data.platform === "ios" || data.platform === "android" || data.platform === "web") {
    return data.platform;
  }
  return "unknown";
}

function chatAttachmentPath(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const marker = "/chat-attachments/";
    const index = pathname.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}

/** Load a chat photo so the model can see it, even if the bucket is not public. */
async function photoForModel(url: string): Promise<string | null> {
  const path = chatAttachmentPath(url);
  if (path) {
    const { data, error } = await supabaseAdmin.storage.from("chat-attachments").download(path);
    if (!error && data) {
      const bytes = Buffer.from(await data.arrayBuffer());
      if (bytes.byteLength > 0 && bytes.byteLength <= 6_000_000) {
        const mime = data.type?.startsWith("image/") ? data.type : "image/jpeg";
        return `data:${mime};base64,${bytes.toString("base64")}`;
      }
    }
  }
  return url.startsWith("https://") ? url : null;
}

async function photosFromMessages(rows: MessageRow[]): Promise<string[]> {
  const urls = rows.filter(isImageAttachment).map((row) => row.attachment_url as string).slice(0, 2);
  const photos: string[] = [];
  for (const url of urls) {
    const photo = await photoForModel(url);
    if (photo) photos.push(photo);
  }
  return photos;
}

function replyForClient(reply: string, client: "ios" | "android" | "web" | "unknown"): string {
  return client === "ios" ? withoutWebsitePages(reply) : reply;
}

/** Tips stay in the first bubble. Each template is the next bubble, so a copy is only the post text. */
async function sendTemplateBubbles(
  conversationId: string,
  adminId: string,
  templates: string[],
  client: "ios" | "android" | "web" | "unknown",
): Promise<void> {
  for (const template of templates) {
    const text = replyForClient(template, client).trim();
    if (!text) continue;
    await sendAsSupport(conversationId, adminId, text);
  }
}

async function replyToUserMessages(
  conversationId: string,
  pending: MessageRow[],
  adminId: string,
): Promise<void> {
  const newest = pending[pending.length - 1];
  if (!newest || !messageHasContent(newest)) return;
  beginSupportTyping(conversationId, adminId);
  if (Date.now() - Date.parse(newest.created_at) < BATCH_QUIET_MS) return;

  try {
  const history = await recentHistory(
    conversationId,
    adminId,
    new Set(pending.map((message) => message.id)),
  );
  const latestText = pending
    .map((message) => {
      const caption = message.body?.trim() ?? "";
      return isImageAttachment(message)
        ? [caption, "[photo attached]"].filter(Boolean).join("\n")
        : caption;
    })
    .filter(Boolean)
    .join("\n");
  const hint = pending.some((message) => classifyInboundHint(message.body ?? "") === "auto_report")
    ? "auto_report"
    : "user_message";
  const client = await latestClientPlatform(pending[pending.length - 1].sender_id);
  const images = await photosFromMessages(pending);

  const decision = await decideSupportReply({
    history: history.filter((turn) => turn.body.trim() !== latestText),
    latestText,
    hint,
    client,
    images,
  });

  if (decision.reply) {
    const text = replyForClient(decision.reply, client);
    const reply = decision.escalate
      ? `${HANDOFF_MARK}${text}`
      : text;
    await sendAsSupport(conversationId, adminId, reply);
  }
  await sendTemplateBubbles(conversationId, adminId, decision.templates, client);
  if (decision.escalate) {
    await markSupportHandoff(conversationId);
  }
  for (const message of pending) {
    await rememberBotMessage(message.id, conversationId);
  }
    console.log("[SupportBot] Replied", {
    conversationId,
    kind: decision.kind,
    action: decision.action,
    client,
  });
  } finally {
    await endSupportTyping(conversationId, adminId);
  }
}

async function handleIncomingMessages(admins: Set<string>): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("id, body, sender_id, created_at, conversation_id, attachment_url, attachment_type")
    .gte("created_at", lookbackStart())
    .order("created_at", { ascending: true })
    .limit(80);
  if (error) throw error;

  const byConversation = new Map<string, MessageRow[]>();
  for (const row of (data ?? []) as MessageRow[]) {
    const bucket = byConversation.get(row.conversation_id) ?? [];
    bucket.push(row);
    byConversation.set(row.conversation_id, bucket);
  }

  for (const [conversationId, rows] of byConversation) {
    const support = await supportConversation(conversationId, admins);
    if (!support) continue;

    let humanTookOver = false;
    for (const row of rows) {
      if (row.sender_id !== support.adminId) continue;
      // Bot replies carry an invisible mark. A missing handoff column must not
      // make those look like a person typed and silence the next answer.
      if (row.body?.startsWith(AI_SENT_MARK)) continue;
      if (await isBotMessage(row.id)) continue;
      humanTookOver = true;
    }
    const fromUser = rows.filter(
      (row) => row.sender_id === support.userId && messageHasContent(row),
    );
    if (humanTookOver) {
      await endSupportTyping(conversationId, support.adminId);
      await escalateSupportThread(conversationId);
      for (const row of fromUser) {
        await rememberBotMessage(row.id, conversationId);
      }
      continue;
    }

    const pending: MessageRow[] = [];
    for (const row of fromUser) {
      if (await isBotMessage(row.id)) continue;
      pending.push(row);
    }
    if (pending.length === 0) continue;

    const key = `msg:${conversationId}:${pending[pending.length - 1].id}`;
    if ((failures.get(key) ?? 0) >= 3) {
      await endSupportTyping(conversationId, support.adminId);
      continue;
    }
    try {
      await replyToUserMessages(conversationId, pending, support.adminId);
      failures.delete(key);
    } catch (err) {
      failures.set(key, (failures.get(key) ?? 0) + 1);
      const message = err instanceof SupportBotError ? err.message : "Support reply failed";
      console.error("[SupportBot] Message reply failed:", message);
    }
  }
}

function reportText(report: ReportRow): string {
  const target = report.post_id
    ? `post ${report.post_id}`
    : report.job_request_id
      ? `request ${report.job_request_id}`
      : "an item";
  const details = report.details?.trim();
  return [
    "Automatic report",
    `Target: ${target}`,
    `Reason: ${report.reason}`,
    details ? `Details: ${details}` : "Details: none yet",
  ].join("\n");
}

async function handleAutomaticReports(admins: Set<string>): Promise<void> {
  const adminId = [...admins][0];
  if (!adminId) return;

  const { data, error } = await supabaseAdmin
    .from("profile_post_reports")
    .select("id, post_id, job_request_id, reporter_id, reason, details, created_at")
    .gte("created_at", lookbackStart())
    .order("created_at", { ascending: true })
    .limit(40);
  if (error) throw error;

  for (const report of (data ?? []) as ReportRow[]) {
    if (admins.has(report.reporter_id)) continue;
    if (await wasReportHandled(report.id)) continue;
    if (Date.now() - Date.parse(report.created_at) < 1_000) continue;

    const key = `report:${report.id}`;
    if ((failures.get(key) ?? 0) >= 3) continue;
    try {
      const conversationId = await findOrCreateSupportConversation(
        report.reporter_id,
        adminId,
      );
      if (!conversationId) continue;

      beginSupportTyping(conversationId, adminId);
      try {
        const client = await latestClientPlatform(report.reporter_id);
        const decision = await decideSupportReply({
          history: await recentHistory(conversationId, adminId, new Set()),
          latestText: reportText(report),
          hint: "auto_report",
          client,
        });
        if (decision.reply) {
          const text = replyForClient(decision.reply, client);
          const reply = decision.escalate
            ? `${HANDOFF_MARK}${text}`
            : text;
          await sendAsSupport(conversationId, adminId, reply);
        }
        await sendTemplateBubbles(conversationId, adminId, decision.templates, client);
        if (decision.escalate) {
          await markSupportHandoff(conversationId);
        }
        await rememberReport(report.id, conversationId);
        failures.delete(key);
        console.log("[SupportBot] Report follow-up", {
          reportId: report.id,
          action: decision.action,
        });
      } finally {
        await endSupportTyping(conversationId, adminId);
      }
    } catch (err) {
      failures.set(key, (failures.get(key) ?? 0) + 1);
      const message = err instanceof SupportBotError ? err.message : "Report follow-up failed";
      console.error("[SupportBot] Report follow-up failed:", message);
    }
  }
}

async function cachedSupport(
  conversationId: string,
  admins: Set<string>,
): Promise<{ adminId: string; userId: string } | null> {
  if (supportCache.has(conversationId)) {
    return supportCache.get(conversationId) ?? null;
  }
  const found = await supportConversation(conversationId, admins);
  const cached = found ? { adminId: found.adminId, userId: found.userId } : null;
  supportCache.set(conversationId, cached);
  return cached;
}

/** Start the dots the instant a person messages support, before the reply is prepared. */
async function onMessageInserted(row: MessageRow): Promise<void> {
  if (!row.conversation_id || !row.sender_id || !messageHasContent(row)) return;
  const admins = await loadAdminIds();
  if (admins.has(row.sender_id)) return;
  const support = await cachedSupport(row.conversation_id, admins);
  if (!support || support.userId !== row.sender_id) return;
  if (beginSupportTyping(row.conversation_id, support.adminId)) {
    console.log("[SupportBot] Typing", { conversationId: row.conversation_id });
  }
  void tick();
}

function watchInboundMessages(): void {
  if (inboundWatchStarted) return;
  inboundWatchStarted = true;
  supabaseAdmin
    .channel("support-bot-inbound")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        void onMessageInserted(payload.new as MessageRow);
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("[SupportBot] Watching new messages for typing");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("[SupportBot] Message watch", status);
      }
    });
}

async function tick(): Promise<void> {
  if (!supportBotConfigured()) return;
  if (tickInFlight) {
    tickQueued = true;
    return;
  }
  tickInFlight = true;
  try {
    const admins = await loadAdminIds();
    if (admins.size === 0) return;
    await handleIncomingMessages(admins);
    await handleAutomaticReports(admins);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Support bot tick failed";
    console.error("[SupportBot] Tick failed:", message);
  } finally {
    tickInFlight = false;
    if (tickQueued) {
      tickQueued = false;
      void tick();
    }
  }
}

export function startSupportBot(): void {
  if (timer) return;
  if (!supportBotConfigured()) {
    console.warn("[SupportBot] Not started — OPENAI_API_KEY is missing");
    return;
  }
  watermark = new Date(Date.now() - LOOKBACK_MS).toISOString();
  console.log("[SupportBot] Listening on the Tebnu Support account");
  watchInboundMessages();
  void tick();
  timer = setInterval(() => {
    void tick();
  }, TICK_MS);
}
