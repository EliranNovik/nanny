import { Router, Request, Response } from "express";
import { z } from "zod";
import { generatePostText, type PostTextPostType } from "../lib/postTextTemplates";

export const postsRouter = Router();

const GenerateCopySchema = z.object({
  postType: z.enum(["request", "offer", "event", "community"]),
  structuredData: z.record(z.unknown()),
});

/** Generate one-time display copy from structured post data (template-based, not stored here). */
postsRouter.post("/generate-copy", (req: Request, res: Response) => {
  const parsed = GenerateCopySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { postType, structuredData } = parsed.data;
  const copy = generatePostText({
    postType: postType as PostTextPostType,
    ...structuredData,
  });
  res.json(copy);
});
