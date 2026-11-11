import { Router } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../middleware/auth";
import { supabaseAdmin } from "../supabase";
import { SupportBotError } from "../lib/supportBot/openaiClient";
import { reviewPost, takeFlagReview } from "../lib/qualityManager/reviewPost";

export const qualityRouter = Router();

const imageSchema = z
  .string()
  .max(1_500_000)
  .refine(
    (value) => value.startsWith("data:image/") || value.startsWith("https://"),
    "Images must be photos",
  );

const reviewSchema = z.object({
  postType: z.string().max(40).default("post"),
  title: z.string().max(400).default(""),
  text: z.string().max(4000).default(""),
  images: z.array(imageSchema).max(3).default([]),
});

const flagSchema = z.object({
  reviewId: z.string().uuid(),
  profilePostId: z.string().uuid().optional(),
  communityPostId: z.string().uuid().optional(),
});

qualityRouter.post("/review", async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.id;
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  try {
    const review = await reviewPost({ userId, ...parsed.data });
    res.json(review);
  } catch (err) {
    const message = err instanceof SupportBotError ? err.message : "Quality review failed";
    console.error("[Quality]", message);
    res.status(503).json({ error: "Quality review is unavailable" });
  }
});

qualityRouter.post("/flag", async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.id;
  const parsed = flagSchema.safeParse(req.body);
  if (!parsed.success || (!parsed.data.profilePostId && !parsed.data.communityPostId)) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const review = takeFlagReview(userId, parsed.data.reviewId);
  if (!review) {
    res.status(400).json({ error: "This review is no longer available" });
    return;
  }

  const postId = parsed.data.profilePostId ?? parsed.data.communityPostId;
  const table = parsed.data.profilePostId ? "profile_posts" : "community_posts";
  const ownerColumn = parsed.data.profilePostId ? "author_id" : "author_id";
  const { data: post, error: postError } = await supabaseAdmin
    .from(table)
    .select(ownerColumn)
    .eq("id", postId)
    .maybeSingle();
  if (postError || !post || (post as { author_id?: string }).author_id !== userId) {
    res.status(403).json({ error: "That post is not yours" });
    return;
  }

  const { error } = await supabaseAdmin.from("quality_post_flags").insert({
    profile_post_id: parsed.data.profilePostId ?? null,
    community_post_id: parsed.data.communityPostId ?? null,
    author_id: userId,
    title: review.postTitle || null,
    excerpt: review.postExcerpt || review.reasons.map((reason) => reason.detail).join(" ").slice(0, 280),
    reasons: review.reasons,
  });
  if (error) {
    console.error("[Quality] Flag save failed:", error.message);
    res.status(503).json({ error: "The flag could not be saved" });
    return;
  }
  res.json({ ok: true });
});
