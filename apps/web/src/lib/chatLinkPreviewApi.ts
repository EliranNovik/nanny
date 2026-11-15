import { getSupabaseSession } from "@/lib/supabase";

export type ChatLinkPreviewApiPayload =
  | {
      ok: true;
      url: string;
      title: string | null;
      description: string | null;
      image: string | null;
      /** Signed token for GET `/api/link-preview/image` (older clients may omit). */
      imageToken?: string | null;
      siteName: string | null;
    }
  | {
      ok: false;
      url: string;
      title: string | null;
      description: string | null;
      image: string | null;
      imageToken?: string | null;
      siteName: string | null;
      error?: string;
    };

const base = import.meta.env.DEV &&
  (!import.meta.env.VITE_API_BASE_URL?.trim() ||
    import.meta.env.VITE_API_BASE_URL.includes("localhost:4000") ||
    import.meta.env.VITE_API_BASE_URL.includes("127.0.0.1:4000"))
  ? ""
  : ((import.meta.env.VITE_API_BASE_URL || "http://localhost:4000") as string);
const previewRequests = new Map<
  string,
  Promise<ChatLinkPreviewApiPayload | null>
>();

/** Same origin as the preview POST, so the thumbnail proxy works in dev and production. */
export function chatLinkPreviewImageUrl(token: string): string {
  return `${base}/api/link-preview/image?token=${encodeURIComponent(token)}`;
}

function textOnlyPreview(url: string): ChatLinkPreviewApiPayload | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    return {
      ok: true,
      url: parsed.href,
      title: host,
      description: null,
      image: null,
      imageToken: null,
      siteName: host,
    };
  } catch {
    return null;
  }
}
async function getAccessTokenSafely(): Promise<string | null> {
  try {
    const { data } = await getSupabaseSession();
    return data.session?.access_token ?? null;
  } catch (error) {
    console.warn("[chat-link-preview] Session unavailable:", error);
    return null;
  }
}

/**
 * Resolved Open Graph preview for a URL (authenticated; server-side fetch).
 */
export async function fetchChatLinkPreview(
  url: string,
): Promise<ChatLinkPreviewApiPayload | null> {
  const pending = previewRequests.get(url);
  if (pending) return pending;
  const request = fetchChatLinkPreviewUncached(url);
  previewRequests.set(url, request);
  try {
    return await request;
  } finally {
    previewRequests.delete(url);
  }
}

async function fetchChatLinkPreviewUncached(
  url: string,
): Promise<ChatLinkPreviewApiPayload | null> {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "tebnu.com" || host.endsWith(".tebnu.com")) {
      return {
        ok: true,
        url: parsed.href,
        title: "Tebnu – Your Helper for Home & Life",
        description:
          "Find trusted local helpers, discover community support, or offer your skills.",
        image: "https://www.tebnu.com/images/landing-hero-babysitting.jpg",
        imageToken: null,
        siteName: "tebnu.com",
      };
    }
  } catch {
    // Continue with the generic preview flow.
  }

  const token = await getAccessTokenSafely();
  if (!token) return textOnlyPreview(url);

  try {
    const res = await fetch(`${base}/api/link-preview`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    if (!res.ok) return textOnlyPreview(url);

    const preview = (await res.json()) as ChatLinkPreviewApiPayload;
    if (preview?.url || preview?.title) return preview;
    return textOnlyPreview(url);
  } catch {
    return textOnlyPreview(url);
  }
}
