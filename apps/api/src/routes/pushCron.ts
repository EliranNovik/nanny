import { Request, Response } from "express";
import { runPushWorker } from "../lib/push/processQueue";
import { PUSH_WORKER_VERSION, pushError, pushLog } from "../lib/push/log";

export async function handleProcessPushQueue(
  _req: Request,
  res: Response,
): Promise<void> {
  pushLog("HTTP process-queue hit", { worker_version: PUSH_WORKER_VERSION });
  try {
    const result = await runPushWorker();
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Push worker failed";
    pushError("HTTP process-queue failed", { message, worker_version: PUSH_WORKER_VERSION });
    res.status(500).json({ error: message, worker_version: PUSH_WORKER_VERSION });
  }
}
