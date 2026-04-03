const storageKey = (userId: string) => `inbox_hidden_chat_users_v1_${userId}`;

export function loadHiddenChatUserIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function persistHiddenChatUserIds(
  userId: string,
  ids: Set<string>
): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}
