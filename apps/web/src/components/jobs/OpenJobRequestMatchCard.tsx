import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Baby,
  Check,
  Clock,
  Crown,
  Loader2,
  MapPin,
  Medal,
  MessageCircle,
  MessageSquare,
  Sparkles,
  Star,
  Trophy,
  Truck,
  UtensilsCrossed,
  Wrench,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicProfileGalleryRow } from "@/components/helpers/HelperResultProfileCard";
import { publicProfileMediaPublicUrl } from "@/lib/publicProfileMedia";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabase";
import { WhatsAppIcon, TelegramIcon } from "@/components/BrandIcons";

export type OpenJobRequestMatchRow = {
  id: string;
  client_id: string;
  service_type: string | null;
  location_city: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  start_at: string | null;
  created_at: string | null;
  shift_hours: string | null;
  time_duration: string | null;
  care_frequency?: string | null;
  /** job_requests.service_details (JSON) */
  service_details?: Record<string, unknown> | null;
  notes: string | null;
  requirements?: string[] | null;
  languages_pref?: string[] | null;
  budget_min: number | null;
  budget_max: number | null;
  client_display_name: string | null;
  client_photo_url: string | null;
  distance_km: number | null;
  /** UI-only flag set by the match page after confirming availability */
  __accepted?: boolean;
  /** From `get_job_requests_near_location` after migration 069. */
  client_is_verified?: boolean | null;
  client_posted_requests_count?: number | null;
};

type Slide = { key: string; kind: "image" | "video"; src: string };

function buildSlides(photoUrl: string | null, gallery: PublicProfileGalleryRow[]): Slide[] {
  const slides: Slide[] = [];
  const trimmed = photoUrl?.trim();
  if (trimmed) slides.push({ key: "profile-photo", kind: "image", src: trimmed });
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

/** Glass icon row overlaid on the hero image */
const heroOverlayRoundBtn = cn(
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
  "bg-black/35 text-white shadow-lg backdrop-blur-md ring-1 ring-white/20 transition-colors",
  "hover:bg-black/45 active:scale-[0.97]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
  "disabled:pointer-events-none disabled:opacity-55",
);

const panelDeclineBtn = cn(
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-red-100 bg-red-50/95",
  "text-[14px] font-bold text-red-800 shadow-sm transition-colors",
  "hover:bg-red-100 active:scale-[0.99]",
  "dark:border-red-900/50 dark:bg-red-950/35 dark:text-red-100 dark:hover:bg-red-950/55",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40 focus-visible:ring-offset-2",
  "disabled:pointer-events-none disabled:opacity-55",
);

const panelAcceptBtn = cn(
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl",
  "bg-emerald-600 text-[14px] font-bold text-white shadow-sm transition-colors",
  "hover:bg-emerald-700 active:scale-[0.99]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2",
  "disabled:pointer-events-none disabled:opacity-55",
);

function getWhatsAppLink(number: string) {
  const cleaned = number.replace(/[^\d]/g, "");
  return `https://wa.me/${cleaned}`;
}

function getTelegramLink(username: string) {
  return `https://t.me/${username.replace(/^@/, "")}`;
}

function humanizeSnakeLabel(s: string): string {
  const withDashes = s.trim().replace(/(\d)_+(\d)/g, "$1-$2");
  return withDashes.replace(/_/g, " ");
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

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  cleaning: Sparkles,
  cooking: UtensilsCrossed,
  pickup_delivery: Truck,
  nanny: Baby,
  other_help: Wrench,
};

function CategoryIcon({
  serviceType,
  className,
  strokeWidth = 2,
}: {
  serviceType: string | null | undefined;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = CATEGORY_ICONS[(serviceType ?? "").toLowerCase()] ?? Sparkles;
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden />;
}

/**
 * Category chip beside “Posted …”.
 * Dark mode uses a solid black/zinc glass stack (no `bg-*` + gradient mix) so it always wins over light tints.
 */
function categoryPanelPillClasses(serviceType: string | null | undefined): string {
  const k = (serviceType ?? "").toLowerCase();
  const darkGlass = cn(
    "dark:border-white/14 dark:bg-black/70 dark:text-zinc-50 dark:shadow-lg dark:shadow-black/70",
    "dark:ring-1 dark:ring-inset dark:ring-white/10 dark:backdrop-blur-xl",
  );
  if (k.includes("clean")) {
    return cn(
      "border border-emerald-200/95 bg-emerald-50 text-emerald-950 shadow-sm ring-1 ring-emerald-100/80",
      darkGlass,
    );
  }
  if (k.includes("cook") || k.includes("chef") || k.includes("food")) {
    return cn(
      "border border-amber-200/95 bg-amber-50 text-amber-950 shadow-sm ring-1 ring-amber-100/80",
      darkGlass,
    );
  }
  if (k.includes("nanny") || k.includes("bab") || k.includes("sit")) {
    return cn(
      "border border-rose-200/95 bg-rose-50 text-rose-950 shadow-sm ring-1 ring-rose-100/80",
      darkGlass,
    );
  }
  if (k.includes("pickup") || k.includes("deliver") || k.includes("truck")) {
    return cn(
      "border border-sky-200/95 bg-sky-50 text-sky-950 shadow-sm ring-1 ring-sky-100/80",
      darkGlass,
    );
  }
  return cn(
    "border border-violet-200/95 bg-violet-50 text-violet-950 shadow-sm ring-1 ring-violet-100/80",
    darkGlass,
  );
}

/** Flatten service_details JSON into short readable lines and extracts notes. */
function parseServiceDetails(raw: unknown): { badges: { label: string; value: string }[]; notes: string[] } {
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return { badges: [], notes: [] };
    try {
      return parseServiceDetails(JSON.parse(t) as unknown);
    } catch {
      return { badges: [], notes: [] };
    }
  }
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return { badges: [], notes: [] };
  const o = raw as Record<string, unknown>;
  const skipKeys = new Set([
    "from_lat",
    "from_lng",
    "to_lat",
    "to_lng",
    "pickup_lat",
    "pickup_lng",
    "dropoff_lat",
    "dropoff_lng",
  ]);
  const noteKeys = new Set([
    "custom",
    "note",
    "notes",
    "details",
    "description",
    "message",
    "extra_info",
    "special_requests"
  ]);

  const badges: { label: string; value: string }[] = [];
  const notes: string[] = [];

  for (const [k, v] of Object.entries(o)) {
    if (skipKeys.has(k) || k.includes("address")) continue; // hide lat/lng fields completely
    if (v == null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;

    let label = humanizeSnakeLabel(k);
    // Remove the word "count" case-insensitively
    label = label.replace(/\bcount\b/gi, "").trim();

    if (typeof v === "string" || typeof v === "number") {
      const stringVal = String(v).trim();
      const isNote = noteKeys.has(k.toLowerCase()) || stringVal.length > 40;

      if (isNote) {
        notes.push(stringVal);
      } else {
        badges.push({ label, value: humanizeSnakeLabel(stringVal) });
      }
    } else if (typeof v === "boolean") {
      badges.push({ label, value: v ? "Yes" : "No" });
    }
  }
  return { badges: badges.slice(0, 8), notes: notes.slice(0, 3) };
}

export function OpenJobRequestMatchCard({
  row,
  gallery,
  formatTitle,
  onAccept,
  onDecline,
  onOpenProfile,
  clientRating,
  variant = "grid",
  commentCount = 0,
  onOpenComments,
  respondsWithinLabel = null,
  canStartInLabel = null,
}: {
  row: OpenJobRequestMatchRow;
  gallery: PublicProfileGalleryRow[];
  formatTitle: (serviceType: string | null | undefined) => string;
  onAccept: (jobId: string, note?: string) => Promise<void> | void;
  onDecline: (jobId: string) => Promise<void> | void;
  onOpenProfile: (userId: string) => void;
  variant?: "grid" | "fullscreen";
  clientRating?: { average_rating: number | null; total_ratings: number | null } | null;
  commentCount?: number;
  onOpenComments?: (jobId: string) => void;
  /** Client avg reply time after your messages (~time); only when credible + under 1h. */
  respondsWithinLabel?: string | null;
  /** Viewer’s live “when I can start” preference from freelancer_profiles. */
  canStartInLabel?: string | null;
}) {
  const { user: currentUser } = useAuth();
  const viewerId = currentUser?.id;
  const { addToast } = useToast();
  const [busy, setBusy] = useState<null | "accept" | "decline">(null);
  const [chatOpening, setChatOpening] = useState(false);
  const [socialBusy, setSocialBusy] = useState<"wa" | "tg" | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const slides = useMemo(
    () => buildSlides(row.client_photo_url, gallery),
    [row.client_photo_url, gallery],
  );
  const showStrip = slides.length > 1;
  const [activeIndex, setActiveIndex] = useState(0);

  const syncIndex = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const next = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    setActiveIndex(Math.max(0, Math.min(slides.length - 1, next)));
  }, [slides.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: 0, behavior: "auto" });
    setActiveIndex(0);
  }, [row.id, row.client_photo_url, slides.map((s) => s.key).join("|")]);

  const accept = useCallback(async () => {
    if (busy) return;
    setBusy("accept");
    try {
      await onAccept(row.id);
    } finally {
      setBusy(null);
    }
  }, [busy, onAccept, row.id]);

  const decline = useCallback(async () => {
    if (busy) return;
    setBusy("decline");
    try {
      await onDecline(row.id);
    } finally {
      setBusy(null);
    }
  }, [busy, onDecline, row.id]);

  const dist =
    typeof row.distance_km === "number" && Number.isFinite(row.distance_km)
      ? `${row.distance_km.toFixed(1)} km`
      : null;

  const scheduleLine = useMemo(() => {
    const parts: string[] = [];
    if (row.start_at) {
      const d = new Date(row.start_at);
      if (!Number.isNaN(d.getTime())) {
        parts.push(
          d.toLocaleString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      }
    }
    const sh = (row.shift_hours || "").trim();
    if (sh) parts.push(sh);
    return parts.length ? parts.join(" · ") : null;
  }, [row.start_at, row.shift_hours]);

  const careFrequencyLine = useMemo(() => {
    const t = (row.care_frequency || "").trim();
    return t ? humanizeSnakeLabel(t) : null;
  }, [row.care_frequency]);

  const timeDurationLine = useMemo(() => {
    let t = (row.time_duration || "").trim();
    // Safely reformat strings like "3_4_hours" to "3-4_hours" so humanize keeps the dash
    t = t.replace(/(\d)_+(\d)/g, "$1-$2");
    return t ? humanizeSnakeLabel(t) : null;
  }, [row.time_duration]);

  const parsedDetails = useMemo(
    () => parseServiceDetails(row.service_details ?? null),
    [row.service_details],
  );

  const serviceDetailLines = parsedDetails.badges;

  // Images uploaded to the job request (stored as public URLs in service_details.images)
  const jobImages = useMemo(() => {
    const imgs = (row.service_details as Record<string, unknown> | null)?.images;
    if (!Array.isArray(imgs)) return [] as string[];
    return (imgs as unknown[]).filter((u): u is string => typeof u === "string" && u.trim().length > 0);
  }, [row.service_details]);

  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const budgetLine = useMemo(() => {
    if (row.budget_min != null && row.budget_max != null) {
      if (row.budget_min <= row.budget_max) return `₪${row.budget_min}–₪${row.budget_max}`;
    }
    if (row.budget_min != null) return `From ₪${row.budget_min}`;
    if (row.budget_max != null) return `Up to ₪${row.budget_max}`;
    return null;
  }, [row.budget_min, row.budget_max]);

  const notesLine = useMemo(() => {
    let t = (row.notes || "").trim();
    if (parsedDetails.notes.length > 0) {
      const merged = parsedDetails.notes.join("\n\n");
      t = t ? `${merged}\n\n${t}` : merged;
    }
    if (!t) return null;
    return t.length > 200 ? `${t.slice(0, 200).trim()}…` : t;
  }, [row.notes, parsedDetails.notes]);

  const accepted = row.__accepted === true;

  const postedRequestsCountRaw = row.client_posted_requests_count;
  const postedRequestsCount =
    typeof postedRequestsCountRaw === "number" && Number.isFinite(postedRequestsCountRaw)
      ? Math.floor(postedRequestsCountRaw)
      : 0;
  const showPostedRequestsBadge = postedRequestsCount > 0;

  const postedRequestsCornerTier = useMemo(() => {
    const n = postedRequestsCount;
    if (n <= 0) return null;
    if (n === 1)
      return { kind: "medal" as const, title: "Posted 1 request in total" };
    if (n >= 10)
      return { kind: "crown" as const, title: "10+ posted requests" };
    if (n >= 5)
      return { kind: "trophy" as const, title: "5+ posted requests" };
    return null;
  }, [postedRequestsCount]);

  const showVerifiedBadge = row.client_is_verified === true;

  const openDirectChat = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!viewerId) {
        addToast({
          title: "Sign in required",
          description: "Log in to message clients.",
          variant: "default",
        });
        return;
      }
      if (!row.client_id) return;
      // Conversations are client↔freelancer. When a client can act as helper, we still use their user id as freelancer_id.
      const clientId = row.client_id;
      const freelancerId = viewerId;

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
          window.location.assign(`/messages?conversation=${existing.id}`);
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

        window.location.assign(`/messages?conversation=${created.id}`);
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
    [addToast, row.client_id, viewerId],
  );

  const openWhatsApp = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!row.client_id) return;
      setSocialBusy("wa");
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("whatsapp_number_e164, share_whatsapp")
          .eq("id", row.client_id)
          .maybeSingle();
        if (error) throw error;
        if (!data?.share_whatsapp || !data?.whatsapp_number_e164) {
          addToast({
            title: "WhatsApp not shared",
            description: "This client has not enabled WhatsApp on their profile.",
            variant: "default",
          });
          return;
        }
        window.open(
          getWhatsAppLink(String(data.whatsapp_number_e164)),
          "_blank",
          "noopener,noreferrer",
        );
      } catch (err) {
        console.error(err);
        addToast({ title: "Could not open WhatsApp", variant: "error" });
      } finally {
        setSocialBusy(null);
      }
    },
    [addToast, row.client_id],
  );

  const openTelegram = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!row.client_id) return;
      setSocialBusy("tg");
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("telegram_username, share_telegram")
          .eq("id", row.client_id)
          .maybeSingle();
        if (error) throw error;
        const uname = String(data?.telegram_username ?? "").trim();
        if (!data?.share_telegram || !uname) {
          addToast({
            title: "Telegram not shared",
            description: "This client has not enabled Telegram on their profile.",
            variant: "default",
          });
          return;
        }
        window.open(getTelegramLink(uname), "_blank", "noopener,noreferrer");
      } catch (err) {
        console.error(err);
        addToast({ title: "Could not open Telegram", variant: "error" });
      } finally {
        setSocialBusy(null);
      }
    },
    [addToast, row.client_id],
  );

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden",
        "bg-white shadow-2xl shadow-black/12 ring-1 ring-black/[0.06]",
        "transition-all duration-500 ease-out dark:bg-zinc-900 dark:ring-white/5",
        variant === "fullscreen"
          ? "h-full rounded-none shadow-none ring-0"
          : "rounded-[22px] hover:-translate-y-1 hover:shadow-xl",
      )}
      role="article"
      aria-label="Open request"
    >
      {/* Media only — tap opens client profile */}
      <div
        className={cn(
          "relative w-full shrink-0 cursor-pointer overflow-hidden bg-black",
          variant === "fullscreen"
            ? "min-h-[38vh] flex-1"
            : "aspect-[3/4] min-h-[16rem] max-h-[min(50vh,28rem)] sm:min-h-[18rem]",
        )}
        role="button"
        tabIndex={0}
        aria-label="View client profile"
        onClick={() => onOpenProfile(row.client_id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenProfile(row.client_id);
          }
        }}
      >
        {slides.length === 0 ? (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />
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
            {slides.map((s) => (
              <div
                key={s.key}
                className="relative h-full w-full min-w-full max-w-full shrink-0 snap-start snap-always overflow-hidden"
              >
                {s.kind === "video" ? (
                  <div
                    className="relative h-full w-full overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <video
                      src={s.src}
                      className="absolute inset-0 h-full w-full bg-black object-cover object-center"
                      muted
                      playsInline
                      preload="metadata"
                      controls
                      controlsList="nodownload"
                    />
                  </div>
                ) : (
                  <img
                    src={s.src}
                    alt=""
                    className="pointer-events-none absolute inset-0 h-full w-full bg-black object-cover object-center select-none"
                    draggable={false}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <img
            src={slides[0]!.src}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full bg-black object-cover object-center select-none"
            draggable={false}
          />
        )}

        {slides.length > 0 ? (
          <>
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[48%] bg-gradient-to-t from-black via-black/75 to-transparent"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[38%] bg-gradient-to-tr from-orange-500/18 to-transparent opacity-90 mix-blend-soft-light"
              aria-hidden
            />
          </>
        ) : null}

        {showStrip ? (
          <div
            className="pointer-events-none absolute left-1/2 top-3 z-[15] -translate-x-1/2"
            aria-live="polite"
            aria-atomic="true"
          >
            <div
              className={cn(
                "rounded-full bg-black/15 px-3 py-2 shadow-lg backdrop-blur-xl ring-1 ring-white/15",
              )}
            >
              <div className="flex items-center justify-center gap-1.5">
                {slides.map((_, idx) => (
                  <span
                    // eslint-disable-next-line react/no-array-index-key
                    key={idx}
                    className={cn(
                      "h-1.5 w-7 rounded-full",
                      idx === activeIndex
                        ? "bg-white/85 shadow-[0_0_10px_rgba(255,255,255,0.25)]"
                        : "bg-white/20",
                    )}
                    aria-hidden
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* Quick actions — vertical column on the right */}
        <div className="pointer-events-auto absolute right-2 top-1/2 z-[13] flex -translate-y-1/2 flex-col gap-2">
          {viewerId ? (
            <>
              <button
                type="button"
                className={heroOverlayRoundBtn}
                aria-label="Open chat"
                disabled={chatOpening}
                onClick={(e) => void openDirectChat(e)}
              >
                {chatOpening ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white/90" aria-hidden />
                ) : (
                  <MessageCircle className="h-6 w-6 text-emerald-300" strokeWidth={2} aria-hidden />
                )}
              </button>
              <button
                type="button"
                className={heroOverlayRoundBtn}
                aria-label="Open WhatsApp"
                disabled={socialBusy === "wa"}
                onClick={(e) => void openWhatsApp(e)}
              >
                {socialBusy === "wa" ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white/90" aria-hidden />
                ) : (
                  <WhatsAppIcon size={26} className="text-emerald-300" />
                )}
              </button>
              <button
                type="button"
                className={heroOverlayRoundBtn}
                aria-label="Open Telegram"
                disabled={socialBusy === "tg"}
                onClick={(e) => void openTelegram(e)}
              >
                {socialBusy === "tg" ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white/90" aria-hidden />
                ) : (
                  <TelegramIcon size={26} className="text-sky-300" />
                )}
              </button>
            </>
          ) : null}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[12] flex items-end justify-between gap-2 px-3 pb-3 pt-14">
          <div className="drop-shadow-[0_1px_6px_rgba(0,0,0,0.75)] min-w-0 flex-1 pr-1">
            {showPostedRequestsBadge ? (
              <span
                className={cn(
                  "relative mb-1.5 inline-flex min-w-[7rem] flex-col items-stretch gap-0.5 rounded-xl py-2 pl-3",
                  postedRequestsCornerTier?.kind === "crown" ? "pr-[3.5rem]" : "pr-[2.75rem]",
                  "pointer-events-none bg-gradient-to-br from-violet-600/65 to-fuchsia-600/50 text-white backdrop-blur-md",
                  "shadow-lg shadow-black/25 ring-1 ring-inset ring-white/15",
                )}
                aria-label={`${postedRequestsCount} posted requests`}
              >
                {postedRequestsCornerTier ? (
                  <span
                    className={cn(
                      "pointer-events-none absolute right-1 top-1 inline-flex shrink-0 items-center justify-center rounded-full bg-black/28 shadow-md ring-1 ring-inset ring-white/25 backdrop-blur-md",
                      postedRequestsCornerTier.kind === "crown" && "right-0.5 top-0.5 p-1.5",
                      postedRequestsCornerTier.kind === "trophy" && "right-1 top-1 p-1.5",
                      postedRequestsCornerTier.kind === "medal" && "right-1 top-1 p-1.5",
                    )}
                    title={postedRequestsCornerTier.title}
                    aria-hidden
                  >
                    {postedRequestsCornerTier.kind === "medal" ? (
                      <Medal
                        className="h-[13px] w-[13px] text-amber-200 drop-shadow-sm"
                        strokeWidth={2.25}
                        aria-hidden
                      />
                    ) : postedRequestsCornerTier.kind === "trophy" ? (
                      <Trophy
                        className="h-[20px] w-[20px] text-amber-200 drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]"
                        strokeWidth={2.35}
                        aria-hidden
                      />
                    ) : (
                      <Crown
                        className="h-7 w-7 text-amber-200 drop-shadow-[0_0_12px_rgba(251,191,36,0.55)]"
                        strokeWidth={2.25}
                        aria-hidden
                      />
                    )}
                  </span>
                ) : null}
                <span className="text-center text-[8px] font-black uppercase leading-none tracking-[0.12em]">
                  Posted
                </span>
                <span className="text-center text-[17px] font-black tabular-nums leading-none tracking-tight">
                  {postedRequestsCount}
                </span>
                <span className="text-center text-[8px] font-semibold uppercase tracking-wide text-white/92">
                  requests
                </span>
              </span>
            ) : null}
            <div className="flex min-w-0 items-baseline gap-1 font-black leading-tight tracking-tight text-white">
              <p className="truncate text-[20px]">
                {(row.client_display_name || "").trim() || "Member"}
              </p>
              {showVerifiedBadge ? (
                <BadgeCheck
                  className="h-[0.9em] w-[0.9em] shrink-0 translate-y-px fill-emerald-500 text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.45)]"
                  strokeWidth={2.25}
                  aria-label="Verified client"
                />
              ) : null}
            </div>
            {clientRating && clientRating.average_rating != null && (
              <div className="mt-1 flex items-center gap-1 text-[12px] font-bold text-amber-400">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" strokeWidth={1.5} aria-hidden />
                <span>{clientRating.average_rating.toFixed(1)}</span>
                <span className="font-medium text-white/60">({clientRating.total_ratings || 0})</span>
              </div>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <div className="flex min-w-0 items-center gap-1.5 text-[14px] font-semibold text-white">
                <MapPin className="h-4 w-4 shrink-0 text-emerald-300" strokeWidth={2.25} aria-hidden />
                <span className="truncate">{(row.location_city || "").trim() || "—"}</span>
              </div>
              {dist ? (
                <span className="text-[12px] font-bold tabular-nums text-white">{dist}</span>
              ) : null}
            </div>
          </div>
          <div className="relative z-[14] flex max-w-[48%] shrink-0 flex-col items-end gap-1 self-end pb-0.5">
            {respondsWithinLabel ? (
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
                  {respondsWithinLabel}
                </span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Details + actions */}
      <div
        className={cn(
          "relative z-[6] flex min-h-0 flex-1 flex-col border-t border-slate-200/90 bg-white px-4 pb-5 pt-12",
          "dark:border-zinc-800/80 dark:bg-zinc-900",
          variant === "fullscreen" && "max-h-[min(52vh,24rem)] overflow-y-auto",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute left-4 top-3 z-[11] flex max-w-[min(calc(100%-4.75rem),100%)] flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em]",
              categoryPanelPillClasses(row.service_type),
            )}
            role="presentation"
          >
            <CategoryIcon
              serviceType={row.service_type}
              className="h-3.5 w-3.5 shrink-0 text-current opacity-90"
              strokeWidth={2.35}
            />
            {formatTitle(row.service_type)}
          </span>
          {row.created_at ? (
            <div
              className="inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full border border-slate-200/95 bg-white/98 px-2.5 py-1 shadow-sm ring-1 ring-slate-200/65 dark:border-zinc-600 dark:bg-zinc-800/95 dark:ring-zinc-600/55"
              role="status"
              aria-label={`Posted ${timeAgo(row.created_at)}`}
            >
              <Clock
                className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-zinc-400"
                strokeWidth={2.5}
                aria-hidden
              />
              <span className="text-[11px] font-semibold leading-tight tabular-nums text-slate-700 dark:text-zinc-200">
                Posted {timeAgo(row.created_at)}
              </span>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="absolute top-4 right-4 z-10 flex items-center gap-1.5 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onOpenComments?.(row.id);
          }}
        >
          <MessageSquare className="h-5 w-5" strokeWidth={2.5} />
          {commentCount > 0 && (
            <span className="text-sm font-black tabular-nums">{commentCount}</span>
          )}
        </button>

        {canStartInLabel ? (
          <div className="flex flex-wrap gap-2 pr-12">
            <span className="inline-flex max-w-full items-center rounded-full border border-emerald-200/95 bg-gradient-to-br from-emerald-50 to-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-950 shadow-sm ring-1 ring-emerald-100/90 dark:border-emerald-800/70 dark:from-emerald-950/50 dark:to-zinc-900 dark:text-emerald-100 dark:ring-emerald-900/40">
              Can start in {canStartInLabel}
            </span>
          </div>
        ) : null}

        {careFrequencyLine || timeDurationLine || serviceDetailLines.length > 0 ? (
          <div className="mt-2 space-y-1.5">
            {(careFrequencyLine || timeDurationLine) ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {careFrequencyLine ? (
                  <span className={cn("text-slate-700 dark:text-zinc-300", variant === "fullscreen" ? "text-[17px]" : "text-[15px]")}>
                    <span className="text-[12px] font-black uppercase tracking-[0.12em] text-slate-400 dark:text-zinc-500 mr-1.5">Freq</span>
                    <span className="font-bold">{careFrequencyLine}</span>
                  </span>
                ) : null}
                {timeDurationLine ? (
                  <span className={cn("text-slate-700 dark:text-zinc-300", variant === "fullscreen" ? "text-[17px]" : "text-[15px]")}>
                    <span className="text-[12px] font-black uppercase tracking-[0.12em] text-slate-400 dark:text-zinc-500 mr-1.5">Dur</span>
                    <span className="font-bold">{timeDurationLine}</span>
                  </span>
                ) : null}
              </div>
            ) : null}

            {serviceDetailLines.length > 0 ? (
              <div className="flex flex-col gap-1 mt-1">
                {serviceDetailLines.map((badge, idx) => (
                  <span
                    key={idx}
                    className={cn("flex items-center text-slate-700 dark:text-zinc-300", variant === "fullscreen" ? "text-[17px]" : "text-[15px]")}
                  >
                    <span className="text-[12px] font-black uppercase tracking-[0.12em] text-slate-400 dark:text-zinc-500 mr-1.5">{badge.label}</span>
                    <span className="font-bold">{badge.value}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {scheduleLine ? (
          <p className={cn("mt-3 font-bold text-slate-800 dark:text-zinc-100", variant === "fullscreen" ? "text-[18px]" : "text-[17px]")}>
            {scheduleLine}
          </p>
        ) : null}

        {budgetLine ? (
          <p className={cn("mt-1.5 font-extrabold text-emerald-700 dark:text-emerald-500", variant === "fullscreen" ? "text-[18px]" : "text-[17px]")}>
            {budgetLine}
          </p>
        ) : null}

        {jobImages.length > 0 ? (
          <>
            <div className={cn("flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", variant === "fullscreen" ? "mt-3" : "mt-2")}>
              {jobImages.map((src, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="relative shrink-0 overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  style={{ width: variant === "fullscreen" ? "6.5rem" : "5rem", height: variant === "fullscreen" ? "6.5rem" : "5rem" }}
                  onClick={(e) => { e.stopPropagation(); setLightboxSrc(src); }}
                  aria-label={`View image ${idx + 1}`}
                >
                  <img
                    src={src}
                    alt={`Request image ${idx + 1}`}
                    className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
            {/* Lightbox */}
            {lightboxSrc ? (
              <div
                className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm"
                onClick={() => setLightboxSrc(null)}
              >
                <img
                  src={lightboxSrc}
                  alt=""
                  className="max-h-[90dvh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  type="button"
                  className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md ring-1 ring-white/20 transition hover:bg-black/60"
                  onClick={() => setLightboxSrc(null)}
                  aria-label="Close"
                >
                  <X className="h-5 w-5" strokeWidth={2.25} />
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {notesLine ? (
          <div className={cn("rounded-xl bg-orange-50/60 p-3.5 ring-1 ring-orange-100/60 dark:bg-orange-950/20 dark:ring-orange-900/40 shadow-[inset_0_1px_3px_rgba(0,0,0,0.02)]", variant === "fullscreen" ? "mt-4" : "mt-3")}>
            <p className="text-[12px] font-black uppercase tracking-[0.14em] text-orange-600/80 dark:text-orange-500/80 mb-1.5">
              Notes & Requirements
            </p>
            <p className={cn("font-medium leading-relaxed text-slate-700 dark:text-zinc-300 whitespace-pre-wrap", variant === "fullscreen" ? "text-[16px]" : "text-[15px]")}>
              {notesLine}
            </p>
          </div>
        ) : null}



        {accepted ? (
          <div className="mt-auto pt-4 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            Accepted · waiting
          </div>
        ) : (
          <div className="mt-auto grid grid-cols-2 gap-3 pt-5">
            <button
              type="button"
              className={panelDeclineBtn}
              onClick={(e) => {
                e.stopPropagation();
                void decline();
              }}
              disabled={busy != null}
            >
              <X className="h-4 w-4" aria-hidden />
              Decline
            </button>
            <button
              type="button"
              className={panelAcceptBtn}
              onClick={(e) => {
                e.stopPropagation();
                void accept();
              }}
              disabled={busy != null}
            >
              <Check className="h-4 w-4" aria-hidden />
              Accept
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

