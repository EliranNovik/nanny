import { supabaseAdmin } from "../../supabase";
import { sendFcmToTokens } from "./fcm";

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

function stringifyData(data: Record<string, unknown> | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    if (value === null || value === undefined) continue;
    out[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return out;
}

export async function processPushQueue(limit = BATCH_SIZE): Promise<{
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  const now = new Date().toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from("push_notification_queue")
    .select("id, user_id, title, body, data, attempts")
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load push queue: ${error.message}`);
  }

  const queueRows = (rows ?? []) as QueueRow[];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of queueRows) {
    const { data: tokens, error: tokenError } = await supabaseAdmin
      .from("push_device_tokens")
      .select("token")
      .eq("user_id", row.user_id);

    if (tokenError) {
      await markQueueRow(row.id, "failed", row.attempts + 1, tokenError.message);
      failed += 1;
      continue;
    }

    const fcmTokens = (tokens ?? []).map((t) => t.token as string).filter(Boolean);

    if (!fcmTokens.length) {
      await markQueueRow(row.id, "skipped", row.attempts, "No device tokens registered");
      skipped += 1;
      continue;
    }

    try {
      const result = await sendFcmToTokens(fcmTokens, {
        title: row.title,
        body: row.body,
        data: stringifyData(row.data),
      });

      if (result.invalidTokens.length) {
        await supabaseAdmin
          .from("push_device_tokens")
          .delete()
          .in("token", result.invalidTokens);
      }

      if (result.successCount > 0) {
        await markQueueRow(row.id, "sent", row.attempts + 1, null);
        sent += 1;
      } else {
        const nextAttempts = row.attempts + 1;
        const status = nextAttempts >= MAX_ATTEMPTS ? "failed" : "pending";
        await markQueueRow(row.id, status, nextAttempts, "All FCM deliveries failed");
        failed += 1;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "FCM send error";
      const nextAttempts = row.attempts + 1;
      const status = nextAttempts >= MAX_ATTEMPTS ? "failed" : "pending";
      await markQueueRow(row.id, status, nextAttempts, message);
      failed += 1;
    }
  }

  return {
    processed: queueRows.length,
    sent,
    failed,
    skipped,
  };
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

  await supabaseAdmin.from("push_notification_queue").update(patch).eq("id", id);
}

export async function enqueueDuePostExpiryPushes(limit = 200): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc("enqueue_due_post_expiry_pushes", {
    p_limit: limit,
  });

  if (error) {
    throw new Error(`enqueue_due_post_expiry_pushes failed: ${error.message}`);
  }

  return typeof data === "number" ? data : 0;
}

export type PushWorkerResult = {
  ok: true;
  expiry_enqueued: number;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
};

/** Shared by HTTP cron route and in-process scheduler. */
export async function runPushWorker(): Promise<PushWorkerResult> {
  const expiryEnqueued = await enqueueDuePostExpiryPushes();
  const result = await processPushQueue();
  return { ok: true, expiry_enqueued: expiryEnqueued, ...result };
}
