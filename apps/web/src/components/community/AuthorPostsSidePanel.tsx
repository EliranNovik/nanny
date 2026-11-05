import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Eye, Loader2, PlayCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { FeedPost } from "@/components/profile/ProfilePostsFeed";
import type { DiscoverOpenHelpRequestRow } from "@/hooks/data/useDiscoverOpenHelpRequests";
import {
  categoryIllustrationSrc,
  helpCategoryIdFromServiceDetails,
} from "@/lib/discoverCategoryTileIcons";
import { jobRequestImageUrls } from "@/lib/openHelpRequestFeedPost";
import { publicProfileMediaPublicUrl } from "@/lib/publicProfileMedia";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type PanelItem = {
  id: string;
  source: "post" | "job_request";
  postTypeId: string;
  title: string;
  createdAt: string;
  mediaType: "image" | "video" | null;
  thumbUrl: string | null;
};

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "Member";
}

function relativeDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  if (days === 0) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(0, "day");
  if (days < 7) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-days, "day");
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(date);
}

function categoryIdFromPostMeta(
  postTypeId: string,
  meta: Record<string, unknown> | null | undefined,
  customCategory: string | null | undefined,
): string | null {
  if (typeof meta?.service === "string" && meta.service.trim()) return meta.service.trim();
  if (typeof meta?.category === "string" && meta.category.trim()) return meta.category.trim();
  if (typeof meta?.custom_category === "string" && meta.custom_category.trim()) {
    return meta.custom_category.trim();
  }
  if (customCategory?.trim()) return customCategory.trim();
  if (postTypeId === "event") return "event_help";
  if (postTypeId === "community") return "other_help";
  return postTypeId || null;
}

function requestThumbUrl(row: DiscoverOpenHelpRequestRow): string {
  const details = row.service_details;
  if (details && typeof details === "object") {
    const fromImages = jobRequestImageUrls(
      details as Record<string, unknown>,
    )[0];
    if (fromImages) return fromImages;
  }
  return categoryIllustrationSrc(
    row.service_type,
    helpCategoryIdFromServiceDetails(row.service_details),
  );
}

export function AuthorPostsSidePanel({ post }: { post: FeedPost }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const authorId = post.author_id;
  const authorName = post.author?.full_name?.trim() || t("common.member", { defaultValue: "Member" });

  const { data: items = [], isPending } = useQuery({
    queryKey: ["post-detail-author-posts", authorId],
    staleTime: 60_000,
    queryFn: async (): Promise<PanelItem[]> => {
      const [profilePostsResult, requestsResult] = await Promise.all([
        supabase
          .from("profile_posts")
          .select(
            "id, caption, created_at, post_type_id, ai_generated_copy, media_type, storage_path, post_metadata, custom_category",
          )
          .eq("author_id", authorId)
          .order("created_at", { ascending: false })
          .limit(60),
        supabase.rpc("get_discover_open_help_requests", { p_limit: 200 }),
      ]);
      if (profilePostsResult.error) throw profilePostsResult.error;
      if (requestsResult.error) throw requestsResult.error;

      const profileItems: PanelItem[] = (profilePostsResult.data ?? []).map((row) => {
        const copy = row.ai_generated_copy as { title?: string } | null;
        const storagePath =
          typeof row.storage_path === "string" && row.storage_path.trim()
            ? row.storage_path.trim()
            : null;
        const mediaType =
          row.media_type === "video" || row.media_type === "image"
            ? row.media_type
            : storagePath
              ? "image"
              : null;
        const postTypeId = String(row.post_type_id || "community");
        const meta =
          row.post_metadata && typeof row.post_metadata === "object"
            ? (row.post_metadata as Record<string, unknown>)
            : null;
        const categoryId = categoryIdFromPostMeta(
          postTypeId,
          meta,
          typeof row.custom_category === "string" ? row.custom_category : null,
        );
        return {
          id: String(row.id),
          source: "post",
          postTypeId,
          title:
            String(row.caption || "").trim() ||
            copy?.title?.trim() ||
            t("feed.postType.community", { defaultValue: "Community" }),
          createdAt: String(row.created_at),
          mediaType,
          thumbUrl: storagePath
            ? publicProfileMediaPublicUrl(storagePath)
            : categoryIllustrationSrc(categoryId),
        };
      });
      const requestItems: PanelItem[] = ((requestsResult.data ?? []) as DiscoverOpenHelpRequestRow[])
        .filter((row) => row.client_id === authorId)
        .map((row) => ({
          id: row.id,
          source: "job_request",
          postTypeId: "request_help",
          title:
            String(row.notes || "").trim() ||
            t("feed.postType.request_help", { defaultValue: "Request" }),
          createdAt: String(row.created_at || ""),
          mediaType: null,
          thumbUrl: requestThumbUrl(row),
        }));

      return [...profileItems, ...requestItems]
        .filter(
          (item, index, all) =>
            all.findIndex(
              (candidate) => candidate.id === item.id && candidate.source === item.source,
            ) === index,
        )
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    },
  });

  const currentKey = `${post.source}:${post.id}`;
  const countLabel = useMemo(
    () => t("postDetailPanel.count", { count: items.length, defaultValue: `${items.length} posts` }),
    [items.length, t],
  );

  return (
    <aside className="flex h-[100dvh] w-[380px] shrink-0 flex-col border-s border-black/[0.07] bg-white dark:border-white/[0.08] dark:bg-black">
      <header className="flex items-center gap-3 border-b border-black/[0.07] px-[18px] pb-3.5 pt-[calc(env(safe-area-inset-top,0px)+14px)] dark:border-white/[0.08]">
        <Avatar className="h-11 w-11">
          <AvatarImage src={post.author?.photo_url || undefined} alt="" className="object-cover" />
          <AvatarFallback className="bg-orange-500/15 font-bold text-orange-600 dark:text-orange-400">
            {authorName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-extrabold tracking-[-0.4px] text-zinc-900 dark:text-zinc-50">
            {t("postDetailPanel.title", {
              name: firstName(authorName),
              defaultValue: `Posts by ${firstName(authorName)}`,
            })}
          </h2>
          <p className="mt-0.5 text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
            {isPending ? " " : countLabel}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-3.5">
        {isPending ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm font-medium text-zinc-500">
            {t("postDetailPanel.empty", { defaultValue: "No posts yet" })}
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const selected = currentKey === `${item.source}:${item.id}`;
              return (
                <button
                  key={`${item.source}:${item.id}`}
                  type="button"
                  disabled={selected}
                  onClick={() =>
                    navigate(
                      item.source === "job_request"
                        ? `/open-requests/${item.id}`
                        : `/offers/${item.id}`,
                    )
                  }
                  className={cn(
                    "w-full rounded-[22px] border-[1.5px] bg-white p-3 text-start shadow-sm transition-transform hover:scale-[1.01] dark:bg-zinc-900",
                    selected ? "border-orange-500" : "border-transparent",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800">
                      {item.mediaType === "video" && item.thumbUrl ? (
                        <>
                          <video
                            src={item.thumbUrl}
                            className="absolute inset-0 h-full w-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
                            <PlayCircle
                              className="h-6 w-6 text-white drop-shadow"
                              strokeWidth={2.1}
                              aria-hidden
                            />
                          </span>
                        </>
                      ) : (
                        <img
                          src={
                            item.thumbUrl ||
                            categoryIllustrationSrc("other_help")
                          }
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[15px] font-bold leading-5 text-zinc-900 dark:text-zinc-100">
                        {item.title}
                      </span>
                      <span className="mt-2 flex items-center justify-between gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        <span>
                          {t(`feed.postType.${item.postTypeId}`, {
                            defaultValue: item.postTypeId,
                          })}
                        </span>
                        {selected ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-1 text-[11px] font-bold text-orange-600 dark:text-orange-400">
                            <Eye className="h-3 w-3" />{" "}
                            {t("postDetailPanel.viewing", { defaultValue: "Viewing" })}
                          </span>
                        ) : (
                          relativeDate(item.createdAt, i18n.language)
                        )}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
