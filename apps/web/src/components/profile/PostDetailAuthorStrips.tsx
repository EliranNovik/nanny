import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Star, Video } from "lucide-react";
import { ImageLightboxModal } from "@/components/ImageLightboxModal";
import { VideoLightboxModal } from "@/components/VideoLightboxModal";
import {
  ProfileReviewCarousel,
  ProfileReviewsSheet,
  type ProfileReviewItem,
} from "@/components/profile/ProfileReviewsSheet";
import {
  publicProfileMediaPublicUrl,
  publicProfileMediaUrl,
} from "@/lib/publicProfileMedia";
import { helpCategoryIdFromServiceDetails } from "@/lib/discoverCategoryTileIcons";
import { feedCategoryLabel } from "@/lib/globalFeedPostUi";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type MediaRow = {
  id: string;
  media_type: "image" | "video";
  storage_path: string;
};

function asReviewer(value: unknown): ProfileReviewItem["reviewer"] {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") {
    return { full_name: null, photo_url: null };
  }
  const reviewer = row as { full_name?: string | null; photo_url?: string | null };
  return {
    full_name: reviewer.full_name ?? null,
    photo_url: reviewer.photo_url ?? null,
  };
}

function MediaStrip({ items, onOpen }: { items: MediaRow[]; onOpen: (index: number) => void }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const syncEnds = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const left = Math.abs(el.scrollLeft);
    setCanPrev(left > 8);
    setCanNext(max > 8 && left < max - 8);
  };

  useEffect(() => {
    syncEnds();
  }, [items.length]);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Previous media"
        disabled={!canPrev}
        onClick={() => {
          const tile = scrollerRef.current?.querySelector<HTMLElement>("button");
          scrollerRef.current?.scrollBy({
            left: -((tile?.offsetWidth ?? 220) + 4),
            behavior: "smooth",
          });
        }}
        className="absolute start-2 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-35 md:flex dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100"
      >
        <ChevronLeft className="h-4 w-4 rtl-flip-icon" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Next media"
        disabled={!canNext}
        onClick={() => {
          const tile = scrollerRef.current?.querySelector<HTMLElement>("button");
          scrollerRef.current?.scrollBy({
            left: (tile?.offsetWidth ?? 220) + 4,
            behavior: "smooth",
          });
        }}
        className="absolute end-2 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-35 md:flex dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100"
      >
        <ChevronRight className="h-4 w-4 rtl-flip-icon" aria-hidden />
      </button>
      <div
        ref={scrollerRef}
        dir="ltr"
        onScroll={syncEnds}
        className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Profile media"
      >
        {items.map((row, index) => {
          const src = publicProfileMediaPublicUrl(row.storage_path);
          return (
            <button
              key={row.id}
              type="button"
              className={cn(
                "relative aspect-square min-w-0 overflow-hidden bg-black outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-orange-500",
                items.length <= 3
                  ? "flex-1 basis-0"
                  : "w-[calc((100%-8px)/3)] shrink-0",
              )}
              onClick={() => onOpen(index)}
              aria-label={row.media_type === "image" ? "View photo" : "View video"}
            >
              {row.media_type === "image" ? (
                <img
                  src={publicProfileMediaUrl(row.storage_path, {
                    width: 480,
                    height: 480,
                    quality: 80,
                    resize: "cover",
                  })}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <>
                  <video
                    src={src}
                    muted
                    playsInline
                    preload="metadata"
                    className="pointer-events-none h-full w-full object-cover"
                  />
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white">
                      <Video className="h-5 w-5" aria-hidden />
                    </span>
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Author reviews, then profile media, shown above comments on offer and request details. */
export function PostDetailAuthorStrips({ authorId }: { authorId: string }) {
  const { t, i18n } = useTranslation();
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [imageLightbox, setImageLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const { data: reviews = [] } = useQuery({
    queryKey: ["postDetailAuthorReviews", authorId, i18n.language],
    enabled: Boolean(authorId),
    staleTime: 60_000,
    queryFn: async (): Promise<ProfileReviewItem[]> => {
      const { data, error } = await supabase
        .from("job_reviews")
        .select(
          "id, job_id, rating, review_text, created_at, reviewer:profiles!reviewer_id(full_name, photo_url)",
        )
        .eq("reviewee_id", authorId)
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) throw error;
      const rows = data ?? [];
      const jobIds = [...new Set(rows.map((row) => row.job_id).filter(Boolean))] as string[];
      const categoryByJob = new Map<string, string>();
      if (jobIds.length > 0) {
        const { data: jobs } = await supabase
          .from("job_requests")
          .select("id, service_type, service_details")
          .in("id", jobIds);
        for (const job of jobs ?? []) {
          const serviceType = typeof job.service_type === "string" ? job.service_type : null;
          const details =
            job.service_details && typeof job.service_details === "object"
              ? (job.service_details as Record<string, unknown>)
              : null;
          if (!serviceType) continue;
          categoryByJob.set(
            job.id as string,
            feedCategoryLabel(t, serviceType, helpCategoryIdFromServiceDetails(details)),
          );
        }
      }
      return rows.map((row) => ({
        id: row.id as string,
        rating: Number(row.rating) || 0,
        review_text: (row.review_text as string | null) ?? null,
        created_at: row.created_at as string,
        reviewer: asReviewer(row.reviewer),
        categoryLabel: categoryByJob.get(row.job_id as string) ?? null,
      }));
    },
  });

  const { data: media = [] } = useQuery({
    queryKey: ["postDetailAuthorMedia", authorId],
    enabled: Boolean(authorId),
    staleTime: 60_000,
    queryFn: async (): Promise<MediaRow[]> => {
      const { data, error } = await supabase
        .from("public_profile_media")
        .select("id, media_type, storage_path")
        .eq("user_id", authorId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).flatMap((row) => {
        const type = row.media_type === "video" ? "video" : row.media_type === "image" ? "image" : null;
        const path = typeof row.storage_path === "string" ? row.storage_path : "";
        if (!type || !path) return [];
        return [{ id: row.id as string, media_type: type, storage_path: path }];
      });
    },
  });

  if (!authorId) return null;

  const imageUrls = media
    .filter((row) => row.media_type === "image")
    .map((row) => publicProfileMediaPublicUrl(row.storage_path));

  return (
    <div className="mt-6 w-full min-w-0 space-y-6">
      <section aria-label="User reviews">
        <button
          type="button"
          onClick={() => reviews.length > 0 && setReviewsOpen(true)}
          disabled={reviews.length === 0}
          className="mb-1 flex w-full items-center gap-2 px-1 text-left outline-none transition-opacity enabled:hover:opacity-80 focus-visible:ring-2 focus-visible:ring-orange-500/50 disabled:cursor-default"
          aria-label={reviews.length > 0 ? `View all ${reviews.length} reviews` : "User reviews"}
        >
          <Star className="h-4 w-4 shrink-0 fill-amber-500 text-amber-500" aria-hidden />
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
            User Reviews
          </h3>
          {reviews.length > 0 ? (
            <span className="ms-auto text-[10px] font-bold uppercase tracking-widest text-slate-400">
              View all
            </span>
          ) : null}
        </button>
        {reviews.length > 0 ? (
          <ProfileReviewCarousel
            reviews={reviews}
            onSelect={() => setReviewsOpen(true)}
            fill
          />
        ) : (
          <p className="px-1 py-3 text-sm font-medium text-slate-400 dark:text-slate-500">
            No reviews yet for this user
          </p>
        )}
      </section>

      <section aria-label="Profile media">
        <div className="mb-2 flex items-center gap-2 px-1">
          <h3 className={cn("text-[17px] font-extrabold text-foreground")}>Media</h3>
          {media.length > 0 ? (
            <span className="text-[15px] font-semibold text-muted-foreground">{media.length}</span>
          ) : null}
        </div>
        {media.length > 0 ? (
          <MediaStrip
            items={media}
            onOpen={(index) => {
              const row = media[index];
              if (!row) return;
              if (row.media_type === "video") {
                setVideoUrl(publicProfileMediaPublicUrl(row.storage_path));
                return;
              }
              const url = publicProfileMediaPublicUrl(row.storage_path);
              const imageIndex = imageUrls.indexOf(url);
              setImageLightbox({
                urls: imageUrls,
                index: imageIndex >= 0 ? imageIndex : 0,
              });
            }}
          />
        ) : (
          <p className="px-1 py-3 text-sm font-medium text-slate-400 dark:text-slate-500">
            No profile media yet
          </p>
        )}
      </section>

      <ProfileReviewsSheet
        open={reviewsOpen}
        onOpenChange={setReviewsOpen}
        reviews={reviews}
      />
      <ImageLightboxModal
        images={imageLightbox?.urls ?? []}
        initialIndex={imageLightbox?.index ?? 0}
        isOpen={imageLightbox != null}
        onClose={() => setImageLightbox(null)}
      />
      <VideoLightboxModal
        src={videoUrl}
        isOpen={videoUrl != null}
        onClose={() => setVideoUrl(null)}
      />
    </div>
  );
}
