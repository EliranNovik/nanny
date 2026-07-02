import { PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { publicProfileMediaPublicUrl } from "@/lib/publicProfileMedia";
import { getServiceCategoryImage, isServiceCategoryId } from "@/lib/serviceCategories";

export type PublicProfileServiceBoardPost = {
  id: string;
  caption: string | null;
  media_type: "image" | "video" | null;
  storage_path: string | null;
  created_at: string;
  post_type_id?: string | null;
  post_metadata?: {
    category?: string | null;
    service?: string | null;
    custom_category?: string | null;
  } | null;
  ai_generated_copy?: { short_text?: string | null } | null;
  post_types?: {
    id: string;
    name?: string | null;
    emoji?: string | null;
  } | null;
};

function categoryIdFromPost(post: PublicProfileServiceBoardPost): string | null {
  const meta = post.post_metadata;
  if (!meta) return null;
  if (post.post_type_id === "request_help") return meta.category ?? null;
  if (post.post_type_id === "offer_service") return meta.service ?? null;
  return meta.category ?? meta.service ?? null;
}

function serviceBoardThumbUrl(post: PublicProfileServiceBoardPost): string {
  if (post.storage_path) {
    return publicProfileMediaPublicUrl(post.storage_path);
  }
  const categoryId = categoryIdFromPost(post);
  if (categoryId && isServiceCategoryId(categoryId)) {
    return getServiceCategoryImage(categoryId);
  }
  return getServiceCategoryImage("other_help");
}

export function serviceBoardPostPreview(
  post: PublicProfileServiceBoardPost,
): string {
  const fromAi = post.ai_generated_copy?.short_text?.trim();
  const fromCaption = post.caption?.trim();
  return fromAi || fromCaption || "View post";
}

function serviceBoardPostTypeLabel(post: PublicProfileServiceBoardPost): string {
  const typeName = post.post_types?.name?.trim();
  if (typeName) return typeName;
  switch (post.post_type_id) {
    case "request_help":
      return "Request";
    case "offer_service":
      return "Offer";
    case "event":
      return "Event";
    default:
      return "Post";
  }
}

export function PublicProfileServiceBoard({
  posts,
  onPostOpen,
  className,
}: {
  posts: PublicProfileServiceBoardPost[];
  onPostOpen: (postId: string) => void;
  className?: string;
}) {
  if (posts.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2 text-center bg-slate-50/50 dark:bg-white/5 rounded-2xl">
        No posts yet.
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {posts.map((post) => {
        const thumb = serviceBoardThumbUrl(post);
        const isVideo = post.media_type === "video" && Boolean(post.storage_path);
        const preview = serviceBoardPostPreview(post);
        const typeLabel = serviceBoardPostTypeLabel(post);

        return (
          <button
            key={post.id}
            type="button"
            onClick={() => onPostOpen(post.id)}
            className={cn(
              "group flex w-full items-start gap-3 rounded-2xl border border-slate-100/50 bg-white/60 p-3 text-left transition-all",
              "hover:bg-white dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/10",
              "outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30",
            )}
          >
            <div className="relative h-[72px] w-[96px] shrink-0 overflow-hidden rounded-xl bg-slate-200 dark:bg-zinc-800">
              {isVideo ? (
                <>
                  <video
                    src={thumb}
                    className="absolute inset-0 h-full w-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
                    <PlayCircle
                      className="h-8 w-8 text-white drop-shadow-md"
                      strokeWidth={2.25}
                      aria-hidden
                    />
                  </div>
                </>
              ) : (
                <img
                  src={thumb}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                />
              )}
            </div>
            <div className="min-w-0 flex-1 py-0.5">
              <p className="line-clamp-2 text-[13px] font-bold leading-snug text-slate-900 dark:text-white group-hover:text-orange-600 transition-colors">
                {preview}
              </p>
              <p className="mt-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                {typeLabel}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
