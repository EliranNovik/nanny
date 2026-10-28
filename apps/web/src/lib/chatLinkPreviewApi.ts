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

function screenshotFallback(url: string): ChatLinkPreviewApiPayload | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    return {
      ok: true,
      url: parsed.href,
      title: host,
      description: null,
      image: `https://image.thum.io/get/width/1200/crop/675/noanimate/${parsed.href}`,
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
        image: `https://image.thum.io/get/width/1200/crop/675/noanimate/${parsed.origin}/`,
        imageToken: null,
        siteName: "tebnu.com",
      };
    }
  } catch {
    // Continue with the generic preview flow.
  }

  try {
    const response = await fetch(
      `https://api.microlink.io/?url=${encodeURIComponent(url)}&meta=true&screenshot=true`,
    );
    if (response.ok) {
      const payload = (await response.json()) as {
        status?: string;
        data?: Record<string, any>;
      };
      if (payload.status === "success" && payload.data) {
        const page = payload.data;
        const finalUrl =
          typeof page.url === "string" && page.url ? page.url : url;
        const host = new URL(finalUrl).hostname.replace(/^www\./, "");
        const isTebnuLanding =
          host === "tebnu.com" || host.endsWith(".tebnu.com");
        const candidates = [
          { value: page.image, score: 100 },
          { value: page.screenshot, score: isTebnuLanding ? 160 : 60 },
          { value: page.logo, score: 40 },
        ]
          .map(({ value, score }) => {
            const imageUrl =
              typeof value === "string" ? value : value?.url;
            if (!imageUrl) return null;
            const width = Number(value?.width ?? 0);
            const height = Number(value?.height ?? 0);
            const size = Number(value?.size ?? 0);
            let adjusted = score;
            if (width > 0 && height > 0 && width * height < 20_000) adjusted -= 40;
            if (size > 0 && size < 2_000) adjusted -= 30;
            if (width >= 400 || height >= 200) adjusted += 20;
            if (/placeholder|sprite|pixel|1x1|blank/i.test(imageUrl)) adjusted -= 50;
            try {
              return {
                url: new URL(imageUrl, finalUrl).href,
                score: adjusted,
              };
            } catch {
              return null;
            }
          })
          .filter(
            (candidate): candidate is { url: string; score: number } =>
              Boolean(candidate),
          )
          .sort((a, b) => b.score - a.score);
        const image =
          candidates[0]?.score > 0
            ? candidates[0].url
            : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
        return {
          ok: true,
          url: finalUrl,
          title:
            (typeof page.title === "string" && page.title) || host || url,
          description:
            typeof page.description === "string" ? page.description : null,
          image,
          imageToken: null,
          siteName:
            (typeof page.publisher === "string" && page.publisher) || host,
        };
      }
    }
  } catch {
    // Fall through to the authenticated server-side preview service.
  }

  const token = await getAccessTokenSafely();
  if (!token) return screenshotFallback(url);

  try {
    const res = await fetch(`${base}/api/link-preview`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    if (!res.ok) return screenshotFallback(url);

    const preview = (await res.json()) as ChatLinkPreviewApiPayload;
    if (preview.image || preview.imageToken) return preview;
    return screenshotFallback(preview.url || url) ?? preview;
  } catch {
    return screenshotFallback(url);
  }
}
