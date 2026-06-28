import { Router, type Request, type Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import { optionalUser, type AuthenticatedRequest } from "../middleware/auth";
import { translateContent } from "../lib/translate/translateService";
import type { ContentKind } from "../lib/translate/cache";

export const translateRouter = Router();

const translateSchema = z.object({
  contentKind: z.enum([
    "profile_post",
    "job_request",
    "profile_post_comment",
    "job_request_comment",
    "chat_message",
  ]),
  contentId: z.string().uuid(),
  targetLocale: z.enum(["en", "he", "ru", "fr"]).optional(),
});

const guestTranslateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
  message: { error: "Too many translation requests. Please try again later." },
});

const authTranslateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = (req as AuthenticatedRequest).user?.id;
    return userId ? `user:${userId}` : `ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
  },
  message: { error: "Too many translation requests. Please try again later." },
});

translateRouter.post(
  "/",
  optionalUser,
  (req, res, next) => {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (userId) return authTranslateLimiter(req, res, next);
    return guestTranslateLimiter(req, res, next);
  },
  async (req: Request, res: Response) => {
    try {
      const parsed = translateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: "Invalid translation request",
          issues: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const userId = (req as AuthenticatedRequest).user?.id ?? null;
      const { contentKind, contentId, targetLocale } = parsed.data;

      if (contentKind === "chat_message" && !userId) {
        res.status(401).json({ error: "Sign in to translate messages" });
        return;
      }

      const result = await translateContent(
        contentKind as ContentKind,
        contentId,
        targetLocale,
        userId,
      );

      if (result.skipped && result.skipReason === "forbidden") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      if (result.skipped && result.skipReason === "not_found") {
        res.status(404).json({ error: "Content not found" });
        return;
      }

      res.json(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Translation failed";
      console.error("[Translate] request failed:", err);
      const status = message.includes("not configured") ? 503 : 500;
      res.status(status).json({
        error:
          status === 503
            ? "Translation is not available right now."
            : "Could not translate this content. Please try again.",
      });
    }
  },
);
