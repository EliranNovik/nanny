/**
 * Fetch public HTML safely (minimal SSRF hardening + OG / title parsing).
 */

/** Browser-like UA improves OG tags from many sites (vs. generic “bot” strings). */
export const LINK_PREVIEW_FETCH_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const MAX_HTML_BYTES = 450_000;
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 45 * 60 * 1000;
const CACHE_MAX = 250;

export interface PreviewPayload {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

const previewCache = new Map<string, { exp: number; value: PreviewPayload }>();

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h === "metadata.google.internal" ||
    h === "kubernetes.default" ||
    h === "0.0.0.0"
  )
    return true;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
    return false;
  }

  if (h.includes(":") && (h.startsWith("[") || h.includes("::")))
    return true;

  return false;
}

export function assertSafeHttpUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:")
    throw new Error("Unsupported protocol");
  if (u.username || u.password) throw new Error("URL credentials not allowed");
  if (!u.hostname) throw new Error("Missing host");
  if (isBlockedHostname(u.hostname)) throw new Error("Host blocked");
  return u;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, d) =>
      String.fromCodePoint(Number.parseInt(d, 10)),
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractMeta(html: string, keys: Set<string>): Map<string, string> {
  const out = new Map<string, string>();
  const re = /<meta\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const propM = /\bproperty\s*=\s*["']([^"']+)["']/i.exec(tag);
    const nameM = /\bname\s*=\s*["']([^"']+)["']/i.exec(tag);
    const contentM = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(tag);
    const content = contentM?.[1];
    const keyRaw = propM?.[1] ?? nameM?.[1];
    if (!content || !keyRaw) continue;
    const key = keyRaw.trim().toLowerCase();
    if (!keys.has(key) || out.has(key)) continue;
    out.set(key, content.trim());
  }
  return out;
}

function extractTitle(html: string): string | null {
  const tm = /<title\b[^>]*>([^<]*)<\/title>/i.exec(html);
  if (!tm?.[1]) return null;
  const t = decodeHtmlEntities(tm[1].trim().replace(/\s+/g, " "));
  return t || null;
}

function resolveMaybeRelative(url: string | null | undefined, base: URL): string | null {
  if (!url?.trim()) return null;
  const t = url.trim();
  try {
    if (t.startsWith("//")) return new URL(`https:${t}`).href;
    const r = new URL(t, base);
    assertSafeHttpUrl(r.href);
    return r.href;
  } catch {
    return null;
  }
}

function cachePut(key: string, value: PreviewPayload) {
  if (previewCache.size >= CACHE_MAX) previewCache.clear();
  const exp = Date.now() + CACHE_TTL_MS;
  previewCache.set(key, { exp, value });
}

export async function fetchLinkPreview(seedUrl: string): Promise<PreviewPayload> {
  assertSafeHttpUrl(seedUrl);

  const cached = previewCache.get(seedUrl);
  if (cached && cached.exp > Date.now()) return cached.value;

  const keys = new Set([
    "og:title",
    "og:description",
    "og:image",
    "og:site_name",
    "twitter:title",
    "twitter:description",
    "twitter:image",
    "twitter:image:src",
    "description",
  ]);

  let current = seedUrl;
  let finalUrl = seedUrl;
  let body: ArrayBuffer | null = null;
  let contentType = "";

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertSafeHttpUrl(current);
    const res = await fetch(current, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": LINK_PREVIEW_FETCH_UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("Redirect without Location");
      current = new URL(loc, current).href;
      continue;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    finalUrl = current;
    contentType = res.headers.get("content-type") ?? "";
    body = await res.arrayBuffer();
    break;
  }

  if (!body)
    throw new Error("Too many redirects or empty response");

  const base = new URL(finalUrl);
  const hostLabel = base.hostname.replace(/^www\./, "");

  const isProbablyHtml =
    contentType.includes("text/html") ||
    contentType.includes("application/xhtml");

  const htmlSnippet = new TextDecoder("utf-8", { fatal: false }).decode(
    body.slice(0, Math.min(body.byteLength, MAX_HTML_BYTES)),
  );

  if (!isProbablyHtml && !/<html\b|<!doctype|<head\b|<meta\b/i.test(htmlSnippet.slice(0, 2500))) {
    const fallback: PreviewPayload = {
      url: finalUrl.split("#")[0],
      title: hostLabel || null,
      description: null,
      image: null,
      siteName: hostLabel || null,
    };
    cachePut(seedUrl, fallback);
    return fallback;
  }

  const meta = extractMeta(htmlSnippet, keys);

  const rawOgTitle =
    meta.get("og:title") || meta.get("twitter:title") || "";
  const titleFromMeta = rawOgTitle
    ? decodeHtmlEntities(rawOgTitle.replace(/\s+/g, " ").trim())
    : "";
  const title =
    titleFromMeta ||
    extractTitle(htmlSnippet) ||
    hostLabel ||
    null;

  const descriptionRaw =
    meta.get("og:description") ||
    meta.get("twitter:description") ||
    meta.get("description") ||
    "";
  const description = descriptionRaw
    ? decodeHtmlEntities(descriptionRaw.replace(/\s+/g, " ").trim())
    : null;

  const imgRaw =
    meta.get("og:image") ||
    meta.get("twitter:image") ||
    meta.get("twitter:image:src") ||
    "";
  const image = resolveMaybeRelative(decodeHtmlEntities(imgRaw).trim(), base);

  const siteRaw = meta.get("og:site_name") || "";
  const siteName =
    (siteRaw ? decodeHtmlEntities(siteRaw.trim()) : null) || hostLabel || null;

  const payload: PreviewPayload = {
    url: finalUrl.split("#")[0],
    title: title && title.length > 300 ? `${title.slice(0, 297)}…` : title,
    description:
      description && description.length > 480
        ? `${description.slice(0, 477)}…`
        : description,
    image,
    siteName,
  };

  cachePut(seedUrl, payload);

  return payload;
}
