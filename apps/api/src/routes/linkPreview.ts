import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  assertSafeHttpUrl,
  fetchLinkPreview,
} from "../lib/linkPreviewFetcher";
import { fetchRemoteImageSafe } from "../lib/fetchRemoteImage";
import {
  createLinkPreviewImageToken,
  parseLinkPreviewImageToken,
} from "../lib/linkPreviewImageToken";

export const linkPreviewRouter = Router();

/** Public (token-gated) thumbnail proxy — <img> cannot send Authorization. */
export async function handleLinkPreviewImageGet(
  req: Request,
  res: Response,
): Promise<void> {
  const token =
    typeof req.query.token === "string" ? req.query.token.trim() : "";
  if (!token) {
    res.status(400).json({ error: "Missing token" });
    return;
  }

  const resolved = parseLinkPreviewImageToken(token);
  if (!resolved) {
    res.status(403).json({ error: "Invalid or expired token" });
    return;
  }

  try {
    const img = await fetchRemoteImageSafe(resolved.url);
    if (!img) {
      res.status(404).end();
      return;
    }
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.type(img.contentType);
    res.send(img.buffer);
  } catch {
    res.status(502).end();
  }
}

function withImageToken<T extends { image: string | null }>(preview: T) {
  const imageToken = preview.image
    ? createLinkPreviewImageToken(preview.image)
    : null;
  return { ...preview, imageToken };
}

linkPreviewRouter.post("/", async (req: Request, res: Response) => {
  const parsed = z
    .object({
      url: z.string().trim().min(1).max(2048),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Invalid request body" });
    return;
  }

  let normalized: string;
  try {
    normalized = assertSafeHttpUrl(parsed.data.url).href.split("#")[0];
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.message || "Invalid URL" });
    return;
  }

  try {
    const preview = await fetchLinkPreview(normalized);
    res.json({ ok: true, ...withImageToken(preview) });
  } catch (e: any) {
    try {
      const u = new URL(normalized);
      const host = u.hostname.replace(/^www\./, "");
      res.json({
        ok: false,
        url: normalized,
        title: host,
        description: null,
        image: null,
        imageToken: null,
        siteName: host,
        error: e?.message || "Preview unavailable",
      });
    } catch {
      res.status(502).json({
        ok: false,
        error: e?.message || "Preview failed",
      });
    }
  }
});
