export type ProfilePostMediaItem = {
  storage_path: string;
  media_type: "image" | "video";
};

export const MAX_PROFILE_POST_MEDIA = 10;

/** All media for a post (primary column + optional extras in post_metadata.media_items). */
export function getProfilePostMediaItems(post: {
  media_type: "image" | "video" | null;
  storage_path: string | null;
  post_metadata?: unknown;
}): ProfilePostMediaItem[] {
  const items: ProfilePostMediaItem[] = [];
  const seen = new Set<string>();

  const push = (storage_path: string | null | undefined, media_type: unknown) => {
    if (!storage_path || typeof storage_path !== "string") return;
    if (media_type !== "image" && media_type !== "video") return;
    if (seen.has(storage_path)) return;
    seen.add(storage_path);
    items.push({ storage_path, media_type });
  };

  push(post.storage_path, post.media_type);

  const meta = post.post_metadata as Record<string, unknown> | null | undefined;
  const extra = meta?.media_items;
  if (Array.isArray(extra)) {
    for (const raw of extra) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      push(row.storage_path as string, row.media_type);
    }
  }

  return items;
}

/** Media after the first item (shown as stacked thumbnails on the main media). */
export function extraProfilePostMediaItems(
  items: ProfilePostMediaItem[],
): ProfilePostMediaItem[] {
  return items.slice(1);
}

export function allProfilePostStoragePaths(
  post: Parameters<typeof getProfilePostMediaItems>[0],
): string[] {
  return getProfilePostMediaItems(post).map((item) => item.storage_path);
}
