import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Clock } from "lucide-react";
import {
  EXPLORE_PAGE_CARD_HOVER,
  EXPLORE_PAGE_CARD_SURFACE,
  EXPLORE_PAGE_CARD_THUMB,
} from "@/components/jobs/jobCardSharedClasses";
import { categoryIllustrationSrc } from "@/lib/discoverCategoryTileIcons";
import { postServiceCategoryLabel } from "@/lib/serviceCategories";
import {
  GLOBAL_POSTS_PATH,
  isolatedOfferPostPath,
} from "@/lib/profilePostShare";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { ListingPageSkeleton } from "@/components/loading/PageSkeletons";

type MyOfferRow = {
  id: string;
  created_at: string;
  caption: string | null;
  custom_category: string | null;
  post_metadata: Record<string, unknown> | null;
};

function categoryFromOffer(row: MyOfferRow): {
  id: string | null;
  label: string;
} {
  const meta = row.post_metadata;
  const id =
    (typeof meta?.service === "string" && meta.service) ||
    (typeof meta?.category === "string" && meta.category) ||
    null;
  const custom =
    (typeof meta?.custom_category === "string" && meta.custom_category.trim()) ||
    row.custom_category?.trim() ||
    null;
  return {
    id,
    label: postServiceCategoryLabel(id, custom),
  };
}

function locationFromOffer(row: MyOfferRow): string {
  const raw =
    typeof row.post_metadata?.location === "string"
      ? row.post_metadata.location.trim()
      : "";
  if (!raw) return "Location not set";
  return raw.split(",")[0]?.trim() || raw;
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return mins <= 1 ? "Just now" : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const LIST_GRID_PAGE = "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3";
const LIST_GRID_MODAL = "grid grid-cols-1 gap-3 md:grid-cols-2";

/**
 * Discover home → **My offers** modal: simple request-style boxes for the
 * viewer's `offer_service` posts.
 */
export function ExploreMyPostedOffers({
  variant = "page",
}: {
  variant?: "page" | "modal";
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [offers, setOffers] = useState<MyOfferRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setOffers([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    void supabase
      .from("profile_posts")
      .select("id, created_at, caption, custom_category, post_metadata")
      .eq("author_id", user.id)
      .eq("post_type_id", "offer_service")
      .order("created_at", { ascending: false })
      .limit(40)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("[ExploreMyPostedOffers]", error);
          setOffers([]);
        } else {
          setOffers((data ?? []) as MyOfferRow[]);
        }
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!user?.id) return null;

  return (
    <section className="space-y-4" aria-label="Your posted offers">
      {isLoading ? (
        <ListingPageSkeleton
          count={variant === "modal" ? 4 : 6}
          gridClassName={variant === "modal" ? LIST_GRID_MODAL : LIST_GRID_PAGE}
        />
      ) : offers.length === 0 ? (
        <div className="rounded-2xl border-0 bg-zinc-50 px-4 py-10 text-center shadow-sm dark:bg-zinc-900/50">
          <p className="text-lg font-bold text-foreground">No offers yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Post an offer to show what you can help with nearby.
          </p>
          <Link
            to={`${GLOBAL_POSTS_PATH}?compose=1&postType=offer_service`}
            className="mt-5 inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            Post an offer
          </Link>
        </div>
      ) : (
        <div
          className={variant === "modal" ? LIST_GRID_MODAL : LIST_GRID_PAGE}
        >
          {offers.map((offer) => {
            const { id: categoryId, label } = categoryFromOffer(offer);
            const loc = locationFromOffer(offer);
            const imgSrc = categoryIllustrationSrc(categoryId, offer.custom_category);
            const caption = (offer.caption ?? "").trim();

            return (
              <button
                key={offer.id}
                type="button"
                onClick={() => navigate(isolatedOfferPostPath(offer.id))}
                className={cn(
                  "group relative w-full rounded-2xl px-4 py-3.5 text-left",
                  EXPLORE_PAGE_CARD_SURFACE,
                  EXPLORE_PAGE_CARD_HOVER,
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      EXPLORE_PAGE_CARD_THUMB,
                      "bg-zinc-100 dark:bg-zinc-900",
                    )}
                    aria-hidden
                  >
                    <img
                      src={imgSrc}
                      alt=""
                      className="h-full w-full origin-center scale-[1.15] object-cover object-center"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-slate-800 sm:text-sm dark:text-zinc-300">
                      {caption || loc}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] font-black uppercase tracking-[0.08em] text-slate-700 dark:text-zinc-200">
                      {label}
                    </p>
                    <div
                      className="mt-1 flex items-center gap-1.5 text-[15px] font-medium text-slate-500 sm:text-sm dark:text-zinc-400"
                      role="status"
                      aria-live="polite"
                    >
                      <Clock
                        className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-hidden
                      />
                      <span>Posted {timeAgo(offer.created_at)}</span>
                    </div>
                  </div>
                  <ChevronRight
                    className="h-5 w-5 shrink-0 text-muted-foreground"
                    aria-hidden
                    strokeWidth={2}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
