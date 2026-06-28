import type { Context } from "@netlify/edge-functions";

const BOT_UA =
  /bot|facebookexternalhit|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|applebot|Pinterest|Google-InspectionTool/i;

const PROFILE_POST_UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

function parseShareId(raw: string | null): string | null {
  if (!raw) return null;
  const match = raw.trim().match(PROFILE_POST_UUID_RE);
  return match ? match[0].toLowerCase() : null;
}

export default async function handler(request: Request, context: Context) {
  const url = new URL(request.url);
  const ua = request.headers.get("user-agent") ?? "";
  if (!BOT_UA.test(ua)) {
    return context.next();
  }

  let apiPath: string | null = null;

  if (url.pathname.startsWith("/posts/")) {
    const postId = parseShareId(url.pathname.slice("/posts/".length));
    if (postId) {
      apiPath = `/api/og/profile-post/${encodeURIComponent(postId)}`;
    }
  } else if (url.pathname.startsWith("/requests/")) {
    const requestId = parseShareId(url.pathname.slice("/requests/".length));
    if (requestId) {
      apiPath = `/api/og/job-request/${encodeURIComponent(requestId)}`;
    }
  } else if (url.pathname === "/community/feed") {
    const postId = parseShareId(url.searchParams.get("post"));
    const requestId = parseShareId(url.searchParams.get("request"));
    if (postId) {
      apiPath = `/api/og/profile-post/${encodeURIComponent(postId)}`;
    } else if (requestId) {
      apiPath = `/api/og/job-request/${encodeURIComponent(requestId)}`;
    }
  }

  if (!apiPath) {
    return context.next();
  }

  const apiBase =
    Netlify.env.get("API_BASE_URL") ||
    Netlify.env.get("OG_API_BASE_URL") ||
    Netlify.env.get("VITE_API_BASE_URL");
  if (!apiBase) {
    return context.next();
  }

  try {
    const ogUrl = `${apiBase.replace(/\/$/, "")}${apiPath}`;
    const ogRes = await fetch(ogUrl, {
      headers: { Accept: "text/html" },
    });
    if (!ogRes.ok) {
      return context.next();
    }

    const html = await ogRes.text();
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return context.next();
  }
}

export const config = {
  path: ["/community/feed", "/posts/*", "/requests/*"],
};
