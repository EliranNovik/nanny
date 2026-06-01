/**
 * Serve Open Graph HTML to link-preview crawlers (WhatsApp, iMessage, etc.)
 * for `/community/feed?post={uuid}` while regular users still get the SPA.
 */
const BOT_UA =
  /bot|facebookexternalhit|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|applebot|Pinterest|Google-InspectionTool/i;

const PROFILE_POST_UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

function parsePostId(raw: string | null): string | null {
  if (!raw) return null;
  const match = raw.trim().match(PROFILE_POST_UUID_RE);
  return match ? match[0].toLowerCase() : null;
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (url.pathname !== "/community/feed") return undefined;

  const postId = parsePostId(url.searchParams.get("post"));
  if (!postId) return undefined;

  const ua = request.headers.get("user-agent") ?? "";
  if (!BOT_UA.test(ua)) return undefined;

  const apiBase =
    process.env.API_BASE_URL ||
    process.env.OG_API_BASE_URL ||
    process.env.VITE_API_BASE_URL;
  if (!apiBase) return undefined;

  try {
    const ogUrl = `${apiBase.replace(/\/$/, "")}/api/og/profile-post/${encodeURIComponent(postId)}`;
    const ogRes = await fetch(ogUrl, {
      headers: { Accept: "text/html" },
    });
    if (!ogRes.ok) return undefined;

    const html = await ogRes.text();
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return undefined;
  }
}

export const config = {
  matcher: "/community/feed",
};
