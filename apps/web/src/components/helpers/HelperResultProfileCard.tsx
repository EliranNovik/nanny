import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Heart, Loader2, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StarRating } from "@/components/StarRating";
import { cn } from "@/lib/utils";
import { publicProfileMediaPublicUrl } from "@/lib/publicProfileMedia";
import { isFreelancerInActive24hLiveWindow } from "@/lib/freelancerLiveWindow";
import type { HelperResult } from "@/pages/client/HelpersPage";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";
import { WhatsAppIcon, TelegramIcon } from "@/components/BrandIcons";
import { ProfileKnockMenu } from "@/components/ProfileKnockMenu";
import { SERVICE_CATEGORIES } from "@/lib/serviceCategories";

export type PublicProfileGalleryRow = {
  id: string;
  user_id: string;
  media_type: "image" | "video";
  storage_path: string;
  sort_order: number;
  created_at: string;
};

type Slide = { key: string; kind: "image" | "video"; src: string };

const glassRoundBtn = cn(
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
  "bg-black/30 text-white shadow-lg backdrop-blur-2xl transition-colors",
  "hover:bg-black/40",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400",
  "disabled:pointer-events-none disabled:opacity-55",
);

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
  onToggleFavorite: (userId: string, e: React.MouseEvent) => void;
  onOpenProfile: (userId: string) => void;
};

export function HelperResultProfileCard({
  helper: h,
  gallery,
  viewerId,
  favoriteIds,
  favoriteBusyId,
  onToggleFavorite,
  onOpenProfile,
}: HelperResultProfileCardProps) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user: currentUser, profile: currentProfile } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [chatOpening, setChatOpening] = useState(false);
  const [socialBusy, setSocialBusy] = useState<"wa" | "tg" | null>(null);

  const slides = useMemo(
    () => buildSlides(h.photo_url, gallery),
    [h.photo_url, gallery],
  );

  const knockCategories = useMemo(() => {
    const live = h.freelancer_profiles?.live_categories;
    if (live?.length) return live;
    return SERVICE_CATEGORIES.slice(0, 10).map((c) => c.id);
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

  const slidesRef = useRef(slides);
  slidesRef.current = slides;
  const scrollStartLeftRef = useRef<number | null>(null);
  const swipeRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startLeft: number;
    isHorizontal: boolean;
  } | null>(null);

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

  // (Used to render "N more" previously; keep only what we need for the bar indicator.)

  const showStrip = slides.length > 1;

  const snapToNearestSlide = useCallback(() => {
    const el = scrollRef.current;
    const list = slidesRef.current;
    if (!el || list.length < 2) return;
    const w = el.clientWidth;
    if (w <= 0) return;
    const idx = Math.min(
      list.length - 1,
      Math.max(0, Math.round(el.scrollLeft / w)),
    );
    el.scrollTo({ left: idx * w, behavior: "smooth" });
  }, []);

  useEffect(() => {
    return () => {
      swipeRef.current = null;
    };
  }, []);

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
      const myRole = currentProfile.role;
      const theirRole = h.role;
      if (myRole !== "client" && myRole !== "freelancer") {
        addToast({
          title: "Messaging unavailable",
          description: "Your account cannot start a chat from here.",
          variant: "error",
        });
        return;
      }
      if (theirRole !== "client" && theirRole !== "freelancer") {
        addToast({
          title: "Messaging unavailable",
          description: "You can only message clients or helpers.",
          variant: "error",
        });
        return;
      }
      if (myRole === theirRole) {
        addToast({
          title: "Messaging unavailable",
          description:
            "You can only message someone in the opposite role (client ↔ helper).",
          variant: "default",
        });
        return;
      }

      const clientId = myRole === "client" ? currentUser.id : h.id;
      const freelancerId = myRole === "freelancer" ? currentUser.id : h.id;

      setChatOpening(true);
      try {
        const { data: existing, error: findErr } = await supabase
          .from("conversations")
          .select("id")
          .eq("client_id", clientId)
          .eq("freelancer_id", freelancerId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (findErr) throw findErr;

        if (existing?.id) {
          navigate(`/messages?conversation=${existing.id}`);
          return;
        }

        const { data: created, error: insErr } = await supabase
          .from("conversations")
          .insert({
            job_id: null,
            client_id: clientId,
            freelancer_id: freelancerId,
          })
          .select("id")
          .single();

        if (insErr) throw insErr;
        navigate(`/messages?conversation=${created.id}`);
      } catch (err: unknown) {
        console.error(err);
        const msg =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Please try again.";
        addToast({
          title: "Could not open chat",
          description: msg,
          variant: "error",
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

  return (
    <Card
      className={cn(
        "group relative cursor-pointer select-none overflow-hidden rounded-[22px] outline-none",
        "touch-manipulation [-webkit-tap-highlight-color:transparent]",
        "bg-zinc-950 shadow-2xl shadow-black/40",
        "transition-all duration-500 ease-out",
        "hover:-translate-y-1 hover:shadow-orange-500/15 hover:shadow-2xl",
        "active:scale-[0.995]",
      )}
      data-helper-snap-card=""
      onClick={() => onOpenProfile(h.id)}
    >
      <CardContent className="relative aspect-[4/5] min-h-[17.5rem] w-full p-0 sm:min-h-[19rem]">
        <div className="absolute inset-0 z-0 bg-black transform-gpu">
        {slides.length === 0 ? (
          <Avatar className="absolute inset-0 z-0 h-full w-full rounded-none border-0 shadow-none">
            <AvatarFallback className="rounded-none bg-gradient-to-br from-zinc-800 via-zinc-900 to-black text-6xl font-black tracking-tight text-white/25">
              {(h.full_name || "?").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : showStrip ? (
          <div
            ref={scrollRef}
            onPointerDownCapture={(e) => {
              const el = scrollRef.current;
              if (!el) return;
              scrollStartLeftRef.current = el.scrollLeft;
              swipeRef.current = {
                active: true,
                startX: e.clientX,
                startY: e.clientY,
                startLeft: el.scrollLeft,
                isHorizontal: false,
              };
              try {
                el.setPointerCapture(e.pointerId);
              } catch {
                /* ignore */
              }
            }}
            onPointerMoveCapture={(e) => {
              const el = scrollRef.current;
              const s = swipeRef.current;
              if (!el || !s?.active) return;
              const dx = e.clientX - s.startX;
              const dy = e.clientY - s.startY;
              if (!s.isHorizontal) {
                if (Math.abs(dx) < 6) return;
                if (Math.abs(dx) <= Math.abs(dy)) return;
                s.isHorizontal = true;
              }
              // We are handling horizontal paging: prevent browser "free scroll".
              e.preventDefault();
              el.scrollLeft = s.startLeft - dx;
            }}
            onPointerUpCapture={(e) => {
              const el = scrollRef.current;
              const list = slidesRef.current;
              const s = swipeRef.current;
              swipeRef.current = null;
              if (!el || !s) return;
              if (!s.isHorizontal) {
                // For non-horizontal gestures, just align cleanly.
                snapToNearestSlide();
                return;
              }
              const w = el.clientWidth;
              if (w <= 0 || list.length < 2) return;
              const startIdx = Math.min(
                list.length - 1,
                Math.max(0, Math.round(s.startLeft / w)),
              );
              const dx = el.scrollLeft - s.startLeft; // + = moved right (next)
              const THRESH = Math.max(18, Math.round(w * 0.08));
              let nextIdx = startIdx;
              if (Math.abs(dx) >= THRESH) {
                nextIdx =
                  dx > 0
                    ? Math.min(list.length - 1, startIdx + 1)
                    : Math.max(0, startIdx - 1);
              } else {
                nextIdx = Math.min(
                  list.length - 1,
                  Math.max(0, Math.round(el.scrollLeft / w)),
                );
              }
              el.scrollTo({ left: nextIdx * w, behavior: "smooth" });
              try {
                el.releasePointerCapture(e.pointerId);
              } catch {
                /* ignore */
              }
            }}
            onPointerCancelCapture={() => {
              swipeRef.current = null;
              snapToNearestSlide();
            }}
            onScroll={() => {
              window.requestAnimationFrame(syncIndex);
            }}
            className={cn(
              "absolute inset-0 z-0 flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden",
              "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
              "overscroll-x-contain",
              // Allow vertical scroll on page, but we'll handle horizontal swipes.
              "touch-pan-y",
            )}
          >
            {slides.map((slide) => (
              <div
                key={slide.key}
                className="relative h-full min-w-full shrink-0 snap-start snap-always"
              >
                {slide.kind === "video" ? (
                  <div
                    className="h-full w-full"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <video
                      src={slide.src}
                      className="h-full w-full bg-black object-cover object-center"
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
                    className="h-full w-full bg-black object-cover object-center"
                    draggable={false}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="absolute inset-0 z-0">
            {slides[0]!.kind === "video" ? (
              <div
                className="h-full w-full"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <video
                  src={slides[0]!.src}
                  className="h-full w-full bg-black object-cover object-[50%_30%] max-md:object-contain max-md:object-center"
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
                className="h-full w-full bg-black object-cover object-[50%_30%] max-md:object-contain max-md:object-center"
                draggable={false}
              />
            )}
          </div>
        )}

        {/* Readability scrim — bottom portion only so the photo stays vivid */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[48%] bg-gradient-to-t from-black via-black/75 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[38%] bg-gradient-to-tr from-orange-500/18 to-transparent opacity-90 mix-blend-soft-light"
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

        {isFreelancerInActive24hLiveWindow(h.freelancer_profiles) && (
          <div
            className="pointer-events-none absolute left-3 top-3 z-[12] max-w-[calc(100%-5.5rem)]"
            role="status"
            aria-label="Available for jobs now"
          >
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full",
                "bg-black/25 px-3 py-1.5 shadow-lg backdrop-blur-xl",
                "text-[10px] font-bold uppercase leading-none tracking-[0.18em] text-white",
                "ring-1 ring-inset ring-white/15",
              )}
            >
              <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
              </span>
              <span className="pr-0.5">Live</span>
            </span>
          </div>
        )}

        {viewerId ? (
          <div
            className="absolute right-2.5 top-2.5 z-[16] flex flex-col items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label={
                favoriteIds.has(h.id)
                  ? "Remove from favorites"
                  : "Add to favorites"
              }
              aria-pressed={favoriteIds.has(h.id)}
              disabled={favoriteBusyId === h.id}
              onClick={(e) => void onToggleFavorite(h.id, e)}
              className={glassRoundBtn}
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

            <button
              type="button"
              className={glassRoundBtn}
              aria-label="Open chat"
              disabled={chatOpening}
              onClick={(e) => void openDirectChat(e)}
            >
              {chatOpening ? (
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
              ) : (
                <MessageCircle className="h-6 w-6" strokeWidth={2} aria-hidden />
              )}
            </button>

            <button
              type="button"
              className={glassRoundBtn}
              aria-label="Open WhatsApp"
              disabled={socialBusy === "wa"}
              onClick={(e) => void openWhatsApp(e)}
            >
              {socialBusy === "wa" ? (
                <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden />
              ) : (
                <WhatsAppIcon size={24} className="text-white" />
              )}
            </button>

            <button
              type="button"
              className={glassRoundBtn}
              aria-label="Open Telegram"
              disabled={socialBusy === "tg"}
              onClick={(e) => void openTelegram(e)}
            >
              {socialBusy === "tg" ? (
                <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden />
              ) : (
                <TelegramIcon size={24} className="text-white" />
              )}
            </button>

            {knockCategories.length > 0 ? (
              <ProfileKnockMenu
                targetUserId={h.id}
                targetRole={h.role ?? null}
                categories={knockCategories}
                viewerId={viewerId}
                viewerRole={currentProfile?.role ?? null}
                viewerName={currentProfile?.full_name ?? null}
                variant="glass"
                dropdownOpens="up"
              />
            ) : null}
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex flex-col gap-2 px-4 pb-4 pt-14">
          <div className="space-y-1.5">
            <p className="line-clamp-2 text-[28px] font-black leading-[1.05] tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.55)]">
              {h.full_name || "Helper"}
            </p>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[15px] font-semibold text-white">
              <span className="inline-flex min-w-0 items-center gap-1 text-white">
                <MapPin
                  className="h-4 w-4 shrink-0 text-orange-300"
                  aria-hidden
                />
                <span className="line-clamp-1 text-white">{h.city || "—"}</span>
              </span>
              {h.distanceKm != null ? (
                <span className="shrink-0 text-[13px] font-bold tabular-nums text-white">
                  {h.distanceKm < 1
                    ? `${Math.round(h.distanceKm * 1000)} m`
                    : `${h.distanceKm.toFixed(1)} km`}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex min-h-[1.25rem] flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2">
            <div className="min-w-0 shrink">
              {h.average_rating != null && h.average_rating > 0 ? (
                <StarRating
                  rating={h.average_rating}
                  size="sm"
                  showCount
                  totalRatings={h.total_ratings ?? 0}
                  className="drop-shadow-sm"
                  starClassName="text-amber-400"
                  emptyStarClassName="text-white/20"
                  numberClassName="text-white font-black"
                  countClassName="text-white/55"
                />
              ) : (
                <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-white/55">
                  New helper
                </span>
              )}
            </div>
            {rateLabel ? (
              <p className="max-w-[55%] text-right text-[15px] font-black tabular-nums leading-tight text-orange-100 [text-shadow:0_1px_12px_rgba(0,0,0,0.45)]">
                {rateLabel}
              </p>
            ) : null}
          </div>

          {h.freelancer_profiles?.bio ? (
            <p className="line-clamp-2 text-[13px] leading-relaxed text-white/75 [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">
              {h.freelancer_profiles.bio}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
