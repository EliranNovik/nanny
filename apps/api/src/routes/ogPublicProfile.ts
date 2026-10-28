import { Router, type Request, type Response } from "express";
import {
  buildPublicProfileOgHtml,
  fetchPublicProfileOgMeta,
} from "../lib/publicProfileOg";

export const ogPublicProfileRouter = Router();

ogPublicProfileRouter.get("/profile/:id", async (req: Request, res: Response) => {
  const meta = await fetchPublicProfileOgMeta(req.params.id);
  if (!meta) {
    res.status(404).send("Profile not found");
    return;
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
  res.send(buildPublicProfileOgHtml(meta));
});
