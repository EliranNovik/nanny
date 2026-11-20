import { supabaseAdmin } from "../../supabase";
import { sendFcmToTokens } from "./fcm";
import { getApnsConfigError, isApnsConfigured, sendApnsToTokens } from "./apns";
import { PUSH_WORKER_VERSION, pushError, pushLog, pushWarn, tokenPreview } from "./log";
import {
  linkPushImage,
  mediaPushImage,
  shortenPushLinkText,
} from "./pushPreview";
import {
  loadDeliveryPrefs,
  messageAlreadyRead,
  messageSoundShouldPause,
  morningSummaryLine,
  newestGroupedQueueIds,
  notificationPartyBlocked,
  pushCollapseKey,
  quietHoursDeferral,
  rememberMessageSound,
  specificAlertCopy,
  unreadConversationCount,
  type DeliveryPrefs,
} from "./pushDelivery";

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 100;

type QueueRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  notification_type?: string | null;
  dedupe_key: string | null;
  attempts: number;
  last_error?: string | null;
};

function nonEmptyString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

const SUPPORT_TEAM_PUSH_NAME = "Support Team";

/** Bot replies start with invisible marks. Keep those out of the notification text. */
function visiblePushBody(body: string): string {
  const visible = body.replace(/^[\u200b\u2060]+/, "").trim();
  return visible || body;
}

/**
 * Support chats are stored as the admin account. The lock-screen title should
 * match the chat: Support Team, not that person's name.
 */
async function supportTeamPush(
  row: QueueRow,
): Promise<{ title: string; body: string }> {
  const type = row.notification_type || nonEmptyString(row.data?.type);
  const senderId =
    nonEmptyString(row.data?.sender_id) || nonEmptyString(row.data?.actor_id);
  if (type !== "message" || !senderId) {
    return { title: row.title, body: row.body };
  }
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", senderId)
    .maybeSingle();
  if (error || data?.is_admin !== true) {
    return { title: row.title, body: row.body };
  }
  return {
    title: SUPPORT_TEAM_PUSH_NAME,
    body: visiblePushBody(row.body),
  };
}

function attachmentNotice(type: string): string | null {
  const kind = type.trim().toLowerCase();
  if (kind.startsWith("image")) return "Sent you an image";
  if (kind.startsWith("video")) return "Sent you a video";
  if (kind.startsWith("audio")) return "Sent you a voice message";
  return null;
}

/**
 * Voice, image, and video messages get a plain description.
 * Image and video alerts carry a small JPEG in `media_preview_url`.
 * `actor_photo_url` and `image` stay the sender, so the profile photo is not replaced.
 * Android draws `media_preview_url` to the right of the text. iOS does that only
 * after the notification extension attaches `media_preview_url` as a file.
 * A written caption stays as the text. A shared link is shortened to a
 * link icon plus the site name, with the page image as the preview.
 */
async function withMessageMedia(
  row: QueueRow,
  body: string,
  data: Record<string, unknown>,
  showPreview: boolean,
): Promise<{ body: string; data: Record<string, unknown>; skipAlert: boolean }> {
  const type = row.notification_type || nonEmptyString(data.type);
  const messageId = nonEmptyString(data.message_id);
  if (type !== "message" || !messageId) return { body, data, skipAlert: false };

  const { data: message, error } = await supabaseAdmin
    .from("messages")
    .select("body, attachment_url, attachment_type, read_at")
    .eq("id", messageId)
    .maybeSingle();
  if (error || !message) return { body, data, skipAlert: false };
  if ((message as { read_at?: string | null }).read_at) {
    return { body, data, skipAlert: true };
  }

  const attachmentType = nonEmptyString(message.attachment_type);
  const notice = attachmentType ? attachmentNotice(attachmentType) : null;
  const caption = visiblePushBody(nonEmptyString(message.body) ?? "").trim();
  const url = nonEmptyString(message.attachment_url);
  const kind = !attachmentType
    ? null
    : attachmentType.toLowerCase().startsWith("image")
      ? "image"
      : attachmentType.toLowerCase().startsWith("video")
        ? "video"
        : attachmentType.toLowerCase().startsWith("audio")
          ? "audio"
          : null;

  if (kind) data.media_type = kind;
  if (isHttpUrl(url)) data.media_url = url;

  const profilePhoto = nonEmptyString(data.actor_photo_url);
  if ((kind === "image" || kind === "video") && isHttpUrl(url)) {
    const preview = await mediaPushImage(messageId, url, kind);
    if (preview) {
      data.media_preview_url = preview;
      pushLog("Push media preview ready", { message_id: messageId, kind });
    } else if (kind === "image") {
      data.media_preview_url = url;
    }
  }
  // Keep the sender in the avatar slot. A chat photo must not take that place.
  if (profilePhoto) data.image = profilePhoto;
  else if (data.media_preview_url) delete data.image;

  if (!showPreview) {
    return {
      body: notice || "Sent you a message",
      data,
      skipAlert: false,
    };
  }

  let nextBody = notice ? (caption || notice) : caption || visiblePushBody(body);
  if (caption || !notice) {
    const shortened = shortenPushLinkText(nextBody);
    if (shortened.text) nextBody = shortened.text;
    const pageUrl = shortened.urls[0];
    if (pageUrl && !isHttpUrl(nonEmptyString(data.image))) {
      const preview = await linkPushImage(pageUrl);
      if (preview) {
        data.media_preview_url = preview;
        pushLog("Push link preview ready", { message_id: messageId });
      }
    }
  }

  return { body: nextBody.slice(0, 140), data, skipAlert: false };
}

function isHttpUrl(v: string | null | undefined): v is string {
  return !!v && /^https?:\/\//i.test(v);
}

const COMMENT_TABLE_BY_PARENT_KEY: [string, string][] = [
  ["post_id", "profile_post_comments"],
  ["job_request_id", "job_request_comments"],
  ["community_post_id", "community_post_comments"],
];

async function lookupCommentAuthor(data: Record<string, unknown>): Promise<string | null> {
  const commentId = nonEmptyString(data.comment_id);
  if (!commentId) return null;
  const entry = COMMENT_TABLE_BY_PARENT_KEY.find(([key]) => nonEmptyString(data[key]));
  if (!entry) return null;
  const { data: row } = await supabaseAdmin
    .from(entry[1])
    .select("author_id")
    .eq("id", commentId)
    .maybeSingle();
  return nonEmptyString((row as { author_id?: unknown } | null)?.author_id);
}

async function lookupJobClient(jobId: string | null): Promise<string | null> {
  if (!jobId) return null;
  const { data: row } = await supabaseAdmin
    .from("job_requests")
    .select("client_id")
    .eq("id", jobId)
    .maybeSingle();
  return nonEmptyString((row as { client_id?: unknown } | null)?.client_id);
}

/** Person the push is "from" — drives the iOS communication-style avatar. */
async function resolveActorId(row: QueueRow): Promise<string | null> {
  const data = row.data ?? {};
  const direct =
    nonEmptyString(data.actor_id) ??
    nonEmptyString(data.sender_id) ??
    nonEmptyString(data.author_id) ??
    nonEmptyString(data.freelancer_id) ??
    nonEmptyString(data.client_id);
  if (direct) return direct;

  const type = nonEmptyString(data.type);
  if (type === "comment") return lookupCommentAuthor(data);
  if (type === "like") {
    // dedupe_key: profile_like:<post>:<user> / job_like:<job>:<user>
    const parts = (row.dedupe_key ?? "").split(":");
    return parts.length >= 3 ? nonEmptyString(parts[parts.length - 1]) : null;
  }
  if (type === "new_match" || type === "new_request") {
    return lookupJobClient(nonEmptyString(data.job_id));
  }
  return null;
}

/**
 * Ensures every push carries `actor_photo_url` (+ `actor_id`) so the iOS
 * Notification Service Extension can render the sender avatar with the app badge.
 * Falls back to the recipient's own photo for system pushes (e.g. post expiry).
 */
async function withActorPhoto(
  row: QueueRow,
  photoCache: Map<string, string | null>,
): Promise<Record<string, unknown>> {
  const data = { ...(row.data ?? {}) };
  if (isHttpUrl(nonEmptyString(data.actor_photo_url))) return data;

  try {
    const actorId = (await resolveActorId(row)) ?? row.user_id;
    let photo = photoCache.get(actorId);
    if (photo === undefined) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("photo_url")
        .eq("id", actorId)
        .maybeSingle();
      const raw = nonEmptyString((profile as { photo_url?: unknown } | null)?.photo_url);
      photo = isHttpUrl(raw) ? raw : null;
      photoCache.set(actorId, photo);
    }
    if (photo) {
      data.actor_photo_url = photo;
      if (!nonEmptyString(data.actor_id)) data.actor_id = actorId;
    }
  } catch (err: unknown) {
    pushWarn("Actor photo lookup failed", {
      queue_id: row.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
  return data;
}

type DeviceTokenRow = {
  token: string;
  platform: "ios" | "android" | "web" | string;
  device_id?: string | null;
  last_seen_at?: string | null;
};

/**
 * One phone often has several saved tokens (a refresh, or a different case of
 * the same APNs hex). Keep the newest token per platform, and per device when
 * the app sent a device id. Older tokens still receive pushes until Apple or
 * FCM rejects them, which is how the same alert shows twice.
 */
function tokensToDeliver(rows: DeviceTokenRow[]): DeviceTokenRow[] {
  const newest = new Map<string, DeviceTokenRow>();
  for (const row of rows) {
    if (!row.token) continue;
    const token = row.platform === "ios" ? normalizeIosToken(row.token) : row.token;
    const deviceKey = row.device_id?.trim() || "device";
    const key = `${row.platform}:${deviceKey}`;
    const current = newest.get(key);
    const seen = row.last_seen_at ? Date.parse(row.last_seen_at) : 0;
    const currentSeen = current?.last_seen_at ? Date.parse(current.last_seen_at) : 0;
    if (!current || seen >= currentSeen) {
      newest.set(key, { ...row, token });
    }
  }
  return [...newest.values()];
}

function stringifyData(data: Record<string, unknown> | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    if (value === null || value === undefined) continue;
    out[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return out;
}

/** FCM registration tokens (Android / web). Never use raw APNs hex here. */
function isLikelyFcmToken(token: string): boolean {
  return token.includes(":") || token.includes("APA91");
}

/** APNs hex is case-insensitive. One phone can be stored twice if the case differs. */
function normalizeIosToken(token: string): string {
  return token.replace(/[<>\s]/g, "").toLowerCase();
}

function uniqueTokens(tokens: string[], normalize?: (token: string) => string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokens) {
    const key = normalize ? normalize(token) : token;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(normalize ? key : token);
  }
  return out;
}

/**
 * Two workers (in-process scheduler and the cron endpoint, or two servers)
 * can read the same pending row. Claim it before sending so only one proceeds.
 */
async function claimQueueRow(row: QueueRow): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("push_notification_queue")
    .update({ attempts: row.attempts + 1, last_error: "sending" })
    .eq("id", row.id)
    .eq("status", "pending")
    .eq("attempts", row.attempts)
    .select("id");

  if (error) {
    pushError("Queue claim failed", { queue_id: row.id, message: error.message });
    return false;
  }
  return (data ?? []).length === 1;
}

/** Fold every alert that waited overnight into one line. A single alert stays as itself. */
async function takeMorningDigest(row: QueueRow): Promise<{
  title: string;
  body: string;
  link: string;
  folded: QueueRow[];
  handledIds: string[];
} | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("push_notification_queue")
    .select("id, user_id, title, body, data, notification_type, dedupe_key, attempts, last_error")
    .eq("user_id", row.user_id)
    .eq("status", "pending")
    .eq("last_error", "quiet_hours")
    .lte("scheduled_for", now)
    .neq("id", row.id)
    .limit(50);
  if (error || !data?.length) return null;

  const folded: QueueRow[] = [];
  const handledIds: string[] = [];
  for (const sibling of data as QueueRow[]) {
    if (await notificationPartyBlocked(sibling)) {
      if (await claimQueueRow(sibling)) {
        await markQueueRow(sibling.id, "skipped", sibling.attempts + 1, "blocked");
        handledIds.push(sibling.id);
      }
      continue;
    }
    if (await claimQueueRow(sibling)) {
      folded.push(sibling);
      handledIds.push(sibling.id);
    }
  }

  const types = [row, ...folded].map(
    (item) => item.notification_type || nonEmptyString(item.data?.type) || "",
  );
  const line = morningSummaryLine(types);
  if (!line) {
    for (const sibling of folded) {
      await markQueueRow(sibling.id, "pending", sibling.attempts + 1, "quiet_hours");
    }
    return null;
  }

  const messageWaiting = types.includes("message");
  const link =
    (messageWaiting
      ? "/messages"
      : nonEmptyString(folded.find((item) => nonEmptyString(item.data?.link))?.data?.link) ||
        nonEmptyString(row.data?.link)) || "/messages";

  return {
    title: "While you were away",
    body: line,
    link,
    folded,
    handledIds,
  };
}

export async function processPushQueue(limit = BATCH_SIZE): Promise<{
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  const now = new Date().toISOString();

  pushLog("Queue load", {
    worker_version: PUSH_WORKER_VERSION,
    now,
    limit,
    fcm_env: {
      has_project_id: Boolean(process.env.FIREBASE_PROJECT_ID?.trim()),
      has_client_email: Boolean(process.env.FIREBASE_CLIENT_EMAIL?.trim()),
      has_private_key: Boolean(process.env.FIREBASE_PRIVATE_KEY?.trim()),
    },
    apns_env: {
      has_key_id: Boolean(process.env.APNS_KEY_ID?.trim()),
      has_team_id: Boolean(process.env.APNS_TEAM_ID?.trim()),
      has_private_key: Boolean(process.env.APNS_PRIVATE_KEY?.trim()),
      bundle_id: process.env.APNS_BUNDLE_ID?.trim() || "com.tebnu.app",
      production:
        process.env.APNS_PRODUCTION?.trim().toLowerCase() === "true" ||
        process.env.APNS_PRODUCTION?.trim() === "1",
      configured: isApnsConfigured(),
      config_error: isApnsConfigured() ? null : getApnsConfigError(),
    },
  });

  const { data: rows, error } = await supabaseAdmin
    .from("push_notification_queue")
    .select("id, user_id, title, body, data, notification_type, dedupe_key, attempts, last_error")
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) {
    pushError("Queue load failed", { message: error.message });
    throw new Error(`Failed to load push queue: ${error.message}`);
  }

  const queueRows = (rows ?? []) as QueueRow[];
  pushLog("Queue rows fetched", {
    count: queueRows.length,
    ids: queueRows.slice(0, 10).map((r) => r.id),
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const photoCache = new Map<string, string | null>();
  const prefsCache = new Map<string, DeliveryPrefs>();
  const badgeCache = new Map<string, number | null>();
  const nameCache = new Map<string, string>();
  const newestInBatch = newestGroupedQueueIds(queueRows);
  const foldedAway = new Set<string>();

  for (const row of queueRows) {
    if (foldedAway.has(row.id)) continue;
    const rowType = row.notification_type || nonEmptyString(row.data?.type) || "";

    if (rowType !== "badge" && (await notificationPartyBlocked(row))) {
      const blockedClaim = await claimQueueRow(row);
      if (blockedClaim) {
        await markQueueRow(row.id, "skipped", row.attempts + 1, "blocked");
        skipped += 1;
      }
      continue;
    }

    const groupKey = pushCollapseKey(rowType, row.data);
    const prefs = await loadDeliveryPrefs(row.user_id, prefsCache);
    const alreadyRead = await messageAlreadyRead(row);

    if (!alreadyRead && rowType !== "badge") {
      const deferUntil = quietHoursDeferral({
        enabled: prefs.quietHours,
        timeZone: prefs.timezone,
        type: rowType,
      });
      if (deferUntil) {
        await supabaseAdmin
          .from("push_notification_queue")
          .update({
            scheduled_for: deferUntil.toISOString(),
            last_error: "quiet_hours",
          })
          .eq("id", row.id)
          .eq("status", "pending")
          .eq("attempts", row.attempts);
        pushLog("Deferred for quiet hours", {
          queue_id: row.id,
          until: deferUntil.toISOString(),
        });
        skipped += 1;
        continue;
      }
    }

    pushLog("Queue row start", {
      queue_id: row.id,
      user_id: row.user_id,
      attempts: row.attempts,
      title: row.title,
      body_preview: row.body?.slice(0, 80) ?? null,
      data_keys: Object.keys(row.data ?? {}),
    });

    const { data: tokens, error: tokenError } = await supabaseAdmin
      .from("push_device_tokens")
      .select("token, platform, device_id, last_seen_at")
      .eq("user_id", row.user_id);

    if (tokenError) {
      pushError("Device token query failed", {
        queue_id: row.id,
        user_id: row.user_id,
        message: tokenError.message,
      });
      await markQueueRow(row.id, "failed", row.attempts + 1, tokenError.message);
      failed += 1;
      continue;
    }

    const claimed = await claimQueueRow(row);
    if (!claimed) {
      pushLog("Queue row already claimed", { queue_id: row.id });
      skipped += 1;
      continue;
    }
    const claimedAttempts = row.attempts + 1;

    if (groupKey && row.last_error !== "quiet_hours" && newestInBatch.get(groupKey) !== row.id) {
      await markQueueRow(row.id, "skipped", claimedAttempts, "grouped");
      skipped += 1;
      continue;
    }

    const rawDeviceRows = (tokens ?? []) as DeviceTokenRow[];
    const deviceRows = tokensToDeliver(rawDeviceRows);
    pushLog("Device tokens loaded", {
      queue_id: row.id,
      user_id: row.user_id,
      count: deviceRows.length,
      platforms: deviceRows.map((t) => t.platform),
      previews: deviceRows.map((t) => ({
        platform: t.platform,
        token: tokenPreview(t.token),
        looks_like_fcm: isLikelyFcmToken(t.token),
      })),
    });

    const iosTokens = uniqueTokens(
      deviceRows.filter((t) => t.platform === "ios" && t.token).map((t) => t.token),
      normalizeIosToken,
    );
    const fcmTokens = uniqueTokens(
      deviceRows
        .filter((t) => t.platform !== "ios" && t.token && isLikelyFcmToken(t.token))
        .map((t) => t.token),
    );
    // Defense: never pass APNs hex into FCM even if platform was mis-tagged.
    const skippedMisrouted = deviceRows.filter(
      (t) => t.platform !== "ios" && t.token && !isLikelyFcmToken(t.token),
    );

    if (skippedMisrouted.length) {
      pushWarn("Skipping non-FCM tokens on non-ios platform", {
        queue_id: row.id,
        count: skippedMisrouted.length,
        previews: skippedMisrouted.map((t) => ({
          platform: t.platform,
          token: tokenPreview(t.token),
        })),
      });
    }

    if (!iosTokens.length && !fcmTokens.length) {
      const reason =
        skippedMisrouted.length > 0
          ? "No valid device tokens (non-FCM tokens on non-ios platform)"
          : "No device tokens registered";
      pushWarn("Queue row skipped", { queue_id: row.id, reason });
      await markQueueRow(row.id, "skipped", claimedAttempts, reason);
      skipped += 1;
      continue;
    }

    const enriched = await withActorPhoto(row, photoCache);
    // Ensure type/sound fallbacks work even on rows queued before SQL 147.
    if (!nonEmptyString(enriched.notification_type) && nonEmptyString(row.notification_type)) {
      enriched.notification_type = row.notification_type;
    }
    if (!nonEmptyString(enriched.type) && nonEmptyString(row.notification_type)) {
      enriched.type = row.notification_type;
    }
    let silent = rowType === "badge" || alreadyRead;
    let title = row.title;
    let alertBody = row.body;
    let alertData = enriched;
    let folded: QueueRow[] = [];
    const digest =
      !silent && row.last_error === "quiet_hours" ? await takeMorningDigest(row) : null;
    if (digest) {
      for (const id of digest.handledIds) foldedAway.add(id);
      folded = digest.folded;
      title = digest.title;
      alertBody = digest.body;
      alertData = {
        type: "quiet_digest",
        link: digest.link,
        notification_type: "quiet_digest",
      };
    } else if (!silent) {
      const named = await supportTeamPush(row);
      const withMedia = await withMessageMedia(
        row,
        named.body,
        enriched,
        prefs.showMessagePreview,
      );
      if (withMedia.skipAlert) {
        silent = true;
      } else {
        title = named.title;
        alertBody = withMedia.body;
        alertData = withMedia.data;
        if (rowType !== "message") {
          const polished = await specificAlertCopy(
            rowType,
            title,
            alertBody,
            alertData,
            nameCache,
          );
          title = polished.title;
          alertBody = polished.body;
        }
      }
    }
    const badge = await unreadConversationCount(row.user_id, badgeCache);
    const data = stringifyData(alertData);
    const conversationId =
      rowType === "message" && !digest
        ? nonEmptyString(alertData.conversation_id) || nonEmptyString(row.data?.conversation_id)
        : null;
    const muteSound = conversationId
      ? await messageSoundShouldPause(row.user_id, conversationId)
      : false;
    const threadId = digest ? `digest-${row.user_id}` : groupKey;
    const payload = {
      title,
      body: alertBody,
      data,
      badge,
      silent,
      muteSound,
      threadId,
    };
    const collapseId = silent
      ? `badge-${row.user_id}`
      : digest
        ? `digest-${row.user_id}`
        : groupKey;
    pushLog("Queue row audio fields", {
      queue_id: row.id,
      notification_type: row.notification_type ?? null,
      sound: data.sound ?? null,
      android_channel_id: data.android_channel_id ?? null,
    });
    const invalidTokens: string[] = [];
    let successCount = 0;
    const errorParts: string[] = [];

    pushLog("Send plan", {
      queue_id: row.id,
      ios_count: iosTokens.length,
      fcm_count: fcmTokens.length,
    });

    // A badge-only update has no banner. Android cannot change the icon count
    // without the app, so that refresh goes to iOS only.
    if (silent && (badge === null || !iosTokens.length)) {
      await markQueueRow(
        row.id,
        "sent",
        claimedAttempts,
        badge === null ? "badge unavailable" : null,
      );
      sent += 1;
      continue;
    }

    // FCM and APNs are independent — one provider failing must not block the other.
    if (!silent && fcmTokens.length) {
      try {
        const fcmResult = await sendFcmToTokens(fcmTokens, payload, collapseId);
        successCount += fcmResult.successCount;
        invalidTokens.push(...fcmResult.invalidTokens);
        if (fcmResult.failureCount > 0) {
          errorParts.push(
            `FCM: ${fcmResult.failureCount} failed` +
              (fcmResult.errors[0] ? ` (${fcmResult.errors.slice(0, 2).join("; ")})` : ""),
          );
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "FCM send error";
        pushError("FCM send threw", { queue_id: row.id, message });
        errorParts.push(`FCM: ${message}`);
      }
    }

    if (iosTokens.length) {
      try {
        if (!isApnsConfigured()) {
          const cfgErr = getApnsConfigError() ?? "APNs is not configured";
          pushWarn("APNs skipped — not configured", {
            queue_id: row.id,
            ios_count: iosTokens.length,
            error: cfgErr,
          });
          errorParts.push(`APNs: ${iosTokens.length} iOS token(s) but ${cfgErr}`);
        } else {
          const apnsResult = await sendApnsToTokens(iosTokens, payload, collapseId);
          successCount += apnsResult.successCount;
          invalidTokens.push(...apnsResult.invalidTokens);
          if (apnsResult.failureCount > 0) {
            errorParts.push(
              `APNs: ${apnsResult.errors.slice(0, 3).join("; ") || `${apnsResult.failureCount} failed`}`,
            );
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "APNs send error";
        pushError("APNs send threw", { queue_id: row.id, message });
        errorParts.push(`APNs: ${message}`);
      }
    }

    if (invalidTokens.length) {
      pushWarn("Deleting invalid device tokens", {
        queue_id: row.id,
        count: invalidTokens.length,
        previews: invalidTokens.map(tokenPreview),
      });
      const doomed = new Set(invalidTokens);
      const storedTokens = rawDeviceRows
        .filter((device) => {
          const key = device.platform === "ios" ? normalizeIosToken(device.token) : device.token;
          return doomed.has(device.token) || doomed.has(key);
        })
        .map((device) => device.token);
      await supabaseAdmin
        .from("push_device_tokens")
        .delete()
        .in("token", storedTokens.length ? storedTokens : invalidTokens);
    }

    if (successCount > 0) {
      pushLog("Queue row SENT", {
        queue_id: row.id,
        successCount,
        worker_version: PUSH_WORKER_VERSION,
      });
      await markQueueRow(
        row.id,
        "sent",
        claimedAttempts,
        muteSound ? "quiet_sound" : null,
      );
      if (conversationId && !muteSound) rememberMessageSound(row.user_id, conversationId);
      for (const sibling of folded) {
        await markQueueRow(sibling.id, "skipped", sibling.attempts + 1, "morning_summary");
      }
      sent += 1;
    } else {
      for (const sibling of folded) {
        await markQueueRow(sibling.id, "pending", sibling.attempts + 1, "quiet_hours");
      }
      const nextAttempts = claimedAttempts;
      const status = nextAttempts >= MAX_ATTEMPTS ? "failed" : "pending";
      const lastError = errorParts.join(" | ") || "All push deliveries failed";
      pushError("Queue row NOT sent", {
        queue_id: row.id,
        next_status: status,
        next_attempts: nextAttempts,
        last_error: lastError,
        worker_version: PUSH_WORKER_VERSION,
      });
      await markQueueRow(row.id, status, nextAttempts, lastError);
      failed += 1;
    }
  }

  const summary = {
    worker_version: PUSH_WORKER_VERSION,
    processed: queueRows.length,
    sent,
    failed,
    skipped,
  };
  pushLog("Queue batch done", summary);
  return summary;
}

async function markQueueRow(
  id: string,
  status: "sent" | "failed" | "skipped" | "pending",
  attempts: number,
  lastError: string | null,
): Promise<void> {
  const patch: Record<string, unknown> = {
    status,
    attempts,
    last_error: lastError,
  };

  if (status === "sent") {
    patch.sent_at = new Date().toISOString();
  }

  const { error } = await supabaseAdmin
    .from("push_notification_queue")
    .update(patch)
    .eq("id", id);

  if (error) {
    pushError("markQueueRow failed", { id, status, message: error.message });
  }
}

export async function enqueueDuePostExpiryPushes(limit = 200): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc("enqueue_due_post_expiry_pushes", {
    p_limit: limit,
  });

  if (error) {
    pushError("enqueue_due_post_expiry_pushes failed", { message: error.message });
    throw new Error(`enqueue_due_post_expiry_pushes failed: ${error.message}`);
  }

  const count = typeof data === "number" ? data : 0;
  if (count > 0) {
    pushLog("Expiry pushes enqueued", { count });
  }
  return count;
}

export type PushWorkerResult = {
  ok: true;
  worker_version: string;
  expiry_enqueued: number;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
};

/** Shared by HTTP cron route and in-process scheduler. */
export async function runPushWorker(): Promise<PushWorkerResult> {
  pushLog("Worker run start", { worker_version: PUSH_WORKER_VERSION });
  const expiryEnqueued = await enqueueDuePostExpiryPushes();
  const result = await processPushQueue();
  const out = {
    ok: true as const,
    worker_version: PUSH_WORKER_VERSION,
    expiry_enqueued: expiryEnqueued,
    ...result,
  };
  pushLog("Worker run end", out);
  return out;
}
