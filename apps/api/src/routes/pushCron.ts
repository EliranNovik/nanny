import { Request, Response } from "express";
import { runPushWorker } from "../lib/push/processQueue";

export async function handleProcessPushQueue(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const result = await runPushWorker();
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Push worker failed";
    res.status(500).json({ error: message });
  }
}
