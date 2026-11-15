export type ChatLocationShare = {
  href: string;
  lat: number | null;
  lng: number | null;
  query: string;
  label: string;
};

const MAPS_HOST =
  /(^|\.)((maps\.google\.[a-z.]+)|(google\.[a-z.]+)|(maps\.app\.goo\.gl)|(goo\.gl))$/i;

function mapsUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!MAPS_HOST.test(url.hostname) && !/\/maps/i.test(url.pathname)) return null;
    if (
      url.hostname.includes("google.") ||
      url.hostname.includes("goo.gl") ||
      /\/maps/i.test(url.pathname)
    ) {
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

function coordsFromText(value: string): { lat: number; lng: number } | null {
  const match = value.match(/(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function coordsFromMapsUrl(url: URL): { lat: number; lng: number } | null {
  const fromQuery =
    coordsFromText(url.searchParams.get("q") || "") ||
    coordsFromText(url.searchParams.get("query") || "") ||
    coordsFromText(url.searchParams.get("ll") || "") ||
    coordsFromText(url.searchParams.get("center") || "");
  if (fromQuery) return fromQuery;
  const at = url.pathname.match(/@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/);
  if (!at) return null;
  return coordsFromText(`${at[1]},${at[2]}`);
}

/** A shared pin message, or any Google Maps link in the text. */
export function parseChatLocation(body: string | null | undefined): ChatLocationShare | null {
  const text = body?.trim() ?? "";
  if (!text) return null;
  const urlMatch = text.match(/https?:\/\/[^\s]+/i);
  const href = urlMatch?.[0]?.replace(/[),.;]+$/, "") ?? "";
  const url = href ? mapsUrl(href) : null;
  const startsWithPin = text.startsWith("📍");
  if (!url && !startsWithPin) return null;

  const coords = url ? coordsFromMapsUrl(url) : null;
  const label = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^https?:\/\//i.test(line))
    .join(" ")
    .replace(/^📍\s*/, "")
    .trim();
  const query = coords ? `${coords.lat},${coords.lng}` : label || url?.searchParams.get("q") || "";
  if (!query && !url) return null;

  return {
    href: url?.href ?? href,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    query,
    label: label || query,
  };
}

export function chatLocationEmbedUrl(location: ChatLocationShare): string {
  const params = new URLSearchParams({
    q: location.query,
    z: "16",
    output: "embed",
  });
  return `https://maps.google.com/maps?${params.toString()}`;
}
