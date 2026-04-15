import { useState, useEffect } from "react";

export type RecentItem = {
  id: string;
  kind: "person" | "page" | "action" | "category";
  title: string;
  subtitle?: string;
  to: string;
  icon?: string; // Icon name string if needed, or we just rely on kind/metadata
  timestamp: number;
};

const STORAGE_KEY = "nanny_recent_searches";
const MAX_ITEMS = 5;

export function useRecentSearchStore() {
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setRecentItems(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse recent searches", e);
      }
    }
  }, []);

  const addRecent = (item: Omit<RecentItem, "timestamp">) => {
    setRecentItems((prev) => {
      // Remove existing to avoid duplicates, then add new at top
      const filtered = prev.filter((i) => i.id !== item.id);
      const updated = [{ ...item, timestamp: Date.now() }, ...filtered].slice(
        0,
        MAX_ITEMS,
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const clearRecent = () => {
    setRecentItems([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return { recentItems, addRecent, clearRecent };
}
