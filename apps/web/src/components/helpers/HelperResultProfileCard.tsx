import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  Crown,
  Heart,
  Loader2,
  MapPin,
  Medal,
  MessageCircle,
  Trophy,
  Zap,
} from "lucide-react";
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

/** Round action — colored frosted glass */
const coloredGlassRoundBtn =
  "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-lg backdrop-blur-2xl transition-all hover:brightness-110 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/90 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ring-1";

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
  /** Helper avg reply time after client message; only shown when credible + under 1h. */
  respondsWithinLabel?: string | null;
  /** Helper’s own go-live preference (`freelancer_profiles.live_can_start_in`). */
  canStartInLabel?: string | null;
  /** Completed live help bookings in trailing 7 days (`get_helpers_live_help_week_counts`). */
  liveHelpWeekCount?: number;
  onToggleFavorite: (userId: string, e: React.MouseEvent) => void;
  onOpenProfile: (userId: string) => void;
  variant?: "grid" | "fullscreen";
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
  const { addToast } = useToast();
  const { user: currentUser, profile: currentProfile } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [chatOpening, setChatOpening] = useState(false);
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

  const respondsWithinBadge = useMemo(
    () => respondsWithinLabel,
    [respondsWithinLabel],
  );

  const canStartBadge = useMemo(
    () => (canStartInLabel ? canStartInLabel : canStartInCardLabel(h.freelancer_profiles?.live_can_start_in)),
    [canStartInLabel, h.freelancer_profiles?.live_can_start_in],
  );

  const showLiveHelpWeekBadge =
    liveHelpWeekCount != null && liveHelpWeekCount > 0;

  /** Medal @1, Trophy @6–10, Crown @11+ — corner of live-help card. */
  const liveHelpCornerTier = useMemo(() => {
    const n = liveHelpWeekCount ?? 0;
    if (n <= 0) return null;
    if (n === 1) return { kind: "medal" as const, title: "First live help booking this week" };
    if (n > 10)
      return { kind: "crown" as const, title: "Top tier · over 10 live help bookings this week" };
    if (n > 5)
      return { kind: "trophy" as const, title: "Great week · over 5 live help bookings" };
    return null;
  }, [liveHelpWeekCount]);

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

  // (Used to render "N more" previously; keep only what we need for the bar indicator.)

  const showStrip = slides.length > 1;

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
          <Avatar className="absolute inset-0 z-0 h-full w-full rounded-none border-0 shadow-none">
            <AvatarFallback className="rounded-none bg-gradient-to-br from-zinc-800 via-zinc-900 to-black text-6xl font-black tracking-tight text-white/25">
              {(h.full_name || "?").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
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

        {(isFreelancerInActive24hLiveWindow(h.freelancer_profiles) ||
          respondsWithinBadge ||
          canStartBadge) && (
          <div className="pointer-events-none absolute left-3 top-3 z-[12] flex max-w-[calc(100%-5.5rem)] flex-col items-start gap-2">
            {isFreelancerInActive24hLiveWindow(h.freelancer_profiles) ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full",
                  "bg-black/25 px-3 py-1.5 shadow-lg backdrop-blur-xl",
                  "text-[10px] font-bold uppercase leading-none tracking-[0.18em] text-white",
                  "ring-1 ring-inset ring-white/15",
                )}
                role="status"
                aria-label="Available for jobs now"
              >
                <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
                </span>
                <span className="pr-0.5">Live</span>
              </span>
            ) : null}

            {canStartBadge ? (
              <span
                className={cn(
                  "inline-flex max-w-[min(100%,11rem)] items-center gap-1.5 whitespace-nowrap rounded-2xl px-2.5 py-2",
                  "bg-gradient-to-br from-emerald-500/95 via-emerald-400/95 to-teal-500/95 text-white",
                  "shadow-xl shadow-emerald-500/20 ring-1 ring-inset ring-white/15",
                )}
                role="status"
              >
                <Zap className="h-3.5 w-3.5 shrink-0 text-white/95" strokeWidth={2.75} aria-hidden />
                <span className="text-[10px] font-black uppercase leading-none tracking-[0.12em]">
                  Ready in {canStartBadge}
                </span>
              </span>
            ) : null}

            {respondsWithinBadge ? (
              <span
                className={cn(
                  "inline-flex min-h-[4.75rem] min-w-[5.25rem] max-w-[11rem] flex-col items-center justify-center gap-1.5 rounded-2xl px-2.5 py-2.5",
                  "bg-gradient-to-br from-sky-600/55 to-cyan-600/45 text-white backdrop-blur-md",
                  "shadow-lg shadow-black/15",
                )}
                role="status"
              >
                <span className="block text-center text-[11px] font-black uppercase leading-snug tracking-[0.1em]">
                  Responds within
                </span>
                <span className="block w-full text-center text-[14px] font-black uppercase leading-none tabular-nums tracking-wide text-white">
                  {respondsWithinBadge}
                </span>
              </span>
            ) : null}
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
                className={cn(coloredGlassRoundBtn, "bg-rose-500/35 ring-white/35")}
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

            <div
              className="absolute right-2.5 top-1/2 z-[16] flex -translate-y-1/2 flex-col items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
            <button
              type="button"
              title="Open chat"
              aria-label="Open chat"
              disabled={chatOpening}
              onClick={(e) => void openDirectChat(e)}
              className={cn(
                coloredGlassRoundBtn,
                "bg-black/45 ring-white/25 backdrop-blur-2xl hover:bg-black/55",
              )}
            >
              {chatOpening ? (
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
              ) : (
                <MessageCircle className="h-6 w-6" strokeWidth={2} aria-hidden />
              )}
            </button>

            {showWhatsAppButton ? (
              <button
                type="button"
                title="WhatsApp"
                aria-label="Open WhatsApp"
                disabled={socialBusy === "wa"}
                onClick={(e) => void openWhatsApp(e)}
                className={cn(
                  coloredGlassRoundBtn,
                  "bg-emerald-500/40 ring-emerald-100/30",
                )}
              >
                {socialBusy === "wa" ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden />
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
                  coloredGlassRoundBtn,
                  "bg-blue-600/40 ring-blue-100/35",
                )}
              >
                {socialBusy === "tg" ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden />
                ) : (
                  <TelegramIcon size={24} className="text-white" />
                )}
              </button>
            ) : null}

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
                buttonClassName={cn(
                  coloredGlassRoundBtn,
                  "!bg-amber-500/40 !backdrop-blur-2xl ring-amber-100/35 hover:!brightness-110",
                )}
              />
            ) : null}
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
            {showLiveHelpWeekBadge ? (
              <span
                className={cn(
                  "pointer-events-none relative mb-0.5 inline-flex min-w-[7.75rem] flex-col items-stretch gap-0.5 self-start rounded-xl py-2 pl-3",
                  liveHelpCornerTier?.kind === "crown" ? "pr-[3.5rem]" : "pr-[2.75rem]",
                  "bg-gradient-to-br from-violet-600/65 to-fuchsia-600/50 text-white backdrop-blur-md",
                  "shadow-lg shadow-black/25 ring-1 ring-inset ring-white/15",
                )}
                role="status"
                title="Completed bookings in the last 7 days"
                aria-label={`${liveHelpWeekCount} completed live help bookings in the last 7 days`}
              >
                {liveHelpCornerTier ? (
                  <span
                    className={cn(
                      "pointer-events-none absolute right-1 top-1 inline-flex shrink-0 items-center justify-center rounded-full bg-black/28 shadow-md ring-1 ring-inset ring-white/25 backdrop-blur-md",
                      liveHelpCornerTier.kind === "crown" && "right-0.5 top-0.5 p-1.5",
                      liveHelpCornerTier.kind === "trophy" && "right-1 top-1 p-1.5",
                      liveHelpCornerTier.kind === "medal" && "right-1 top-1 p-1.5",
                    )}
                    title={liveHelpCornerTier.title}
                    aria-hidden
                  >
                    {liveHelpCornerTier.kind === "medal" ? (
                      <Medal
                        className="h-[15px] w-[15px] text-amber-200 drop-shadow-sm"
                        strokeWidth={2.25}
                        aria-hidden
                      />
                    ) : liveHelpCornerTier.kind === "trophy" ? (
                      <Trophy
                        className="h-[22px] w-[22px] text-amber-200 drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]"
                        strokeWidth={2.35}
                        aria-hidden
                      />
                    ) : (
                      <Crown
                        className="h-8 w-8 text-amber-200 drop-shadow-[0_0_12px_rgba(251,191,36,0.55)]"
                        strokeWidth={2.25}
                        aria-hidden
                      />
                    )}
                  </span>
                ) : null}
                <span className="text-center text-[9px] font-black uppercase leading-none tracking-[0.12em]">
                  Live help
                </span>
                <span className="text-center text-[20px] font-black tabular-nums leading-none tracking-tight">
                  {liveHelpWeekCount}
                </span>
                <span className="text-center text-[8px] font-bold uppercase tracking-wide text-white/90">
                  this week
                </span>
              </span>
            ) : null}
            <div className="flex min-w-0 items-baseline gap-1 text-[28px] font-black leading-[1.05] tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.55)]">
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
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[15px] font-semibold text-white">
              <span className="inline-flex min-w-0 items-center gap-1 text-white">
                <MapPin
                  className="h-4 w-4 shrink-0 text-orange-300"
                  aria-hidden
                />
                <span className="line-clamp-1 text-white">{h.city || "—"}</span>
              </span>
              {h.distanceKm != null ? (
                <span className="inline-flex shrink-0 flex-wrap items-baseline gap-x-1 text-[13px] font-bold tabular-nums text-white">
                  <span>
                    {h.distanceKm < 1
                      ? `${Math.round(h.distanceKm * 1000)} m`
                      : `${h.distanceKm.toFixed(1)} km`}
                  </span>
                  {distanceFromViewerPin ? (
                    <span className="text-[11px] font-semibold tabular-nums text-white/85">
                      · from you
                    </span>
                  ) : null}
                </span>
              ) : null}
            </div>
          </div>

          <div className="pointer-events-auto">
            <button
              type="button"
              onClick={(e) => void openDirectChat(e)}
              disabled={chatOpening}
              className={cn(
                "group inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3",
                "bg-white/95 text-slate-900 shadow-xl shadow-black/20",
                "ring-1 ring-inset ring-black/10 transition-colors",
                "hover:bg-white active:bg-white/90",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                "disabled:opacity-60 disabled:pointer-events-none",
              )}
              aria-label="Contact now"
            >
              {chatOpening ? (
                <Loader2 className="h-5 w-5 animate-spin text-slate-900/80" aria-hidden />
              ) : (
                <MessageCircle className="h-5 w-5 text-slate-900/90" strokeWidth={2.25} aria-hidden />
              )}
              <span className="text-[13px] font-black uppercase tracking-[0.14em]">
                Contact now
              </span>
            </button>
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
