import { supabase } from "@/lib/supabase";

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

/**
 * Resolved Open Graph preview for a URL (authenticated; server-side fetch).
 */
export async function fetchChatLinkPreview(
  url: string,
): Promise<ChatLinkPreviewApiPayload | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;

  try {
    const res = await fetch(`${base}/api/link-preview`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    if (!res.ok) return null;

    return (await res.json()) as ChatLinkPreviewApiPayload;
  } catch {
    return null;
  }
}
