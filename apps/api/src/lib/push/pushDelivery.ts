/**
 * Lock-screen polish that the current app already honors:
 * each message keeps its own text, a real unread badge, quieter nights,
 * and titles that name the person.
 */
import { supabaseAdmin } from "../../supabase";
import { pushWarn } from "./log";

const QUIET_START_HOUR = 22;
const QUIET_END_HOUR = 7;

const BREAKS_QUIET_HOURS = new Set([
  "new_match",
  "request_accepted",
  "match_selected",
  "badge",
]);

export type DeliveryPrefs = {
  timezone: string;
  quietHours: boolean;
  showMessagePreview: boolean;
};

type AlertCopy = { title: string; body: string };

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function hourInZone(now: Date, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const raw = parts.find((part) => part.type === "hour")?.value;
    const hour = Number(raw);
    if (!Number.isFinite(hour)) return null;
    return hour === 24 ? 0 : hour;
  } catch {
    return null;
  }
}

function zonedParts(now: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
} | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const map: Record<string, string> = {};
    for (const part of parts) map[part.type] = part.value;
    return {
      year: Number(map.year),
      month: Number(map.month),
      day: Number(map.day),
    };
  } catch {
    return null;
  }
}

function addCalendarDay(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

/** 07:00 in `timeZone`, expressed as a UTC instant. */
function nextLocalMorning(now: Date, timeZone: string): Date | null {
  const today = zonedParts(now, timeZone);
  const hour = hourInZone(now, timeZone);
  if (!today || hour === null) return null;
  const day = hour >= QUIET_START_HOUR ? addCalendarDay(today.year, today.month, today.day) : today;
  const guess = Date.UTC(day.year, day.month - 1, day.day, QUIET_END_HOUR, 0, 0);
  const shown = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(guess));
  const map: Record<string, string> = {};
  for (const part of shown) map[part.type] = part.value;
  const shownHour = Number(map.hour) === 24 ? 0 : Number(map.hour);
  const shownAsUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    shownHour,
    Number(map.minute),
  );
  return new Date(guess - (shownAsUtc - guess));
}

/**
 * Messages, likes, and comments wait until 07:00 local time.
 * Job alerts still go out at night. Returns null when the alert should send now.
 */
export function quietHoursDeferral(options: {
  enabled: boolean;
  timeZone: string;
  type: string;
  now?: Date;
}): Date | null {
  if (!options.enabled || BREAKS_QUIET_HOURS.has(options.type)) return null;
  const now = options.now ?? new Date();
  const hour = hourInZone(now, options.timeZone);
  if (hour === null) return null;
  if (hour >= QUIET_END_HOUR && hour < QUIET_START_HOUR) return null;
  return nextLocalMorning(now, options.timeZone);
}

/** Same key replaces the previous lock-screen alert for that conversation or post. */
export function pushCollapseKey(
  type: string,
  data: Record<string, unknown> | null | undefined,
): string | null {
  const record = data ?? {};
  if (type === "like" || type === "comment") {
    const subject =
      nonEmpty(record.post_id) ||
      nonEmpty(record.job_request_id) ||
      nonEmpty(record.community_post_id);
    return subject ? `${type}-${subject}` : null;
  }
  return null;
}

export function newestGroupedQueueIds(
  rows: Array<{ id: string; notification_type?: string | null; data: Record<string, unknown> | null }>,
): Map<string, string> {
  const newest = new Map<string, string>();
  for (const row of rows) {
    const type = row.notification_type || nonEmpty(row.data?.type) || "";
    const key = pushCollapseKey(type, row.data);
    if (key) newest.set(key, row.id);
  }
  return newest;
}

const SUMMARY_LABELS: Array<[string, string, string]> = [
  ["message", "message", "messages"],
  ["like", "like", "likes"],
  ["comment", "comment", "comments"],
  ["favorite_profile_post", "new post", "new posts"],
  ["post_expiry", "listing update", "listing updates"],
];

/** One lock-screen line for everything that waited through quiet hours. */
export function morningSummaryLine(types: string[]): string | null {
  if (types.length < 2) return null;
  const parts: string[] = [];
  for (const [type, one, many] of SUMMARY_LABELS) {
    const count = types.filter((item) => item === type).length;
    if (!count) continue;
    parts.push(`${count} ${count === 1 ? one : many}`);
  }
  if (parts.length < 1) return null;
  const list =
    parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `${list} while you were away`;
}

const lastAudibleMessage = new Map<string, number>();
const SOUND_GAP_MS = 60_000;

/**
 * A busy chat should update the alert without buzzing again for a minute.
 * The clock starts at the last alert that actually played a sound.
 */
export async function messageSoundShouldPause(
  userId: string,
  conversationId: string,
): Promise<boolean> {
  const key = `${userId}:${conversationId}`;
  const recent = lastAudibleMessage.get(key);
  if (recent && Date.now() - recent < SOUND_GAP_MS) return true;

  const since = new Date(Date.now() - SOUND_GAP_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from("push_notification_queue")
    .select("data")
    .eq("user_id", userId)
    .eq("notification_type", "message")
    .eq("status", "sent")
    .is("last_error", null)
    .gte("sent_at", since)
    .order("sent_at", { ascending: false })
    .limit(20);
  if (error || !data) return false;
  return data.some((row) => {
    const stored = row.data as { conversation_id?: unknown } | null;
    return nonEmpty(stored?.conversation_id) === conversationId;
  });
}

export function rememberMessageSound(userId: string, conversationId: string): void {
  lastAudibleMessage.set(`${userId}:${conversationId}`, Date.now());
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function pairIsBlocked(userId: string, otherId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("user_blocks")
    .select("blocker_id")
    .or(
      `and(blocker_id.eq.${userId},blocked_id.eq.${otherId}),and(blocker_id.eq.${otherId},blocked_id.eq.${userId})`,
    )
    .limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
}

/** Drop the alert when either person has blocked the other. */
export async function notificationPartyBlocked(row: {
  user_id: string;
  notification_type?: string | null;
  dedupe_key: string | null;
  data: Record<string, unknown> | null;
}): Promise<boolean> {
  const data = row.data ?? {};
  const type = row.notification_type || nonEmpty(data.type) || "";
  if (type === "badge" || type === "post_expiry") return false;

  const others = [
    nonEmpty(data.sender_id),
    nonEmpty(data.actor_id),
    nonEmpty(data.author_id),
    nonEmpty(data.freelancer_id),
    nonEmpty(data.client_id),
  ].filter((id): id is string => Boolean(id) && id !== row.user_id);

  if (!others.length && (type === "like" || type === "comment")) {
    const last = (row.dedupe_key ?? "").split(":").pop() ?? "";
    if (UUID_RE.test(last) && last !== row.user_id) others.push(last);
  }

  for (const otherId of [...new Set(others)]) {
    if (await pairIsBlocked(row.user_id, otherId)) return true;
  }
  return false;
}

export function foldedSocialLine(
  names: string[],
  total: number,
  verb: "liked" | "commented on",
  object: "post" | "request",
): string {
  const first = names[0] || "Someone";
  const noun = object === "request" ? "request" : "post";
  if (total <= 1) return `${first} ${verb} your ${noun}`;
  if (total === 2 && names[1]) return `${first} and ${names[1]} ${verb} your ${noun}`;
  return `${first} and ${total - 1} others ${verb} your ${noun}`;
}

const DEFAULT_PREFS: DeliveryPrefs = {
  timezone: "UTC",
  quietHours: false,
  showMessagePreview: true,
};

export async function loadDeliveryPrefs(
  userId: string,
  cache: Map<string, DeliveryPrefs>,
): Promise<DeliveryPrefs> {
  const cached = cache.get(userId);
  if (cached) return cached;

  const { data, error } = await supabaseAdmin
    .from("push_notification_preferences")
    .select("timezone, quiet_hours_enabled, show_message_preview")
    .eq("user_id", userId)
    .maybeSingle();

  let prefs = DEFAULT_PREFS;
  if (!error && data) {
    const row = data as {
      timezone?: string | null;
      quiet_hours_enabled?: boolean | null;
      show_message_preview?: boolean | null;
    };
    prefs = {
      timezone: row.timezone?.trim() || "UTC",
      quietHours: row.quiet_hours_enabled === true,
      showMessagePreview: true,
    };
  }
  cache.set(userId, prefs);
  return prefs;
}

/** Conversations with a message the person has not opened. */
export async function unreadConversationCount(
  userId: string,
  cache: Map<string, number | null>,
): Promise<number | null> {
  if (cache.has(userId)) return cache.get(userId) ?? null;
  try {
    const { data: conversations, error } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .or(`client_id.eq.${userId},freelancer_id.eq.${userId}`)
      .limit(300);
    if (error) throw new Error(error.message);
    const ids = (conversations ?? []).map((row) => row.id as string);
    if (!ids.length) {
      cache.set(userId, 0);
      return 0;
    }
    const { data: messages, error: messageError } = await supabaseAdmin
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", ids)
      .is("read_at", null)
      .neq("sender_id", userId)
      .limit(1000);
    if (messageError) throw new Error(messageError.message);
    const count = new Set(
      (messages ?? []).map((row) => row.conversation_id as string),
    ).size;
    cache.set(userId, count);
    return count;
  } catch (err) {
    pushWarn("Unread badge count failed", {
      user_id: userId,
      message: err instanceof Error ? err.message : String(err),
    });
    cache.set(userId, null);
    return null;
  }
}

export async function messageAlreadyRead(row: {
  notification_type?: string | null;
  data: Record<string, unknown> | null;
}): Promise<boolean> {
  const type = row.notification_type || nonEmpty(row.data?.type);
  const messageId = nonEmpty(row.data?.message_id);
  if (type !== "message" || !messageId) return false;
  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("read_at")
    .eq("id", messageId)
    .maybeSingle();
  if (error || !data) return false;
  return Boolean((data as { read_at?: string | null }).read_at);
}

async function profileNames(
  ids: string[],
  cache: Map<string, string>,
): Promise<string[]> {
  const missing = [...new Set(ids.filter((id) => id && !cache.has(id)))];
  if (missing.length) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", missing);
    for (const row of data ?? []) {
      const name = nonEmpty((row as { full_name?: unknown }).full_name) || "Someone";
      cache.set((row as { id: string }).id, name);
    }
    for (const id of missing) {
      if (!cache.has(id)) cache.set(id, "Someone");
    }
  }
  return ids.map((id) => cache.get(id) || "Someone");
}

async function actorIds(
  table: string,
  idColumn: string,
  id: string,
  actorColumn: string,
): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select(actorColumn)
    .eq(idColumn, id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error || !data) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const row of data as unknown as Record<string, unknown>[]) {
    const actor = nonEmpty(row[actorColumn]);
    if (!actor || seen.has(actor)) continue;
    seen.add(actor);
    ids.push(actor);
  }
  return ids;
}

function clip(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 140) return clean;
  return `${clean.slice(0, 139)}…`;
}

async function socialCopy(
  data: Record<string, unknown>,
  verb: "liked" | "commented on",
  cache: Map<string, string>,
): Promise<AlertCopy | null> {
  const postId = nonEmpty(data.post_id);
  const jobId = nonEmpty(data.job_request_id);
  const communityId = nonEmpty(data.community_post_id);
  const object = jobId ? "request" : "post";
  let ids: string[] = [];
  if (verb === "liked" && postId) {
    ids = await actorIds("profile_post_likes", "post_id", postId, "user_id");
  } else if (verb === "liked" && jobId) {
    ids = await actorIds("job_request_likes", "job_id", jobId, "user_id");
  } else if (verb === "commented on" && postId) {
    ids = await actorIds("profile_post_comments", "post_id", postId, "author_id");
  } else if (verb === "commented on" && jobId) {
    ids = await actorIds("job_request_comments", "job_request_id", jobId, "author_id");
  } else if (verb === "commented on" && communityId) {
    ids = await actorIds("community_post_comments", "post_id", communityId, "author_id");
  }
  if (!ids.length) return null;
  const names = await profileNames(ids.slice(0, 2), cache);
  let body = foldedSocialLine(names, ids.length, verb, object);
  if (verb === "commented on" && ids.length === 1) {
    const commentId = nonEmpty(data.comment_id);
    const table = postId
      ? "profile_post_comments"
      : jobId
        ? "job_request_comments"
        : "community_post_comments";
    if (commentId) {
      const { data: comment } = await supabaseAdmin
        .from(table)
        .select("body")
        .eq("id", commentId)
        .maybeSingle();
      const excerpt = nonEmpty((comment as { body?: unknown } | null)?.body);
      if (excerpt) body = excerpt;
    }
  }
  return { title: names[0] || "Someone", body: clip(body) };
}

/** Replace generic titles with the person's name and a specific line. */
export async function specificAlertCopy(
  type: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
  cache: Map<string, string>,
): Promise<AlertCopy> {
  try {
    if (type === "new_match") {
      const jobId = nonEmpty(data.job_id);
      if (!jobId) return { title, body };
      const { data: job } = await supabaseAdmin
        .from("job_requests")
        .select("client_id, location_city")
        .eq("id", jobId)
        .maybeSingle();
      const clientId = nonEmpty((job as { client_id?: unknown } | null)?.client_id);
      const city = nonEmpty((job as { location_city?: unknown } | null)?.location_city);
      const name = clientId ? (await profileNames([clientId], cache))[0] : "Someone";
      return {
        title: name,
        body: city ? `New request in ${city}` : "New request near you",
      };
    }
    if (type === "request_accepted") {
      const freelancerId = nonEmpty(data.freelancer_id);
      const name = freelancerId
        ? (await profileNames([freelancerId], cache))[0]
        : title;
      return { title: name, body: "Available for your request" };
    }
    if (type === "match_selected") {
      const clientId = nonEmpty(data.client_id);
      const name = clientId ? (await profileNames([clientId], cache))[0] : title;
      return { title: name, body: "Chose you for their request" };
    }
    if (type === "like") {
      return (await socialCopy(data, "liked", cache)) ?? { title, body };
    }
    if (type === "comment") {
      return (await socialCopy(data, "commented on", cache)) ?? { title, body };
    }
    if (type === "post_expiry") {
      return { title: "Your listing ended", body };
    }
  } catch (err) {
    pushWarn("Push copy lookup failed", {
      type,
      message: err instanceof Error ? err.message : String(err),
    });
  }
  return { title, body };
}
