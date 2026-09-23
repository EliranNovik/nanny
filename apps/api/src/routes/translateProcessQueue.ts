import { Request, Response } from "express";
import { processTranslationJobs } from "../lib/translate/processTranslationJobs";

export async function handleProcessTranslationQueue(
  _req: Request,
  res: Response,
): Promise<void> {
  console.log("[TranslateQueue] HTTP process-queue hit");
  try {
    const result = await processTranslationJobs();
    res.json(result);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Translation worker failed";
    console.error("[TranslateQueue] HTTP process-queue failed", message);
    // Claim/load failures still return a body; do not crash the process.
    res.status(200).json({
      ok: false,
      error: message,
      claimed: 0,
      completed: 0,
      cancelled: 0,
      retried: 0,
      failed: 0,
      skipped: 0,
    });
  }
}
