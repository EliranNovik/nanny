import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Heart,
  Loader2,
  MapPin,
  MessageCircle,
  UserRound,
  Zap,
  Sparkles,
  Utensils,
  Package,
  Baby,
  Wrench,
  Star,
  Tag,
  HelpCircle,
} from "lucide-react";
import {
  ProfileReviewsSheet,
  type ProfileReviewItem,
} from "@/components/profile/ProfileReviewsSheet";

import { cn } from "@/lib/utils";
import { openCommunityContact } from "@/lib/communityContact";
import { publicProfileMediaPublicUrl } from "@/lib/publicProfileMedia";
import { isFreelancerInActive24hLiveWindow } from "@/lib/freelancerLiveWindow";
import type { HelperResult } from "@/pages/client/HelpersPage";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";
import { WhatsAppIcon, TelegramIcon } from "@/components/BrandIcons";
import { SERVICE_CATEGORIES } from "@/lib/serviceCategories";
import { canStartInCardLabel } from "@/lib/liveCanStart";

export type PublicProfileGalleryRow = {
  id: string;
  user_id: string;
  media_type: "image" | "video";
  storage_path: string;
  sort_order: number;
  created_at: string;
};

type Slide = { key: string; kind: "image" | "video"; src: string };

/** Round action — frosted glass (no ring; shadow + blur define the edge) */
const coloredGlassRoundBtn =
  "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-lg backdrop-blur-2xl transition-all hover:brightness-110 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/90 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

const mediaGlassArrowBtn =
  "hidden md:inline-flex absolute top-1/2 z-20 h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur-xl backdrop-saturate-150 ring-1 ring-inset ring-white/15 transition-colors hover:bg-black/60 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 supports-[backdrop-filter]:bg-black/35";

function buildSlides(
  photoUrl: string | null,
  gallery: PublicProfileGalleryRow[],
): Slide[] {
  const slides: Slide[] = [];
  const trimmed = photoUrl?.trim();
  if (trimmed) {
    slides.push({ key: "profile-photo", kind: "image", src: trimmed });
  }
  const sorted = [...gallery].sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  for (const row of sorted) {
    slides.push({
      key: row.id,
      kind: row.media_type === "video" ? "video" : "image",
      src: publicProfileMediaPublicUrl(row.storage_path),
    });
  }
  return slides;
}

const PHOTO_PLACEHOLDER_COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-lime-600",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-blue-600",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-fuchsia-500",
  "bg-pink-500",
] as const;

function photoPlaceholderColorClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(31, hash) + seed.charCodeAt(i);
  }
  return PHOTO_PLACEHOLDER_COLORS[Math.abs(hash) % PHOTO_PLACEHOLDER_COLORS.length]!;
}

function initialsFromName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    const w = parts[0]!;
    return w.slice(0, Math.min(2, w.length)).toUpperCase();
  }
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function ProfilePhotoPlaceholder({
  name,
  seed,
  className,
}: {
  name: string | null | undefined;
  seed: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-3",
        photoPlaceholderColorClass(seed),
        className,
      )}
      aria-hidden
    >
      <UserRound className="h-16 w-16 text-white/90" strokeWidth={1.7} />
      <span className="text-5xl font-black leading-none tracking-tight text-white">
        {initialsFromName(name)}
      </span>
    </div>
  );
}

function mapJobReviewRow(row: {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  reviewer:
    | { full_name: string | null; photo_url: string | null }
    | { full_name: string | null; photo_url: string | null }[]
    | null;
}): ProfileReviewItem {
  const r = Array.isArray(row.reviewer) ? row.reviewer[0] : row.reviewer;
  return {
    id: row.id,
    rating: row.rating,
    review_text: row.review_text,
    created_at: row.created_at,
    reviewer: {
      full_name: r?.full_name ?? null,
      photo_url: r?.photo_url ?? null,
    },
  };
}

function CategoryIcon({ id, className }: { id: string; className?: string }) {
  switch (id) {
    case "cleaning": return <Sparkles className={className} aria-hidden />;
    case "cooking": return <Utensils className={className} aria-hidden />;
    case "pickup_delivery": return <Package className={className} aria-hidden />;
    case "nanny": return <Baby className={className} aria-hidden />;
    case "technical_help": return <Wrench className={className} aria-hidden />;
    case "other_help": return <HelpCircle className={className} aria-hidden />;
    default: return <Sparkles className={className} aria-hidden />;
  }
}

function getWhatsAppLink(number: string) {
  const cleaned = number.replace(/[^\d]/g, "");
  return `https://wa.me/${cleaned}`;
}

function getTelegramLink(username: string) {
  return `https://t.me/${username.replace(/^@/, "")}`;
}

type HelperResultProfileCardProps = {
  helper: HelperResult;
  gallery: PublicProfileGalleryRow[];
  viewerId: string | undefined;
  favoriteIds: Set<string>;
  favoriteBusyId: string | null;
  /** Helper avg reply time after client message; only shown when credible + under 1h. */
  respondsWithinLabel?: string | null;
  /** Helper’s own go-live preference (`freelancer_profiles.live_can_start_in`). */
  canStartInLabel?: string | null;
  /** Completed live help bookings in trailing 7 days (`get_helpers_live_help_week_counts`). */
  liveHelpWeekCount?: number;
  onToggleFavorite: (userId: string, e: React.MouseEvent) => void;
  onOpenProfile: (userId: string) => void;
  variant?: "grid" | "fullscreen" | "browse";
  /** Distance was computed from viewer’s saved coordinates (helpers page) vs search center. */
  distanceFromViewerPin?: boolean;
};

export function HelperResultProfileCard({
  helper: h,
  gallery,
  viewerId,
  favoriteIds,
  favoriteBusyId,
  respondsWithinLabel = null,
  canStartInLabel = null,
  liveHelpWeekCount,
  onToggleFavorite,
  onOpenProfile,
  variant = "grid",
  distanceFromViewerPin = false,
}: HelperResultProfileCardProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { user: currentUser, profile: currentProfile } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [chatOpening, setChatOpening] = useState(false);
  const [reviewsSheetOpen, setReviewsSheetOpen] = useState(false);
  const [helperReviews, setHelperReviews] = useState<ProfileReviewItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const reviewsCacheRef = useRef<ProfileReviewItem[] | null>(null);
  const [socialBusy, setSocialBusy] = useState<"wa" | "tg" | null>(null);
  /** When set, drives visibility of WhatsApp / Telegram action buttons. */
  const [socialContactFlags, setSocialContactFlags] = useState<{
    wa: boolean;
    tg: boolean;
  } | null>(null);

  const slides = useMemo(
    () => buildSlides(h.photo_url, gallery),
    [h.photo_url, gallery],
  );

  const liveCategories = useMemo(() => {
    const liveIds = h.freelancer_profiles?.live_categories;
    if (!liveIds || liveIds.length === 0) return [];
    return liveIds
      .map((id) => {
        const c = SERVICE_CATEGORIES.find((c) => c.id === id);
        return c ? { id: c.id, label: c.label } : null;
      })
      .filter(Boolean) as { id: string; label: string }[];
  }, [h.freelancer_profiles?.live_categories]);

  const rateLabel =
    h.freelancer_profiles?.hourly_rate_min != null &&
      h.freelancer_profiles?.hourly_rate_max != null
      ? `₪${h.freelancer_profiles.hourly_rate_min}–${h.freelancer_profiles.hourly_rate_max}/hr`
      : h.freelancer_profiles?.hourly_rate_min != null
        ? `From ₪${h.freelancer_profiles.hourly_rate_min}/hr`
        : h.freelancer_profiles?.hourly_rate_max != null
          ? `Up to ₪${h.freelancer_profiles.hourly_rate_max}/hr`
          : null;

  const respondsWithinBadge = useMemo(
    () => respondsWithinLabel,
    [respondsWithinLabel],
  );

  const canStartBadge = useMemo(() => {
    if (!isFreelancerInActive24hLiveWindow(h.freelancer_profiles)) return null;
    return canStartInLabel ? canStartInLabel : canStartInCardLabel(h.freelancer_profiles?.live_can_start_in);
  }, [canStartInLabel, h.freelancer_profiles]);

  const isLive24h = isFreelancerInActive24hLiveWindow(h.freelancer_profiles);



  useEffect(() => {
    const rpcHasBoth =
      h.whatsapp_contact_available !== undefined &&
      h.telegram_contact_available !== undefined;
    if (rpcHasBoth) {
      setSocialContactFlags({
        wa: !!h.whatsapp_contact_available,
        tg: !!h.telegram_contact_available,
      });
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "share_whatsapp, whatsapp_number_e164, share_telegram, telegram_username",
        )
        .eq("id", h.id)
        .maybeSingle();
      if (cancelled || error) return;
      if (!data) {
        setSocialContactFlags({ wa: false, tg: false });
        return;
      }
      setSocialContactFlags({
        wa: !!(
          data.share_whatsapp && data.whatsapp_number_e164?.trim()
        ),
        tg: !!(data.share_telegram && data.telegram_username?.trim()),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    h.id,
    h.whatsapp_contact_available,
    h.telegram_contact_available,
  ]);

  const showWhatsAppButton = socialContactFlags?.wa === true;
  const showTelegramButton = socialContactFlags?.tg === true;

  const syncIndex = useCallback(() => {
    const el = scrollRef.current;
    if (!el || slides.length === 0) return;
    const w = el.clientWidth;
    if (w <= 0) return;
    const idx = Math.min(
      slides.length - 1,
      Math.max(0, Math.round(el.scrollLeft / w)),
    );
    setActiveIndex(idx);
  }, [slides.length]);

  useEffect(() => {
    syncIndex();
  }, [slides, syncIndex]);

  /** New helper / gallery change: jump back to first slide. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: 0, behavior: "auto" });
    setActiveIndex(0);
  }, [h.id, h.photo_url, slides.map((s) => s.key).join("|")]);

  useEffect(() => {
    reviewsCacheRef.current = null;
    setHelperReviews([]);
    setReviewsSheetOpen(false);
  }, [h.id]);

  // (Used to render "N more" previously; keep only what we need for the bar indicator.)

  const showStrip = slides.length > 1;

  const goToSlide = useCallback(
    (nextIndex: number, e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      const el = scrollRef.current;
      if (!el) return;
      const i = Math.min(slides.length - 1, Math.max(0, nextIndex));
      el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
      setActiveIndex(i);
    },
    [slides.length],
  );

  const openDirectChat = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!currentUser?.id || !currentProfile) {
        addToast({
          title: "Sign in required",
          description: "Log in to message helpers.",
          variant: "default",
        });
        return;
      }

      setChatOpening(true);
      try {
        await openCommunityContact({
          supabase,
          user: currentUser,
          myRole: currentProfile.role,
          targetUserId: h.id,
          targetRole: h.role,
          navigate,
          addToast,
        });
      } finally {
        setChatOpening(false);
      }
    },
    [addToast, currentProfile, currentUser?.id, h.id, h.role, navigate],
  );

  const openWhatsApp = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setSocialBusy("wa");
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("whatsapp_number_e164, share_whatsapp")
          .eq("id", h.id)
          .maybeSingle();
        if (error) throw error;
        if (!data?.share_whatsapp || !data?.whatsapp_number_e164) {
          addToast({
            title: "WhatsApp not shared",
            description: "This helper has not enabled WhatsApp on their profile.",
            variant: "default",
          });
          return;
        }
        window.open(getWhatsAppLink(data.whatsapp_number_e164), "_blank", "noopener,noreferrer");
      } catch (err: unknown) {
        console.error(err);
        addToast({
          title: "Could not open WhatsApp",
          variant: "error",
        });
      } finally {
        setSocialBusy(null);
      }
    },
    [addToast, h.id],
  );

  const openTelegram = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setSocialBusy("tg");
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("telegram_username, share_telegram")
          .eq("id", h.id)
          .maybeSingle();
        if (error) throw error;
        if (!data?.share_telegram || !data?.telegram_username?.trim()) {
          addToast({
            title: "Telegram not shared",
            description: "This helper has not enabled Telegram on their profile.",
            variant: "default",
          });
          return;
        }
        window.open(getTelegramLink(data.telegram_username.trim()), "_blank", "noopener,noreferrer");
      } catch (err: unknown) {
        console.error(err);
        addToast({
          title: "Could not open Telegram",
          variant: "error",
        });
      } finally {
        setSocialBusy(null);
      }
    },
    [addToast, h.id],
  );

  const openReviews = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (reviewsCacheRef.current) {
        setHelperReviews(reviewsCacheRef.current);
        setReviewsSheetOpen(true);
        return;
      }
      setReviewsLoading(true);
      try {
        const { data, error } = await supabase
          .from("job_reviews")
          .select(
            "id, rating, review_text, created_at, reviewer:profiles!reviewer_id(full_name, photo_url)",
          )
          .eq("reviewee_id", h.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        const mapped = (
          (data ?? []) as Parameters<typeof mapJobReviewRow>[0][]
        ).map(mapJobReviewRow);
        reviewsCacheRef.current = mapped;
        setHelperReviews(mapped);
        setReviewsSheetOpen(true);
      } catch (err: unknown) {
        console.error(err);
        addToast({
          title: "Could not load reviews",
          variant: "error",
        });
      } finally {
        setReviewsLoading(false);
      }
    },
    [addToast, h.id],
  );

  const reviewsSheet = (
    <ProfileReviewsSheet
      open={reviewsSheetOpen}
      onOpenChange={setReviewsSheetOpen}
      reviews={helperReviews}
      averageRating={h.average_rating || 0}
      totalRatings={h.total_ratings || 0}
    />
  );

  const distanceMeta =
    h.distanceKm != null
      ? h.distanceKm < 1
        ? `${Math.round(h.distanceKm * 1000)} m`
        : `${h.distanceKm.toFixed(1)} km`
      : null;
  const isNewHelper = !(h.average_rating != null && h.average_rating > 0);
  const reviewCount = h.total_ratings ?? 0;
  const ratingLabel =
    h.average_rating != null && h.average_rating > 0
      ? h.average_rating.toFixed(1)
      : null;
  const browseLocation = [
    h.city?.trim() || null,
    distanceMeta
      ? distanceFromViewerPin
        ? t("findHelpersPage.distanceFromYou", { distance: distanceMeta })
        : distanceMeta
      : null,
  ]
    .filter(Boolean)
    .join(" • ");

  if (variant === "browse") {
    return (
    <>
      <article className="flex h-full min-h-0 flex-col overflow-hidden rounded-t-[28px] rounded-b-none bg-zinc-800 shadow-lg shadow-black/30 dark:bg-zinc-800 md:relative md:rounded-[28px] md:transition-[transform,box-shadow] md:duration-300 md:ease-out md:hover:z-10 md:hover:scale-[1.035] md:hover:shadow-2xl md:hover:shadow-black/40">
        <div className="relative min-h-0 w-full flex-1 overflow-hidden bg-zinc-900 md:aspect-[4/5] md:flex-none">
          {slides.length === 0 ? (
            <ProfilePhotoPlaceholder name={h.full_name} seed={h.id} />
          ) : showStrip ? (
            <div
              ref={scrollRef}
              onScroll={() => {
                window.requestAnimationFrame(syncIndex);
              }}
              className={cn(
                "absolute inset-0 flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden",
                "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
              )}
            >
              {slides.map((slide) => (
                <div
                  key={slide.key}
                  className="relative h-full w-full min-w-full shrink-0 snap-start overflow-hidden"
                >
                  {slide.kind === "video" ? (
                    <video
                      src={slide.src}
                      className="absolute inset-0 h-full w-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={slide.src}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      draggable={false}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : slides[0]!.kind === "video" ? (
            <video
              src={slides[0]!.src}
              className="absolute inset-0 h-full w-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            <img
              src={slides[0]!.src}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
            />
          )}

          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t from-black/85 via-black/40 to-transparent"
            aria-hidden
          />

          {isLive24h ? (
            <div className="pointer-events-none absolute left-3 top-3 z-10">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full",
                  "bg-black/50 px-3 py-1.5 text-[12px] font-semibold tracking-tight text-white/95",
                  "shadow-lg shadow-black/30 backdrop-blur-xl",
                  "supports-[backdrop-filter]:bg-black/40",
                )}
                role="status"
                aria-label="Available now for jobs"
              >
                <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/35 motion-reduce:animate-none" />
                  <span className="relative block h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.85)] ring-2 ring-emerald-400/35" />
                </span>
                Available now
              </span>
            </div>
          ) : null}

          {showStrip ? (
            <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
              <div className="flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1.5 backdrop-blur-md">
                {slides.map((_, idx) => (
                  <span
                    // eslint-disable-next-line react/no-array-index-key
                    key={idx}
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      idx === activeIndex ? "bg-white" : "bg-white/35",
                    )}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {showStrip && activeIndex > 0 ? (
            <button
              type="button"
              aria-label="Previous photo"
              className={cn(mediaGlassArrowBtn, "left-2.5")}
              onClick={(e) => goToSlide(activeIndex - 1, e)}
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.4} aria-hidden />
            </button>
          ) : null}
          {showStrip && activeIndex < slides.length - 1 ? (
            <button
              type="button"
              aria-label="Next photo"
              className={cn(mediaGlassArrowBtn, "right-2.5")}
              onClick={(e) => goToSlide(activeIndex + 1, e)}
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2.4} aria-hidden />
            </button>
          ) : null}

          {viewerId ? (
            <div className="absolute right-3 top-3 z-10" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                title={
                  favoriteIds.has(h.id)
                    ? "Remove from favorites"
                    : "Save to favorites"
                }
                aria-label={
                  favoriteIds.has(h.id)
                    ? "Remove from favorites"
                    : "Add to favorites"
                }
                aria-pressed={favoriteIds.has(h.id)}
                disabled={favoriteBusyId === h.id}
                onClick={(e) => void onToggleFavorite(h.id, e)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md"
              >
                {favoriteBusyId === h.id ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                ) : (
                  <Heart
                    className={cn(
                      "h-5 w-5",
                      favoriteIds.has(h.id) && "fill-red-500 text-red-500",
                    )}
                    strokeWidth={favoriteIds.has(h.id) ? 0 : 2.25}
                  />
                )}
              </button>
            </div>
          ) : null}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4 pb-3.5">
            <p className="text-[28px] font-black leading-none tracking-tight text-white">
              {h.full_name || t("findHelpersPage.helperFallback")}
            </p>
            {isNewHelper || browseLocation || ratingLabel ? (
              <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] font-semibold uppercase tracking-wide text-white/80">
                {isNewHelper ? (
                  <span>{t("findHelpersPage.newHelper")}</span>
                ) : null}
                {isNewHelper && browseLocation ? <span aria-hidden>•</span> : null}
                {browseLocation ? <span>{browseLocation}</span> : null}
                {ratingLabel ? (
                  <>
                    {(isNewHelper || browseLocation) ? (
                      <span aria-hidden>•</span>
                    ) : null}
                    <button
                      type="button"
                      onClick={(e) => void openReviews(e)}
                      disabled={reviewsLoading}
                      aria-label={`View all ${reviewCount} reviews`}
                      className="pointer-events-auto inline-flex items-center gap-1 normal-case tracking-normal outline-none transition-opacity hover:opacity-80 active:opacity-70 focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-60"
                    >
                      {reviewsLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Star
                          className="h-3.5 w-3.5 shrink-0 fill-white text-white"
                          aria-hidden
                        />
                      )}
                      <span>{ratingLabel}</span>
                      <span className="font-semibold text-white/75">
                        ({reviewCount})
                      </span>
                    </button>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col space-y-3.5 px-4 pb-4 pt-3.5">
          <div
            className={cn(
              "flex flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden md:min-h-[2.125rem]",
              "touch-pan-x overscroll-x-contain",
              "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
              liveCategories.length === 0 && "max-md:hidden",
            )}
          >
            {liveCategories.map((cat) => (
              <span
                key={cat.id}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-zinc-700/80 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white"
              >
                <CategoryIcon id={cat.id} className="h-3.5 w-3.5 text-emerald-400" />
                {t(`feed.categories.${cat.id}`, { defaultValue: cat.label })}
              </span>
            ))}
          </div>

          <p
            className={cn(
              "line-clamp-3 text-[14px] leading-relaxed text-zinc-200 md:min-h-[4.125rem]",
              !h.freelancer_profiles?.bio && "max-md:hidden",
            )}
          >
            {h.freelancer_profiles?.bio ?? ""}
          </p>

          <p
            className={cn(
              "flex items-center gap-2 text-[15px] font-bold text-white md:min-h-[1.5rem]",
              !rateLabel && "max-md:hidden",
            )}
          >
            {rateLabel ? (
              <>
                <Tag className="h-4 w-4 shrink-0 text-white/80" aria-hidden />
                {rateLabel}
              </>
            ) : null}
          </p>

          <div className="mt-auto flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => onOpenProfile(h.id)}
              className="inline-flex h-12 min-w-0 flex-1 items-center justify-center rounded-full bg-orange-500 px-4 text-[15px] font-bold text-white transition-colors hover:bg-orange-400 active:bg-orange-600"
            >
              {t("findHelpersPage.viewProfile")}
            </button>
            <button
              type="button"
              onClick={(e) => void openDirectChat(e)}
              disabled={chatOpening}
              className="inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-zinc-700 px-4 text-[13px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-zinc-600 active:bg-zinc-800 disabled:pointer-events-none disabled:opacity-60"
            >
              {chatOpening ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <MessageCircle
                  className="h-6 w-6 fill-white text-white"
                  strokeWidth={1.75}
                  aria-hidden
                />
              )}
              {t("findHelpersPage.message")}
            </button>
          </div>
        </div>
      </article>
      {reviewsSheet}
    </>
    );
  }

  return (
    <>
    <Card
      className={cn(
        "group relative cursor-pointer overflow-hidden outline-none",
        "touch-manipulation [-webkit-tap-highlight-color:transparent]",
        "bg-zinc-950 shadow-2xl shadow-black/40",
        "transition-all duration-500 ease-out",
        variant === "fullscreen"
          ? "h-full rounded-none shadow-none"
          : "rounded-[22px] hover:-translate-y-1 hover:shadow-orange-500/15 hover:shadow-2xl active:scale-[0.995]",
      )}
      data-helper-snap-card=""
      onClick={() => onOpenProfile(h.id)}
    >
      <CardContent
        className={cn(
          "relative w-full p-0",
          variant === "fullscreen"
            ? "h-full min-h-0"
            : "aspect-[4/5] min-h-[17.5rem] sm:min-h-[19rem] md:aspect-[3/5] md:min-h-[22rem] lg:min-h-[24rem]",
        )}
      >
        <div className="absolute inset-0 z-0 bg-black transform-gpu">
          {slides.length === 0 ? (
            <ProfilePhotoPlaceholder name={h.full_name} seed={h.id} className="z-0" />
          ) : showStrip ? (
            <div
              ref={scrollRef}
              onScroll={() => {
                window.requestAnimationFrame(syncIndex);
              }}
              className={cn(
                "absolute inset-0 z-0 flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden",
                "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
                "overscroll-x-contain [-webkit-overflow-scrolling:touch]",
              )}
            >
              {slides.map((slide) => (
                <div
                  key={slide.key}
                  className="relative h-full w-full min-w-full max-w-full shrink-0 snap-start snap-always overflow-hidden"
                >
                  {slide.kind === "video" ? (
                    <div
                      className="relative h-full w-full overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <video
                        src={slide.src}
                        className="absolute inset-0 h-full w-full bg-black object-cover object-center"
                        muted
                        playsInline
                        controls
                        preload="metadata"
                        controlsList="nodownload"
                      />
                    </div>
                  ) : (
                    <img
                      src={slide.src}
                      alt=""
                      className="pointer-events-none absolute inset-0 h-full w-full bg-black object-cover object-center select-none"
                      draggable={false}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="absolute inset-0 z-0 overflow-hidden">
              {slides[0]!.kind === "video" ? (
                <div
                  className="relative h-full w-full overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <video
                    src={slides[0]!.src}
                    className="absolute inset-0 h-full w-full bg-black object-cover object-center"
                    muted
                    playsInline
                    controls
                    preload="metadata"
                    controlsList="nodownload"
                  />
                </div>
              ) : (
                <img
                  src={slides[0]!.src}
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full bg-black object-cover object-center select-none"
                  draggable={false}
                />
              )}
            </div>
          )}

          {/* Readability scrim — bottom portion only so the photo stays vivid */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[50%] bg-gradient-to-t from-black/95 via-black/80 to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[26%] bg-gradient-to-tr from-orange-500/18 to-transparent opacity-90 mix-blend-soft-light"
            aria-hidden
          />
        </div>

        {showStrip ? (
          <div
            className="pointer-events-none absolute left-1/2 top-3 z-[15] -translate-x-1/2"
            aria-live="polite"
            aria-atomic="true"
          >
            <div
              className={cn(
                "rounded-full bg-black/15 px-3 py-2 shadow-lg backdrop-blur-xl",
              )}
            >
              <div className="flex items-center justify-center gap-1.5">
                {slides.map((_, idx) => (
                  <span
                    // eslint-disable-next-line react/no-array-index-key
                    key={idx}
                    className={cn(
                      "h-1.5 w-7 rounded-full",
                      idx === activeIndex ? "bg-white/85 shadow-[0_0_10px_rgba(255,255,255,0.25)]" : "bg-white/20",
                    )}
                    aria-hidden
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {(isLive24h ||
          respondsWithinBadge ||
          canStartBadge) && (
            <div className="pointer-events-none absolute left-3 top-6 z-[12] flex max-w-[calc(100%-5.5rem)] flex-col items-start">
              {isLive24h ? (
                <span
                  className={cn(
                    "mb-8 inline-flex items-center gap-2.5 rounded-full",
                    "bg-black/50 px-3.5 py-2 text-[13px] font-semibold tracking-tight text-white/95",
                    "shadow-lg shadow-black/30 backdrop-blur-xl",
                    "supports-[backdrop-filter]:bg-black/40",
                  )}
                  role="status"
                  aria-label="Available now for jobs"
                >
                  <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/35 motion-reduce:animate-none" />
                    <span className="relative block h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.85)] ring-2 ring-emerald-400/35" />
                  </span>
                  <span>Available now</span>
                </span>
              ) : null}

              <div className="flex flex-col gap-1.5">
                {canStartBadge ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-1.5 pr-4",
                      "bg-black/12 text-white shadow-lg backdrop-blur-md ring-1 ring-inset ring-white/15",
                    )}
                    role="status"
                  >
                    <Zap className="h-4.5 w-4.5 shrink-0 text-emerald-400" strokeWidth={2.5} aria-hidden />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-semibold leading-none text-white/80">Arrives in</span>
                      <span className="text-[13px] font-black leading-none tracking-tight text-white mt-0.5">
                        {canStartBadge.toLowerCase() === "immediately" ? "Now" : canStartBadge}
                      </span>
                    </div>
                  </span>
                ) : null}

                {respondsWithinBadge ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-1.5 pr-4",
                      "bg-black/12 text-white shadow-lg backdrop-blur-md ring-1 ring-inset ring-white/15",
                    )}
                    role="status"
                  >
                    <MessageCircle className="h-4.5 w-4.5 shrink-0 text-purple-300" strokeWidth={2.5} aria-hidden />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-semibold leading-none text-white/80">Replies</span>
                      <span className="text-[13px] font-black leading-none tracking-tight text-white mt-0.5">
                        {respondsWithinBadge}
                      </span>
                    </div>
                  </span>
                ) : null}

                {h.distanceKm != null ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-1.5 pr-4",
                      "bg-black/12 text-white shadow-lg backdrop-blur-md ring-1 ring-inset ring-white/15",
                    )}
                    role="status"
                  >
                    <MapPin className="h-4.5 w-4.5 shrink-0 text-white/90" strokeWidth={2.5} aria-hidden />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[13px] font-black leading-none tracking-tight text-white mb-0.5">
                        {h.distanceKm < 1
                          ? `${Math.round(h.distanceKm * 1000)} m`
                          : `${h.distanceKm.toFixed(1)} km`}
                      </span>
                      <span className="text-[10px] font-semibold leading-none text-white/80">
                        {distanceFromViewerPin ? "from you" : "away"}
                      </span>
                    </div>
                  </span>
                ) : null}
              </div>
            </div>
          )}

        {viewerId ? (
          <>
            <div
              className="absolute right-2.5 top-2.5 z-[17]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                title={
                  favoriteIds.has(h.id)
                    ? "Remove from favorites"
                    : "Save to favorites"
                }
                aria-label={
                  favoriteIds.has(h.id)
                    ? "Remove from favorites"
                    : "Add to favorites"
                }
                aria-pressed={favoriteIds.has(h.id)}
                disabled={favoriteBusyId === h.id}
                onClick={(e) => void onToggleFavorite(h.id, e)}
                className={cn(coloredGlassRoundBtn, "bg-black/45 hover:bg-black/55")}
              >
                {favoriteBusyId === h.id ? (
                  <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                ) : (
                  <Heart
                    className={cn(
                      "h-6 w-6 text-white drop-shadow-md",
                      favoriteIds.has(h.id) && "fill-red-500 text-red-500",
                    )}
                    strokeWidth={favoriteIds.has(h.id) ? 0 : 2.25}
                  />
                )}
              </button>
            </div>


          </>
        ) : null}

        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex flex-col gap-2 px-4 pb-4 pt-14",
            "md:gap-1.5 md:pt-5 lg:pt-4",
          )}
        >
          <div className="space-y-1.5 md:space-y-1">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[28px] font-black leading-[1.05] tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.55)]">
              <div className="flex min-w-0 items-baseline gap-1">
                <p className="line-clamp-2 min-w-0">
                  {h.full_name || "Helper"}
                </p>
                {h.is_verified ? (
                  <BadgeCheck
                    className="h-[0.95em] w-[0.95em] shrink-0 translate-y-[0.06em] fill-emerald-500 text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.45)]"
                    strokeWidth={2.25}
                    aria-label="Certified verified helper"
                  />
                ) : null}
              </div>
              <span className="line-clamp-1 max-w-full shrink-0 text-[15px] font-semibold leading-tight text-white/90 [text-shadow:0_1px_12px_rgba(0,0,0,0.45)] sm:max-w-[min(100%,12rem)]">
                {h.city?.trim() || "—"}
              </span>
            </div>
          </div>

          <div className="flex min-h-[1.25rem] flex-wrap items-center justify-between gap-2 pt-1 pb-1">
            <div className="flex min-w-0 shrink items-center gap-3">
              {h.average_rating != null && h.average_rating > 0 ? (
                <button
                  type="button"
                  onClick={(e) => void openReviews(e)}
                  disabled={reviewsLoading}
                  aria-label={`View all ${h.total_ratings ?? 0} reviews`}
                  className="flex items-center gap-1.5 text-[14px] font-black tabular-nums tracking-tight text-white drop-shadow-sm outline-none transition-opacity hover:opacity-80 active:opacity-70 focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-60"
                >
                  {reviewsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400 drop-shadow-md" aria-hidden />
                  )}
                  <span>{h.average_rating.toFixed(1)}</span>
                  <span className="text-[11px] font-bold text-white/60">
                    ({h.total_ratings ?? 0})
                  </span>
                </button>
              ) : (
                <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-white/55">
                  New helper
                </span>
              )}
              {liveHelpWeekCount != null && liveHelpWeekCount > 0 ? (
                <>
                  <span className="text-white/40" aria-hidden>|</span>
                  <span className="text-[12px] font-medium text-white/90 drop-shadow-md">
                    {liveHelpWeekCount} live jobs completed
                  </span>
                </>
              ) : null}
            </div>
          </div>

          {h.freelancer_profiles?.bio ? (
            <p className="line-clamp-2 text-[13px] leading-relaxed text-white/85 [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">
              {h.freelancer_profiles.bio}
            </p>
          ) : null}

          {liveCategories.length > 0 ? (
            <div
              className={cn(
                "pointer-events-auto flex flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden",
                "snap-x snap-mandatory touch-pan-x overscroll-x-contain",
                "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
              )}
            >
              {liveCategories.map((cat, i) => (
                <span
                  key={i}
                  className="inline-flex shrink-0 snap-start items-center gap-1.5 rounded-xl border-0 bg-black/40 px-3.5 py-2 text-[12px] font-bold uppercase tracking-wide text-white shadow-none ring-0 backdrop-blur-md"
                >
                  <CategoryIcon id={cat.id} className="h-4 w-4 text-emerald-400" />
                  {cat.label}
                </span>
              ))}
            </div>
          ) : null}

          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => void openDirectChat(e)}
              disabled={chatOpening}
              className={cn(
                "group inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3",
                "bg-emerald-600 text-white shadow-xl shadow-emerald-600/20",
                "ring-1 ring-inset ring-emerald-700/20 transition-colors",
                "hover:bg-emerald-500 active:bg-emerald-700",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                "disabled:opacity-60 disabled:pointer-events-none",
              )}
              aria-label="Contact now"
            >
              {chatOpening ? (
                <Loader2 className="h-5 w-5 animate-spin text-white/80" aria-hidden />
              ) : (
                <MessageCircle className="h-5 w-5 text-white/90" strokeWidth={2.25} aria-hidden />
              )}
              <span className="truncate text-[13px] font-black uppercase tracking-[0.14em]">
                Contact now
              </span>
            </button>

            {showWhatsAppButton ? (
              <button
                type="button"
                title="WhatsApp"
                aria-label="Open WhatsApp"
                disabled={socialBusy === "wa"}
                onClick={(e) => void openWhatsApp(e)}
                className={cn(
                  "inline-flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-2xl",
                  "bg-[#25D366] text-white shadow-xl shadow-[#25D366]/20 transition-all hover:brightness-110 active:scale-[0.97]",
                  "disabled:opacity-60 disabled:pointer-events-none",
                )}
              >
                {socialBusy === "wa" ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white" aria-hidden />
                ) : (
                  <WhatsAppIcon size={24} className="text-white" />
                )}
              </button>
            ) : null}

            {showTelegramButton ? (
              <button
                type="button"
                title="Telegram"
                aria-label="Open Telegram"
                disabled={socialBusy === "tg"}
                onClick={(e) => void openTelegram(e)}
                className={cn(
                  "inline-flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-2xl",
                  "bg-[#229ED9] text-white shadow-xl shadow-[#229ED9]/20 transition-all hover:brightness-110 active:scale-[0.97]",
                  "disabled:opacity-60 disabled:pointer-events-none",
                )}
              >
                {socialBusy === "tg" ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white" aria-hidden />
                ) : (
                  <TelegramIcon size={24} className="text-white" />
                )}
              </button>
            ) : null}
          </div>

          <div className="flex min-h-[1.25rem] flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2">
            <div className="min-w-0 shrink">
              {h.is_verified ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-400 drop-shadow-md">
                  <BadgeCheck
                    className="h-[1.2em] w-[1.2em] shrink-0 fill-emerald-500 text-white"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  Verified Helper
                </span>
              ) : null}
            </div>
            {rateLabel ? (
              <p className="max-w-[55%] text-right text-[15px] font-black tabular-nums leading-tight text-orange-100 [text-shadow:0_1px_12px_rgba(0,0,0,0.45)]">
                {rateLabel}
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
    {reviewsSheet}
    </>
  );
}
