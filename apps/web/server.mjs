/**
 * Production server for Render (and other Node hosts).
 * Serves the Vite build and returns Open Graph HTML to link-preview crawlers
 * for `/community/feed?post={uuid}`.
 */
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");

const BOT_UA =
  /bot|facebookexternalhit|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|applebot|Pinterest|Google-InspectionTool/i;

const PROFILE_POST_UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

function parsePostId(raw) {
  if (!raw || typeof raw !== "string") return null;
  const match = raw.trim().match(PROFILE_POST_UUID_RE);
  return match ? match[0].toLowerCase() : null;
}

function apiBaseUrl() {
  return (
    process.env.API_BASE_URL ||
    process.env.OG_API_BASE_URL ||
    process.env.VITE_API_BASE_URL ||
    ""
  ).replace(/\/$/, "");
}

const app = express();

app.get("/community/feed", async (req, res, next) => {
  const postId = parsePostId(req.query.post);
  const ua = req.get("user-agent") ?? "";
  if (!postId || !BOT_UA.test(ua)) {
    next();
    return;
  }

  const apiBase = apiBaseUrl();
  if (!apiBase) {
    next();
    return;
  }

  try {
    const ogRes = await fetch(
      `${apiBase}/api/og/profile-post/${encodeURIComponent(postId)}`,
      { headers: { Accept: "text/html" } },
    );
    if (!ogRes.ok) {
      next();
      return;
    }
    const html = await ogRes.text();
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=300");
    res.send(html);
  } catch {
    next();
  }
});

app.use(
  express.static(distDir, {
    index: false,
    maxAge: "1h",
  }),
);

app.get("*", (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Web app listening on port ${port}`);
});
