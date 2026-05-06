import {
  assertSafeHttpUrl,
  LINK_PREVIEW_FETCH_UA,
} from "./linkPreviewFetcher";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_REDIRECTS = 5;
const TIMEOUT_MS = 12_000;

function refererForImageUrl(imgUrl: string): string {
  try {
    const h = new URL(imgUrl).hostname.toLowerCase();
    if (h.includes("fbcdn.") || h.includes("facebook.") || h === "facebook.com")
      return "https://www.facebook.com/";
    if (
      h.includes("googleusercontent.") ||
      h.includes("google.com") ||
      h.includes("gstatic.")
    )
      return "https://www.google.com/";
    if (h.includes("twimg.")) return "https://twitter.com/";
    return new URL(imgUrl).origin + "/";
  } catch {
    return "https://www.google.com/";
  }
}

export async function fetchRemoteImageSafe(
  imageUrl: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  let current = imageUrl;

  for (let hop = 0; hop <= MAX_IMAGE_REDIRECTS; hop++) {
    assertSafeHttpUrl(current);
    const res = await fetch(current, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": LINK_PREVIEW_FETCH_UA,
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: refererForImageUrl(current),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      current = new URL(loc, current).href;
      continue;
    }

    if (!res.ok) return null;

    const ct = (res.headers.get("content-type") || "").split(";")[0].trim();
    if (!ct.startsWith("image/")) return null;

    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_IMAGE_BYTES) return null;

    return { buffer: Buffer.from(ab), contentType: ct };
  }

  return null;
}
