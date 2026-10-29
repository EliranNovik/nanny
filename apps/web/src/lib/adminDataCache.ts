import { apiGet } from "@/lib/api";

const CACHE_PREFIX = "admin-data:v2:";
const DEFAULT_TTL_MS = 5 * 60 * 1000;

type CacheEntry<T> = {
  savedAt: number;
  data: T;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

function readEntry<T>(key: string): CacheEntry<T> | null {
  const memory = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (memory) return memory;

  try {
    const storageKey = `${CACHE_PREFIX}${key}`;
    const stored = JSON.parse(
      sessionStorage.getItem(storageKey) ||
        (key === "dashboard"
          ? sessionStorage.getItem("admin-dashboard:v2")
          : null) ||
        "null",
    ) as CacheEntry<T> | null;
    if (!stored?.savedAt || stored.data == null) return null;
    memoryCache.set(key, stored);
    return stored;
  } catch {
    return null;
  }
}

function writeEntry<T>(key: string, data: T): CacheEntry<T> {
  const entry = { savedAt: Date.now(), data };
  memoryCache.set(key, entry);
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
    if (key === "dashboard") {
      sessionStorage.setItem("admin-dashboard:v2", JSON.stringify(entry));
    }
  } catch {
    // Caching is optional.
  }
  return entry;
}

export function getCachedAdminData<T>(key: string): T | null {
  return readEntry<T>(key)?.data ?? null;
}

export async function getAdminData<T>(
  key: string,
  url: string,
  options: { force?: boolean; ttlMs?: number } = {},
): Promise<T> {
  const cached = readEntry<T>(key);
  const ttl = options.ttlMs ?? DEFAULT_TTL_MS;
  if (!options.force && cached && Date.now() - cached.savedAt < ttl) {
    return cached.data;
  }

  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const request = apiGet<T>(url)
    .then((data) => writeEntry(key, data).data)
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

export function invalidateAdminData(key: string) {
  memoryCache.delete(key);
  try {
    sessionStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } catch {
    // Caching is optional.
  }
}

export function invalidateAdminDataPrefix(prefix: string) {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) memoryCache.delete(key);
  }
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const storageKey = sessionStorage.key(index);
      if (storageKey?.startsWith(`${CACHE_PREFIX}${prefix}`)) {
        sessionStorage.removeItem(storageKey);
      }
    }
  } catch {
    // Caching is optional.
  }
}
