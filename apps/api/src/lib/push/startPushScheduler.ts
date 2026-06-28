import { runPushWorker } from "./processQueue";

let timer: ReturnType<typeof setInterval> | null = null;
let tickInFlight = false;

function isSchedulerEnabled(): boolean {
  const flag = process.env.PUSH_CRON_ENABLED?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  // Default: run in-process worker when secret is configured (local/single-instance).
  return Boolean(process.env.PUSH_CRON_SECRET?.trim());
}

async function tick(): Promise<void> {
  if (tickInFlight) {
    console.log("[PushScheduler] Previous run still in progress, skipping tick");
    return;
  }

  tickInFlight = true;
  try {
    const result = await runPushWorker();
    if (result.processed > 0 || result.expiry_enqueued > 0) {
      console.log("[PushScheduler] Tick complete", result);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Push worker failed";
    console.error("[PushScheduler] Tick failed:", message);
  } finally {
    tickInFlight = false;
  }
}

export function startPushScheduler(): void {
  if (timer) return;

  if (!process.env.PUSH_CRON_SECRET?.trim()) {
    console.warn(
      "[PushScheduler] Disabled — set PUSH_CRON_SECRET to enable in-process or external cron",
    );
    return;
  }

  if (!isSchedulerEnabled()) {
    console.log(
      "[PushScheduler] In-process scheduler disabled (PUSH_CRON_ENABLED=false). Use POST /api/push/process-queue with x-cron-secret.",
    );
    return;
  }

  const intervalMs = Math.max(
    30_000,
    Number(process.env.PUSH_CRON_INTERVAL_MS || 120_000) || 120_000,
  );

  console.log(
    `[PushScheduler] Starting in-process worker every ${Math.round(intervalMs / 1000)}s`,
  );

  void tick();
  timer = setInterval(() => {
    void tick();
  }, intervalMs);
}

export function stopPushScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
