const INBOX_TTL_MS = 1000 * 60 * 30; // 30 minutes
const THREAD_TTL_MS = 1000 * 60 * 60; // 1 hour

type CacheEnvelope<T> = {
  timestamp: number;
  data: T;
};

function readEnvelope<T>(key: string, maxAgeMs: number): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed?.timestamp || Date.now() - parsed.timestamp > maxAgeMs) {
      return undefined;
    }
    return parsed.data;
  } catch {
    return undefined;
  }
}

function writeEnvelope<T>(key: string, data: T): void {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ timestamp: Date.now(), data } satisfies CacheEnvelope<T>),
    );
  } catch {
    /* ignore quota */
  }
}

export function inboxStorageKey(userId: string, role: string): string {
  return `messages_inbox_${userId}_${role}`;
}

export function threadStorageKey(userId: string, conversationId: string): string {
  return `messages_thread_${userId}_${conversationId}`;
}

/** @deprecated — reads legacy `messages_${userId}_${role}` inbox cache */
export function readLegacyInboxCache<T>(userId: string, role: string): T | undefined {
  try {
    const legacy = localStorage.getItem(`messages_${userId}_${role}`);
    if (!legacy) return undefined;
    const parsed = JSON.parse(legacy) as CacheEnvelope<{ conversations?: T }>;
    if (!parsed?.timestamp || Date.now() - parsed.timestamp > INBOX_TTL_MS) {
      return undefined;
    }
    return parsed.data?.conversations as T | undefined;
  } catch {
    return undefined;
  }
}

export function readInboxCache<T>(userId: string, role: string): T | undefined {
  return (
    readEnvelope<T>(inboxStorageKey(userId, role), INBOX_TTL_MS) ??
    readLegacyInboxCache<T>(userId, role)
  );
}

export function writeInboxCache<T>(userId: string, role: string, data: T): void {
  writeEnvelope(inboxStorageKey(userId, role), data);
  try {
    localStorage.setItem(
      `messages_${userId}_${role}`,
      JSON.stringify({
        timestamp: Date.now(),
        data: { conversations: data },
      }),
    );
  } catch {
    /* ignore */
  }
}

export function readThreadCache<T>(
  userId: string,
  conversationId: string,
): T | undefined {
  return readEnvelope<T>(threadStorageKey(userId, conversationId), THREAD_TTL_MS);
}

export function writeThreadCache<T>(
  userId: string,
  conversationId: string,
  data: T,
): void {
  writeEnvelope(threadStorageKey(userId, conversationId), data);
}
