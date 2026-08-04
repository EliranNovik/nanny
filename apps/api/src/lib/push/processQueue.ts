import { supabaseAdmin } from "../../supabase";
import { sendFcmToTokens } from "./fcm";
import { getApnsConfigError, isApnsConfigured, sendApnsToTokens } from "./apns";
import { PUSH_WORKER_VERSION, pushError, pushLog, pushWarn, tokenPreview } from "./log";

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 100;

type QueueRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  attempts: number;
};

type DeviceTokenRow = {
  token: string;
  platform: "ios" | "android" | "web" | string;
};

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
    .select("id, user_id, title, body, data, attempts")
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

  for (const row of queueRows) {
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
      .select("token, platform")
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

    const deviceRows = (tokens ?? []) as DeviceTokenRow[];
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

    const iosTokens = deviceRows
      .filter((t) => t.platform === "ios" && t.token)
      .map((t) => t.token);
    const fcmTokens = deviceRows
      .filter((t) => t.platform !== "ios" && t.token && isLikelyFcmToken(t.token))
      .map((t) => t.token);
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
      await markQueueRow(row.id, "skipped", row.attempts, reason);
      skipped += 1;
      continue;
    }

    const data = stringifyData(row.data);
    const payload = { title: row.title, body: row.body, data };
    const invalidTokens: string[] = [];
    let successCount = 0;
    const errorParts: string[] = [];

    pushLog("Send plan", {
      queue_id: row.id,
      ios_count: iosTokens.length,
      fcm_count: fcmTokens.length,
    });

    // FCM and APNs are independent — one provider failing must not block the other.
    if (fcmTokens.length) {
      try {
        const fcmResult = await sendFcmToTokens(fcmTokens, payload);
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
          const apnsResult = await sendApnsToTokens(iosTokens, payload);
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
      await supabaseAdmin.from("push_device_tokens").delete().in("token", invalidTokens);
    }

    if (successCount > 0) {
      pushLog("Queue row SENT", {
        queue_id: row.id,
        successCount,
        worker_version: PUSH_WORKER_VERSION,
      });
      await markQueueRow(row.id, "sent", row.attempts + 1, null);
      sent += 1;
    } else {
      const nextAttempts = row.attempts + 1;
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
