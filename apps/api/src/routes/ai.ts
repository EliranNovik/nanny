import { Router } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../middleware/auth";
import { supportBotConfigured } from "../lib/supportBot/env";
import { SupportBotError } from "../lib/supportBot/openaiClient";
import { runPostWriter } from "../lib/supportBot/postWriter";

export const aiRouter = Router();

const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX = 40;
const recentCalls = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const calls = (recentCalls.get(userId) ?? []).filter((at) => now - at < RATE_WINDOW_MS);
  if (calls.length >= RATE_MAX) {
    recentCalls.set(userId, calls);
    return true;
  }
  calls.push(now);
  recentCalls.set(userId, calls);
  return false;
}

const bodySchema = z.object({
  postType: z.enum(["community", "event", "request", "offer"]),
  turns: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
        title: z.string().max(400).optional(),
        post: z.string().max(2000).optional(),
      }),
    )
    .min(1)
    .max(40),
  draft: z
    .object({
      title: z.string().max(400).optional(),
      description: z.string().max(4000).optional(),
      eventDate: z.string().max(60).optional(),
      eventTime: z.string().max(20).optional(),
      location: z.string().max(400).optional(),
      helpersNeeded: z.string().max(20).optional(),
      details: z.record(z.string().max(60), z.string().max(400)).optional(),
    })
    .default({}),
});

/**
 * Streams the writing assistant as server-sent events:
 * `reply`, `title`, and `post` carry text pieces; `done` or `error` ends the stream.
 */
aiRouter.post("/post-writer", async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.id;
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  if (parsed.data.turns[parsed.data.turns.length - 1]?.role !== "user") {
    res.status(400).json({ error: "The last message must be from the user" });
    return;
  }
  if (!supportBotConfigured()) {
    res.status(503).json({ error: "AI writing is not available right now" });
    return;
  }
  if (rateLimited(userId)) {
    res.status(429).json({ error: "You're going a bit fast. Try again in a few minutes." });
    return;
  }

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  // Reasoning models think silently first; a ping keeps proxies from closing the stream.
  const ping = setInterval(() => res.write(": ping\n\n"), 10_000);
  const abort = new AbortController();
  res.on("close", () => abort.abort());

  try {
    await runPostWriter({
      userId,
      type: parsed.data.postType,
      turns: parsed.data.turns,
      draft: parsed.data.draft,
      signal: abort.signal,
      emit: (event) => send(event.type, { text: event.text }),
    });
    send("done", {});
  } catch (err) {
    if (!abort.signal.aborted) {
      const message =
        err instanceof SupportBotError ? "The AI could not answer right now." : "Something went wrong.";
      console.error("[PostWriter] Failed:", err instanceof Error ? err.message : err);
      send("error", { message });
    }
  } finally {
    clearInterval(ping);
    res.end();
  }
});
