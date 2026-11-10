import { storageImageUrl } from "@/lib/imageTransform";

const CACHE_NAME = "tebnu-chat-images-v1";
const DIMS_KEY = "tebnu-chat-image-dims-v1";
const MEMORY_MAX = 60;

export type CachedChatImage = {
  /** Blob URL when we have a local copy, otherwise the stable network URL. */
  url: string;
  width: number;
  height: number;
  local: boolean;
};

const memory = new Map<string, CachedChatImage>();
const inflight = new Map<string, Promise<CachedChatImage>>();

/** Stable, smaller URL. Same inputs always produce the same address so it can be cached. */
export function chatImageDisplayUrl(rawUrl: string): string {
  return storageImageUrl(rawUrl, {
    width: 960,
    quality: 78,
    resize: "contain",
    format: "webp",
  });
}

function readStoredDims(sourceUrl: string): { width: number; height: number } | null {
  try {
    const raw = sessionStorage.getItem(DIMS_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, { width?: number; height?: number }>;
    const row = map[sourceUrl];
    if (!row?.width || !row?.height) return null;
    return { width: row.width, height: row.height };
  } catch {
    return null;
  }
}

function writeStoredDims(sourceUrl: string, width: number, height: number) {
  try {
    const raw = sessionStorage.getItem(DIMS_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, { width: number; height: number }>) : {};
    map[sourceUrl] = { width, height };
    const keys = Object.keys(map);
    if (keys.length > 120) {
      for (const key of keys.slice(0, keys.length - 120)) delete map[key];
    }
    sessionStorage.setItem(DIMS_KEY, JSON.stringify(map));
  } catch {
    // Private mode can reject storage. The in-memory copy still works.
  }
}

function remember(sourceUrl: string, entry: CachedChatImage) {
  const previous = memory.get(sourceUrl);
  if (previous?.local && previous.url !== entry.url && previous.url.startsWith("blob:")) {
    URL.revokeObjectURL(previous.url);
  }
  memory.set(sourceUrl, entry);
  writeStoredDims(sourceUrl, entry.width, entry.height);
  if (memory.size <= MEMORY_MAX) return;
  const oldest = memory.keys().next().value as string | undefined;
  if (!oldest || oldest === sourceUrl) return;
  const dropped = memory.get(oldest);
  memory.delete(oldest);
  if (dropped?.local && dropped.url.startsWith("blob:")) URL.revokeObjectURL(dropped.url);
}

/** Already decoded in this tab. Safe to read during render. */
export function peekChatImage(sourceUrl: string): CachedChatImage | null {
  return memory.get(sourceUrl) ?? null;
}

/** Size from the last visit, so the frame does not jump while the file is read back. */
export function peekChatImageDims(sourceUrl: string): { width: number; height: number } | null {
  return memory.get(sourceUrl) ?? readStoredDims(sourceUrl);
}

function measure(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
        return;
      }
      reject(new Error("empty image"));
    };
    image.onerror = () => reject(new Error("image failed"));
    image.src = url;
  });
}

async function readCachedBlob(displayUrl: string): Promise<string | null> {
  if (typeof caches === "undefined") return null;
  const cache = await caches.open(CACHE_NAME);
  const match = await cache.match(displayUrl);
  if (!match) return null;
  const blob = await match.blob();
  if (!blob.size) return null;
  return URL.createObjectURL(blob);
}

async function storeResponse(displayUrl: string, response: Response) {
  if (typeof caches === "undefined" || !response.ok) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(displayUrl, response.clone());
  } catch {
    // Quota or a private window. The decoded copy in memory is enough for this visit.
  }
}

async function loadUncached(sourceUrl: string): Promise<CachedChatImage> {
  const displayUrl = chatImageDisplayUrl(sourceUrl);
  const localUrl = await readCachedBlob(displayUrl);
  if (localUrl) {
    const dims = await measure(localUrl);
    const entry = { url: localUrl, ...dims, local: true };
    remember(sourceUrl, entry);
    return entry;
  }

  let objectUrl = displayUrl;
  let local = false;
  try {
    const response = await fetch(displayUrl, { mode: "cors", credentials: "omit" });
    if (response.ok) {
      await storeResponse(displayUrl, response);
      const blob = await response.blob();
      if (blob.size > 0) {
        objectUrl = URL.createObjectURL(blob);
        local = true;
      }
    }
  } catch {
    objectUrl = displayUrl;
  }

  const dims = await measure(objectUrl);
  const entry = { url: objectUrl, ...dims, local };
  remember(sourceUrl, entry);
  return entry;
}

export function loadChatImage(sourceUrl: string): Promise<CachedChatImage> {
  const known = memory.get(sourceUrl);
  if (known) return Promise.resolve(known);
  const pending = inflight.get(sourceUrl);
  if (pending) return pending;
  const task = loadUncached(sourceUrl).finally(() => {
    inflight.delete(sourceUrl);
  });
  inflight.set(sourceUrl, task);
  return task;
}

/** Start downloads for the photos in a thread before their bubbles mount. */
export function warmChatImages(sourceUrls: string[]) {
  const seen = new Set<string>();
  for (const url of sourceUrls) {
    if (!url || seen.has(url) || memory.has(url)) continue;
    seen.add(url);
    if (seen.size > 24) break;
    void loadChatImage(url).catch(() => undefined);
  }
}
