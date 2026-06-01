import { Router, type Request, type Response } from "express";
import {
  buildProfilePostOgHtml,
  fetchProfilePostOgMeta,
  parseProfilePostShareId,
} from "../lib/profilePostOg";

export const ogProfilePostRouter = Router();

/** Public HTML with Open Graph tags for shared profile posts. */
ogProfilePostRouter.get("/profile-post/:postId", async (req: Request, res: Response) => {
  const postId = parseProfilePostShareId(req.params.postId);
  if (!postId) {
    res.status(400).send("Invalid post id");
    return;
  }

  const meta = await fetchProfilePostOgMeta(postId);
  if (!meta) {
    res.status(404).send("Post not found");
    return;
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
  res.send(buildProfilePostOgHtml(meta));
});
