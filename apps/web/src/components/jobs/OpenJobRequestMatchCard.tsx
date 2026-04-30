import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Baby,
  Check,
  Clock,
  Loader2,
  MapPin,
  MessageCircle,
  MessageSquare,
  Sparkles,
  Star,
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
  const trimmed = photoUrl?.trim() ?? "";

  const sorted = [...gallery].sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const gallerySlides: Slide[] = sorted.map((row) => ({
    key: row.id,
    kind: row.media_type === "video" ? "video" : "image",
    src: publicProfileMediaPublicUrl(row.storage_path),
  }));

  // First slide is the summary (hero + overlays). Remaining slides are gallery only —
  // do not repeat the profile photo as slide 2 (it looked like a “double” image on desktop).
  return [{ key: "summary", kind: "image" as const, src: trimmed }, ...gallerySlides];
}


/** Glass icon row overlaid on the hero image */
const heroOverlayRoundBtn = cn(
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
  "bg-black/35 text-white shadow-lg backdrop-blur-md ring-1 ring-white/20 transition-colors",
  "hover:bg-black/45 active:scale-[0.97]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
  "disabled:pointer-events-none disabled:opacity-55",
);

const roundActionBtn = cn(
  "flex items-center justify-center rounded-full shadow-xl transition-all active:scale-90",
  "ring-1 ring-inset disabled:opacity-50 disabled:pointer-events-none",
);

const acceptRoundBtn = cn(
  roundActionBtn,
  "h-16 w-16 bg-emerald-500 text-white shadow-emerald-500/20 hover:bg-emerald-600 ring-emerald-400/20",
);

const declineRoundBtn = cn(
  roundActionBtn,
  "h-14 w-14 bg-white text-rose-500 ring-zinc-200 hover:bg-rose-50 dark:bg-zinc-800 dark:text-rose-400 dark:ring-zinc-700",
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

  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showContactDropdown) return;
    const clickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowContactDropdown(false);
      }
    };
    window.addEventListener("mousedown", clickOutside);
    return () => window.removeEventListener("mousedown", clickOutside);
  }, [showContactDropdown]);

  const openDirectChat = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setShowContactDropdown(false);
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
      setShowContactDropdown(false);
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
      setShowContactDropdown(false);
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

  const [showFullDetailsModal, setShowFullDetailsModal] = useState(false);

  const allDetailItems = useMemo(() => {
    const items: { label: string; value: string }[] = [];
    if (careFrequencyLine) items.push({ label: "Freq", value: careFrequencyLine });
    if (timeDurationLine) items.push({ label: "Dur", value: timeDurationLine });
    serviceDetailLines.forEach((badge) => items.push(badge));
    return items;
  }, [careFrequencyLine, timeDurationLine, serviceDetailLines]);

  const displayedItems = allDetailItems.slice(0, 6);
  /** Modal can show the same fields as the card (e.g. only FREQ/DUR) plus schedule/budget/photos/notes — still useful. */
  const canOpenDetailsModal =
    allDetailItems.length > 0 ||
    !!scheduleLine ||
    !!budgetLine ||
    jobImages.length > 0 ||
    !!notesLine;

  const ratingAvg = clientRating?.average_rating;
  const ratingCount = clientRating?.total_ratings ?? 0;
  const ratingLine =
    typeof ratingAvg === "number" && Number.isFinite(ratingAvg)
      ? ratingAvg.toFixed(1)
      : null;

  return (
    <>
      <div
        className={cn(
          "group relative flex min-h-0 flex-col",
          variant === "fullscreen" ? "overflow-visible" : "overflow-hidden rounded-[40px]",
          "bg-zinc-900 shadow-2xl shadow-black/40 ring-1 ring-white/10",
          "transition-all duration-500 ease-out",
          variant === "fullscreen"
            ? "h-full rounded-none shadow-none ring-0"
            : "hover:-translate-y-1 hover:shadow-black/50",
        )}

        role="article"
        aria-label="Open request"
      >
        {/* Media section */}
        <div
          className={cn(
            "relative w-full shrink-0 overflow-hidden bg-zinc-900",
            variant === "fullscreen"
              ? "h-[48%] min-h-[16rem]"
              : "aspect-[4/5] min-h-[18rem] max-h-[28rem]",
          )}
        >



          {slides.length === 0 ? (
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />
          ) : (
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
              {slides.map((s, idx) => (
                <div
                  key={s.key}
                  className="relative h-full w-full min-w-full max-w-full shrink-0 snap-start snap-always overflow-hidden"
                >
                  {/* Slide 0: Full-bleed hero + overlays (same on mobile & desktop — no circular crop on mobile). */}
                  {idx === 0 ? (
                    <>
                      <div className="absolute inset-0 z-0 bg-zinc-900">
                        {s.kind === "video" ? (
                          <video src={s.src} className="h-full w-full object-cover" muted playsInline controls />
                        ) : s.src ? (
                          <img src={s.src} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />
                        )}
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/80 via-black/40 to-transparent md:h-40" />
                      </div>

                      <div
                        className={cn(
                          "pointer-events-none absolute inset-x-0 bottom-0 z-[15] px-6 pb-[4.75rem] pt-24 md:px-8 md:pb-[5.25rem]",
                          "flex flex-col items-start gap-2 text-left",
                        )}
                      >
                        <button
                          type="button"
                          className={cn(
                            "pointer-events-auto flex max-w-full flex-wrap items-center gap-2.5 text-left touch-manipulation outline-none",
                            "focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black/40",
                          )}
                          onClick={() => onOpenProfile(row.client_id)}
                          aria-label={`Open profile: ${(row.client_display_name || "").trim() || "Member"}`}
                        >
                          <span className="text-3xl font-black tracking-tight text-white drop-shadow-lg md:text-4xl">
                            {(row.client_display_name || "").trim() || "Member"}
                          </span>
                          {row.client_is_verified && (
                            <BadgeCheck className="h-6 w-6 shrink-0 fill-emerald-500 text-white md:h-8 md:w-8" strokeWidth={2} />
                          )}
                        </button>

                        {ratingLine != null && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 backdrop-blur-md ring-1 ring-white/15">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-base font-bold text-white">{ratingLine}</span>
                            <span className="text-xs font-medium text-zinc-400">({ratingCount})</span>
                          </span>
                        )}

                        <span className="flex flex-wrap items-center gap-2 pt-0.5 text-base font-bold text-zinc-200 drop-shadow-md md:text-lg">
                          <MapPin className="h-5 w-5 shrink-0 text-emerald-400" strokeWidth={2.5} />
                          <span>{row.location_city || "Anywhere"}</span>
                          {dist ? (
                            <>
                              <span className="text-zinc-600">·</span>
                              <span className="tabular-nums text-white">{dist}</span>
                            </>
                          ) : null}
                        </span>
                      </div>

                      <div className="pointer-events-none absolute right-4 top-5 z-[18] md:right-5 md:top-6">
                        <div className="pointer-events-auto flex flex-col items-end gap-2 md:gap-2.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.15em] shadow-xl ring-2 ring-white/10 md:px-5 md:py-2.5 md:text-[11px] md:tracking-[0.2em]",
                              categoryPanelPillClasses(row.service_type),
                            )}
                          >
                            <CategoryIcon serviceType={row.service_type} className="h-3.5 w-3.5 md:h-4.5 md:w-4.5" strokeWidth={3} />
                            {formatTitle(row.service_type)}
                          </span>

                          {row.created_at && (
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 shadow-lg shadow-emerald-950/40 ring-1 ring-white/20 animate-in fade-in slide-in-from-right-4 duration-500 md:px-4 md:py-2">
                              <Clock className="h-3 w-3 text-white md:h-3.5 md:w-3.5" strokeWidth={3} />
                              <span className="text-[9px] font-black uppercase tracking-widest text-white md:text-[11px]">
                                {timeAgo(row.created_at)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {slides.length > 1 && (
                        <div className="pointer-events-none absolute bottom-3 left-1/2 z-[15] flex -translate-x-1/2 items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 animate-pulse md:bottom-4 md:gap-2.5 md:text-[11px] md:tracking-[0.4em]">
                          <span>Photos</span>
                          <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4" />
                        </div>
                      )}
                    </>
                  ) : (


                    <div className="relative h-full w-full">
                      {s.kind === "video" ? (
                        <video
                          src={s.src}
                          className="absolute inset-0 h-full w-full bg-black object-cover"
                          muted
                          playsInline
                          controls
                        />
                      ) : (
                        <img src={s.src} alt="" className="absolute inset-0 h-full w-full bg-black object-cover" />
                      )}
                      
                      {/* Gradients for legibility */}
                      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent z-[10]" />
                      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 to-transparent z-[10]" />
                      
                      {/* Bottom Info: Name, Verification, Rating */}
                      <div className="absolute bottom-6 left-6 z-[20] flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <p className="text-xl font-black text-white drop-shadow-xl md:text-2xl">
                            {(row.client_display_name || "").trim()}
                          </p>
                          {row.client_is_verified && (
                            <BadgeCheck className="h-5 w-5 fill-emerald-500 text-white md:h-6 md:w-6" strokeWidth={2} />
                          )}
                        </div>

                        {/* Rating / Review Badge */}
                        {ratingLine != null && (
                          <div className="flex items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1 backdrop-blur-md ring-1 ring-white/10">
                            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                            <span className="text-sm font-bold text-white">{ratingLine}</span>
                            <span className="text-xs font-medium text-zinc-400">({ratingCount})</span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-bold leading-tight text-zinc-100 drop-shadow-xl md:hidden">
                          <MapPin className="h-4 w-4 shrink-0 text-emerald-400" strokeWidth={2.5} />
                          <span>{row.location_city || "Anywhere"}</span>
                          {dist ? (
                            <>
                              <span className="text-zinc-500">·</span>
                              <span className="tabular-nums">{dist}</span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      {/* Top Right Badges: Category, Time */}
                      <div className="absolute right-5 top-6 z-[20] flex flex-col items-end gap-2.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl ring-2 ring-white/20 backdrop-blur-md",
                            categoryPanelPillClasses(row.service_type),
                          )}
                        >
                          <CategoryIcon serviceType={row.service_type} className="h-4.5 w-4.5" strokeWidth={3} />
                          {formatTitle(row.service_type)}
                        </span>

                        {row.created_at && (
                          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-600/90 px-4 py-2 shadow-xl shadow-emerald-950/40 ring-1 ring-white/30 backdrop-blur-md animate-in fade-in slide-in-from-right-4 duration-500">
                            <Clock className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                            <span className="text-[11px] font-black uppercase tracking-widest text-white">
                              {timeAgo(row.created_at)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>


                  )}
                </div>
              ))}
            </div>
          )}


          {/* Pagination dots (Hidden on Summary Slide for Mobile) */}
          {showStrip && (
            <div
              className={cn(
                "pointer-events-none absolute bottom-4 left-1/2 z-[30] -translate-x-1/2 transition-opacity duration-300",
                activeIndex === 0 ? "opacity-0 md:opacity-100" : "opacity-100",
              )}
            >
              <div className="flex gap-1.5 rounded-full bg-black/10 px-2 py-1.5 backdrop-blur-md">
                {slides.map((_, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "h-1 rounded-full transition-all duration-300",
                      idx === activeIndex ? "w-4 bg-emerald-500" : "w-1 bg-white/40",
                    )}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Details section */}
        <div
          className={cn(
            "relative flex min-h-0 flex-1 flex-col bg-zinc-900 p-4 pt-3 md:p-6 md:pt-5",
            variant === "grid" &&
              "pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]",
          )}
        >
          <div
            className={cn(
              "min-h-0 flex-1",
              variant === "fullscreen" && "overflow-y-auto overscroll-contain",
            )}
          >
            <div className="mb-3 hidden max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-2 max-md:gap-y-1 max-md:border-b max-md:border-white/10 max-md:pb-3">
              <MapPin className="h-4 w-4 shrink-0 text-emerald-500" strokeWidth={2.5} />
              <span className="min-w-0 font-bold text-zinc-100">{row.location_city || "Anywhere"}</span>
              {dist ? <span className="tabular-nums text-sm text-zinc-400">{dist}</span> : null}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:gap-x-6 md:gap-y-3">
              {displayedItems.map((item, idx) => (
                <div key={idx} className="flex min-w-0 flex-col gap-0.5 md:gap-1">
                  <span className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-500 md:text-[11px] md:tracking-[0.2em]">
                    {item.label}
                  </span>
                  <span className="line-clamp-3 break-words text-[15px] font-bold leading-snug text-zinc-100 md:text-base">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            {(respondsWithinLabel || canStartInLabel) && (
              <div className="mt-3 space-y-1.5 text-[11px] leading-snug text-zinc-400 md:mt-4 md:text-xs">
                {respondsWithinLabel ? (
                  <p>
                    <span className="font-black uppercase tracking-wider text-zinc-500">Replies </span>
                    {respondsWithinLabel}
                  </p>
                ) : null}
                {canStartInLabel ? (
                  <p>
                    <span className="font-black uppercase tracking-wider text-zinc-500">You </span>
                    {canStartInLabel}
                  </p>
                ) : null}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between md:mt-6">
              {canOpenDetailsModal ? (
                <button
                  type="button"
                  className="group flex items-center gap-2 text-[13px] font-black uppercase tracking-widest text-emerald-500"
                  onClick={() => setShowFullDetailsModal(true)}
                >
                  Request Details
                  <Sparkles className="h-4 w-4 transition-transform group-hover:rotate-12" />
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-5">
                <button
                  type="button"
                  className="flex items-center gap-2.5 text-zinc-500 transition-colors hover:text-zinc-300"
                  onClick={() => onOpenComments?.(row.id)}
                >
                  <MessageSquare className="h-5 w-5" strokeWidth={2.5} />
                  {commentCount > 0 && <span className="text-sm font-black tabular-nums">{commentCount}</span>}
                </button>

                {/* Icon-only — hero already shows the client photo */}
                {viewerId && (
                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      className={cn(
                        heroOverlayRoundBtn,
                        "h-10 w-10 bg-zinc-800/90 text-white ring-zinc-600",
                        showContactDropdown && "ring-2 ring-emerald-500 ring-offset-2 ring-offset-zinc-900",
                      )}
                      aria-label="Contact client"
                      aria-expanded={showContactDropdown}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowContactDropdown(!showContactDropdown);
                      }}
                      disabled={chatOpening}
                    >
                      <MessageCircle className="h-5 w-5" strokeWidth={2.25} />
                    </button>

                  {showContactDropdown && (
                    <div
                      className="absolute bottom-12 right-0 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200 z-[50]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className={cn(heroOverlayRoundBtn, "h-11 w-11 bg-zinc-800 ring-zinc-700")}
                        onClick={(e) => void openDirectChat(e)}
                        disabled={chatOpening}
                        aria-busy={chatOpening}
                      >
                        {chatOpening ? (
                          <Loader2 className="h-5 w-5 animate-spin text-white" aria-hidden />
                        ) : (
                          <MessageSquare className="h-5 w-5 text-white" strokeWidth={2.5} />
                        )}
                      </button>
                      <button
                        type="button"
                        className={cn(heroOverlayRoundBtn, "h-11 w-11 bg-zinc-800 ring-zinc-700")}
                        onClick={(e) => void openWhatsApp(e)}
                        disabled={socialBusy != null}
                        aria-busy={socialBusy === "wa"}
                      >
                        {socialBusy === "wa" ? (
                          <Loader2 className="h-5 w-5 animate-spin text-white" aria-hidden />
                        ) : (
                          <WhatsAppIcon size={22} className="text-white" />
                        )}
                      </button>
                      <button
                        type="button"
                        className={cn(heroOverlayRoundBtn, "h-11 w-11 bg-zinc-800 ring-zinc-700")}
                        onClick={(e) => void openTelegram(e)}
                        disabled={socialBusy != null}
                        aria-busy={socialBusy === "tg"}
                      >
                        {socialBusy === "tg" ? (
                          <Loader2 className="h-5 w-5 animate-spin text-white" aria-hidden />
                        ) : (
                          <TelegramIcon size={20} className="text-white" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          </div>

          {/* Action buttons — in document flow so they are not clipped by overflow / safe areas */}
          <div
            className={cn(
              "mt-auto flex shrink-0 items-center justify-center gap-10 pt-4",
              variant === "fullscreen"
                ? "pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
                : "pb-2 md:pb-1 md:pt-3",
            )}
          >
            {accepted ? (
              <div className="rounded-2xl bg-zinc-100 px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:bg-zinc-800">
                Accepted · Pending
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className={declineRoundBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    void decline();
                  }}
                  disabled={busy != null}
                  aria-label="Decline"
                >
                  <X className="h-8 w-8" strokeWidth={3} />
                </button>
                <button
                  type="button"
                  className={acceptRoundBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    void accept();
                  }}
                  disabled={busy != null}
                  aria-label="Accept"
                >
                  <Check className="h-10 w-10" strokeWidth={3.5} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>








      {/* Full Details Modal */}
      {showFullDetailsModal && (
        <div
          className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center"
          onClick={() => setShowFullDetailsModal(false)}
        >
          <div
            className="relative flex h-[80vh] w-full flex-col rounded-t-[24px] bg-white shadow-2xl animate-in slide-in-from-bottom-6 dark:bg-zinc-900 md:h-auto md:max-h-[85vh] md:max-w-lg md:rounded-[24px]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
              <h3 className="text-base font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                Request Details
              </h3>
              <button
                type="button"
                className="rounded-full p-2 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                onClick={() => setShowFullDetailsModal(false)}
              >
                <X className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-6">
              <div className="space-y-6">
                {/* Details List */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-6">
                  {allDetailItems.map((item, idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400 dark:text-zinc-500">
                        {item.label}
                      </span>
                      <span className="text-base font-bold text-zinc-800 dark:text-zinc-200">{item.value}</span>
                    </div>
                  ))}
                </div>


                {scheduleLine && (
                  <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
                    <p className="mb-1 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-400">Schedule</p>
                    <p className="text-base font-bold text-zinc-800 dark:text-zinc-100">{scheduleLine}</p>
                  </div>
                )}

                {budgetLine && (
                  <div className="rounded-2xl bg-emerald-50/50 p-4 dark:bg-emerald-950/20">
                    <p className="mb-1 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-600/80">Budget</p>
                    <p className="text-base font-extrabold text-emerald-700 dark:text-emerald-500">{budgetLine}</p>
                  </div>
                )}

                {jobImages.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-400">Request Photos</p>
                    <div className="grid grid-cols-2 gap-2">
                      {jobImages.map((src, idx) => (
                        <div key={idx} className="aspect-square overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
                          <img
                            src={src}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onClick={() => setLightboxSrc(src)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {notesLine && (
                  <div className="rounded-2xl bg-orange-50/60 p-4 ring-1 ring-orange-100/60 dark:bg-orange-950/20 dark:ring-orange-900/40">
                    <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-orange-600/80">
                      Notes & Requirements
                    </p>
                    <p className="whitespace-pre-wrap text-[15px] font-medium leading-relaxed text-zinc-700 dark:text-zinc-300">
                      {notesLine}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-zinc-100 p-6 dark:border-zinc-800">
              <button
                type="button"
                className="w-full h-12 rounded-xl bg-zinc-900 text-[15px] font-bold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                onClick={() => setShowFullDetailsModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Lightbox */}
      {lightboxSrc && (
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
      )}
    </>
  );
}

