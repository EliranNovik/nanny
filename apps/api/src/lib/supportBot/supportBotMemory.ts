import { supabaseAdmin } from "../../supabase";

export type SupportMemoryKind = "fact" | "preference" | "request" | "issue";

export type SupportMemory = {
  id: string;
  kind: SupportMemoryKind;
  content: string;
  updatedAt: string;
};

export type SupportMemoryNote = {
  kind: SupportMemoryKind;
  content: string;
};

export type RecalledTurn = {
  at: string;
  role: "user" | "assistant";
  body: string;
};

const MEMORY_LIMIT = 40;
const MAX_PER_USER = 80;
const RECALL_SCAN = 400;
const RECALL_RESULTS = 8;

/** Used until 153_support_bot_memory.sql is applied, and on any read error. */
const fallback = new Map<string, SupportMemory[]>();
let tableMissing = false;

function noteError(error: { code?: string; message?: string } | null): void {
  if (!error) return;
  const missing =
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /support_bot_memories/i.test(error.message ?? "");
  if (missing && !tableMissing) {
    tableMissing = true;
    console.warn(
      "[SupportBot] Memory table is missing. Run db/sql/153_support_bot_memory.sql. Using in-memory notes until the API restarts.",
    );
    return;
  }
  if (!missing) console.warn("[SupportBot] Memory error:", error.message);
}

function normalize(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, 300);
}

/** Card numbers, passwords, codes and ID numbers must never be kept. */
function looksSensitive(content: string): boolean {
  if (/\b(?:\d[ -]?){12,19}\b/.test(content)) return true;
  if (/\b(password|passcode|pin|cvv|otp|verification code|one-time code)\b/i.test(content)) {
    return true;
  }
  return false;
}

export async function loadSupportMemories(userId: string): Promise<SupportMemory[]> {
  if (tableMissing) return fallback.get(userId) ?? [];
  const { data, error } = await supabaseAdmin
    .from("support_bot_memories")
    .select("id, kind, content, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(MEMORY_LIMIT);
  if (error) {
    noteError(error);
    return fallback.get(userId) ?? [];
  }
  return (data ?? []).map((row) => ({
    id: row.id as string,
    kind: row.kind as SupportMemoryKind,
    content: row.content as string,
    updatedAt: row.updated_at as string,
  }));
}

export async function saveSupportMemories(
  userId: string,
  notes: SupportMemoryNote[],
  sourceMessageId: string | null,
): Promise<void> {
  const clean = notes
    .map((note) => ({ kind: note.kind, content: normalize(note.content) }))
    .filter((note) => note.content.length > 0 && !looksSensitive(note.content));
  if (clean.length === 0) return;

  const existing = await loadSupportMemories(userId);
  const byText = new Map(existing.map((memory) => [memory.content.toLowerCase(), memory]));
  const now = new Date().toISOString();

  if (tableMissing) {
    const list = fallback.get(userId) ?? [];
    for (const note of clean) {
      const found = list.find((memory) => memory.content.toLowerCase() === note.content.toLowerCase());
      if (found) {
        found.updatedAt = now;
      } else {
        list.unshift({ id: `mem-${Date.now()}-${list.length}`, ...note, updatedAt: now });
      }
    }
    fallback.set(userId, list.slice(0, MAX_PER_USER));
    return;
  }

  for (const note of clean) {
    const found = byText.get(note.content.toLowerCase());
    const { error } = found
      ? await supabaseAdmin
          .from("support_bot_memories")
          .update({ kind: note.kind, updated_at: now })
          .eq("id", found.id)
      : await supabaseAdmin.from("support_bot_memories").insert({
          user_id: userId,
          kind: note.kind,
          content: note.content,
          source_message_id: sourceMessageId,
        });
    if (error && error.code !== "23505") noteError(error);
  }
  await trimSupportMemories(userId);
}

async function trimSupportMemories(userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("support_bot_memories")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .range(MAX_PER_USER, MAX_PER_USER + 50);
  if (error || !data?.length) return;
  await supabaseAdmin
    .from("support_bot_memories")
    .delete()
    .in("id", data.map((row) => row.id as string));
}

/** Removes notes the person asked to forget, or that are no longer true. */
export async function forgetSupportMemories(userId: string, contents: string[]): Promise<void> {
  const targets = contents.map((content) => normalize(content).toLowerCase()).filter(Boolean);
  if (targets.length === 0) return;
  const existing = await loadSupportMemories(userId);
  const matches = existing.filter((memory) => {
    const text = memory.content.toLowerCase();
    return targets.some((target) => text === target || text.includes(target) || target.includes(text));
  });
  if (matches.length === 0) return;

  if (tableMissing) {
    const ids = new Set(matches.map((memory) => memory.id));
    fallback.set(userId, (fallback.get(userId) ?? []).filter((memory) => !ids.has(memory.id)));
    return;
  }
  const { error } = await supabaseAdmin
    .from("support_bot_memories")
    .delete()
    .in("id", matches.map((memory) => memory.id));
  if (error) noteError(error);
}

export async function touchSupportMemories(ids: string[]): Promise<void> {
  if (tableMissing || ids.length === 0) return;
  await supabaseAdmin
    .from("support_bot_memories")
    .update({ last_used_at: new Date().toISOString() })
    .in("id", ids);
}

function keywords(query: string): string[] {
  return [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((word) => word.length >= 3),
    ),
  ].slice(0, 12);
}

/**
 * Searches older messages in this chat, past what the bot already sees,
 * for the words the model asked about.
 */
export async function recallFromChat(
  conversationId: string,
  adminId: string,
  query: string,
  /** The newest messages the bot already sees as history. */
  skipNewest: number,
): Promise<RecalledTurn[]> {
  const words = keywords(query);
  if (words.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(RECALL_SCAN);
  if (error || !data) return [];

  const scored = data
    .slice(skipNewest)
    .filter((row) => typeof row.body === "string")
    .map((row) => {
      const body = String(row.body).replace(/^[\u200b\u2060]+/, "").trim();
      const text = body.toLowerCase();
      const score = words.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0);
      return { row, body, score };
    })
    .filter((item) => item.score > 0 && item.body.length > 0)
    .sort((a, b) => b.score - a.score || String(b.row.created_at).localeCompare(String(a.row.created_at)))
    .slice(0, RECALL_RESULTS);

  return scored
    .sort((a, b) => String(a.row.created_at).localeCompare(String(b.row.created_at)))
    .map(({ row, body }) => ({
      at: String(row.created_at),
      role: row.sender_id === adminId ? ("assistant" as const) : ("user" as const),
      body: body.slice(0, 600),
    }));
}
