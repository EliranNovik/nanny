/**
 * Production server for Render (and other Node hosts).
 * Serves OG HTML to crawlers for shared post/request URLs.
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

function parseShareId(raw) {
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

async function maybeServeOg(req, res, next, apiPath) {
  const ua = req.get("user-agent") ?? "";
  if (!BOT_UA.test(ua)) {
    next();
    return;
  }

  const apiBase = apiBaseUrl();
  if (!apiBase) {
    next();
    return;
  }

  try {
    const ogRes = await fetch(`${apiBase}${apiPath}`, {
      headers: { Accept: "text/html" },
    });
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
}

const app = express();

app.get("/posts/:id", (req, res, next) => {
  const postId = parseShareId(req.params.id);
  if (!postId) {
    next();
    return;
  }
  void maybeServeOg(
    req,
    res,
    next,
    `/api/og/profile-post/${encodeURIComponent(postId)}`,
  );
});

app.get("/requests/:id", (req, res, next) => {
  const requestId = parseShareId(req.params.id);
  if (!requestId) {
    next();
    return;
  }
  void maybeServeOg(
    req,
    res,
    next,
    `/api/og/job-request/${encodeURIComponent(requestId)}`,
  );
});

app.get("/community/feed", (req, res, next) => {
  const postId = parseShareId(req.query.post);
  const requestId = parseShareId(req.query.request);
  if (postId) {
    void maybeServeOg(
      req,
      res,
      next,
      `/api/og/profile-post/${encodeURIComponent(postId)}`,
    );
    return;
  }
  if (requestId) {
    void maybeServeOg(
      req,
      res,
      next,
      `/api/og/job-request/${encodeURIComponent(requestId)}`,
    );
    return;
  }
  next();
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
