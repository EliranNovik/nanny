import { Router, type Request, type Response } from "express";
import {
  buildJobRequestOgHtml,
  fetchJobRequestOgMeta,
  parseJobRequestShareId,
} from "../lib/jobRequestOg";

export const ogJobRequestRouter = Router();

/** Public HTML with Open Graph tags for shared help requests. */
ogJobRequestRouter.get("/job-request/:requestId", async (req: Request, res: Response) => {
  const requestId = parseJobRequestShareId(req.params.requestId);
  if (!requestId) {
    res.status(400).send("Invalid request id");
    return;
  }

  const meta = await fetchJobRequestOgMeta(requestId);
  if (!meta) {
    res.status(404).send("Request not found");
    return;
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
  res.send(buildJobRequestOgHtml(meta));
});
