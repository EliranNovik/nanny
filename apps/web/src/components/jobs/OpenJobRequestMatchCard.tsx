import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Baby,
  Check,
  Clock,
  Loader2,
  MapPin,
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
import { JOB_CARD_OUTER_CORNER } from "@/components/jobs/jobCardSharedClasses";
import { isFreelancerInActive24hLiveWindow } from "@/lib/freelancerLiveWindow";

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
  /** Helpers with `job_confirmations.status = available` (migration 076). */
  open_accept_count?: number | string | null;
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

function serviceHeroImageSrc(job: { service_type: string | null }) {
  const t = (job.service_type ?? "").toLowerCase();
  if (t === "cleaning") return "/cleaning-mar22.png";
  if (t === "cooking") return "/cooking-mar22.png";
  if (t === "pickup_delivery") return "/pickup-mar22.png";
  if (t === "nanny") return "/nanny-mar22.png";
  if (t === "other_help") return "/other-mar22.png";
  return "/nanny-mar22.png";
}


const roundActionBtn = cn(
  "flex items-center justify-center rounded-full shadow-xl transition-all active:scale-90",
  "ring-1 ring-inset disabled:opacity-50 disabled:pointer-events-none",
);

const acceptRoundBtn = cn(
  roundActionBtn,
  "h-16 w-16 bg-emerald-500 text-white shadow-emerald-500/20 hover:bg-emerald-600 ring-emerald-400/20 md:h-20 md:w-20",
);

const declineRoundBtn = cn(
  roundActionBtn,
  // No shadow/outline: keep it visually lightweight vs Accept.
  "h-14 w-14 bg-rose-50 text-rose-600 shadow-none ring-0 hover:bg-rose-100",
  "dark:bg-rose-950/25 dark:text-rose-300 dark:hover:bg-rose-950/35",
);

/** Posted-at time on hero — bottom-right, frosted black glass */
const postedTimeGlassBadge = cn(
  "pointer-events-none inline-flex items-center gap-1.5",
  "px-0 py-0 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]",
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
 * Category badge shown on the hero image (top-right).
 * We keep it readable over photos by using higher opacity + strong text.
 */
function heroCategoryBadgeClasses(serviceType: string | null | undefined): string {
  const k = (serviceType ?? "").toLowerCase();
  const base = cn(
    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-black uppercase tracking-wider text-white",
    "shadow-lg backdrop-blur-md ring-1 ring-inset ring-white/15 md:px-5 md:py-2.5 md:text-[13px]",
  );

  if (k.includes("clean")) return cn(base, "bg-emerald-600/70");
  if (k.includes("cook") || k.includes("chef") || k.includes("food")) return cn(base, "bg-amber-600/70");
  if (k.includes("nanny") || k.includes("bab") || k.includes("sit")) return cn(base, "bg-rose-600/70");
  if (k.includes("pickup") || k.includes("deliver") || k.includes("truck")) return cn(base, "bg-sky-600/70");
  return cn(base, "bg-violet-600/70");
}

function CategoryBadge({
  serviceType,
  formatTitle,
  compact = false,
}: {
  serviceType: string | null | undefined;
  formatTitle: (serviceType: string | null | undefined) => string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        heroCategoryBadgeClasses(serviceType),
        compact && "gap-1.5 px-2.5 py-1 text-[10px] shadow-md",
      )}
    >
      <CategoryIcon
        serviceType={serviceType}
        className={cn(
          "shrink-0",
          compact ? "h-3.5 w-3.5" : "h-4.5 w-4.5 md:h-5 md:w-5",
        )}
        strokeWidth={2.5}
      />
      <span className={cn("truncate", compact ? "max-w-[9rem]" : "max-w-[14rem]")}>
        {formatTitle(serviceType)}
      </span>
    </div>
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
  clientLiveUntil,
  variant = "grid",
  commentCount = 0,
  onOpenComments,
}: {
  row: OpenJobRequestMatchRow;
  gallery: PublicProfileGalleryRow[];
  formatTitle: (serviceType: string | null | undefined) => string;
  onAccept: (jobId: string, note?: string) => Promise<void> | void;
  onDecline: (jobId: string) => Promise<void> | void;
  onOpenProfile: (userId: string) => void;
  variant?: "grid" | "fullscreen";
  clientRating?: { average_rating: number | null; total_ratings: number | null } | null;
  clientLiveUntil?: string | null;
  commentCount?: number;
  onOpenComments?: (jobId: string) => void;
}) {
  const { user: currentUser } = useAuth();
  const viewerId = currentUser?.id;
  const { addToast } = useToast();
  const [busy, setBusy] = useState<null | "accept" | "decline">(null);
  const [chatOpening, setChatOpening] = useState(false);
  const [socialBusy, setSocialBusy] = useState<"wa" | "tg" | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const profileSlides = useMemo(
    () => buildSlides(row.client_photo_url, gallery),
    [row.client_photo_url, gallery],
  );
  // Images uploaded to the job request (stored as public URLs in service_details.images)
  const jobImages = useMemo(() => {
    const imgs = (row.service_details as Record<string, unknown> | null)?.images;
    if (!Array.isArray(imgs)) return [] as string[];
    return (imgs as unknown[]).filter(
      (u): u is string => typeof u === "string" && u.trim().length > 0,
    );
  }, [row.service_details]);

  const heroSlides = useMemo(() => {
    if (jobImages.length > 0) {
      return jobImages.map((src, idx) => ({
        key: `job-${idx}-${src}`,
        kind: "image" as const,
        src,
      }));
    }
    const fallback = serviceHeroImageSrc({ service_type: row.service_type });
    return fallback
      ? [{ key: "category", kind: "image" as const, src: fallback }]
      : ([] as Slide[]);
  }, [jobImages, row.service_type]);

  const showStrip = heroSlides.length > 1;
  const [activeIndex, setActiveIndex] = useState(0);
  const [showClientGalleryModal, setShowClientGalleryModal] = useState(false);
  const [clientGalleryStartIndex, setClientGalleryStartIndex] = useState(0);
  const clientGalleryScrollRef = useRef<HTMLDivElement>(null);

  const syncIndex = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const next = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    setActiveIndex(Math.max(0, Math.min(heroSlides.length - 1, next)));
  }, [heroSlides.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: 0, behavior: "auto" });
    setActiveIndex(0);
  }, [row.id, heroSlides.map((s) => s.key).join("|")]);

  useEffect(() => {
    if (!showClientGalleryModal) return;
    const el = clientGalleryScrollRef.current;
    if (!el) return;
    // next frame: ensure layout measured before scrolling
    requestAnimationFrame(() => {
      const w = Math.max(1, el.clientWidth);
      el.scrollTo({ left: clientGalleryStartIndex * w, behavior: "auto" });
    });
  }, [showClientGalleryModal, clientGalleryStartIndex]);

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

  const fullNotesText = useMemo(() => {
    let t = (row.notes || "").trim();
    if (parsedDetails.notes.length > 0) {
      const merged = parsedDetails.notes.join("\n\n");
      t = t ? `${merged}\n\n${t}` : merged;
    }
    return t || null;
  }, [row.notes, parsedDetails.notes]);

  const accepted = row.__accepted === true;

  const openAcceptCountDisplay = useMemo(() => {
    const raw = row.open_accept_count;
    const n = typeof raw === "string" ? Number(raw) : raw;
    if (typeof n !== "number" || !Number.isFinite(n)) return 0;
    return Math.max(0, Math.floor(n));
  }, [row.open_accept_count]);

  const [contactInfo, setContactInfo] = useState<{
    waNumber: string | null;
    tgUsername: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const clientId = row.client_id;

    if (!viewerId || !clientId) {
      setContactInfo(null);
      return;
    }

    void (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select(
            "whatsapp_number_e164, share_whatsapp, telegram_username, share_telegram",
          )
          .eq("id", clientId)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;

        const waNumber =
          data?.share_whatsapp && data?.whatsapp_number_e164
            ? String(data.whatsapp_number_e164).trim()
            : null;
        const tgUsername =
          data?.share_telegram && data?.telegram_username
            ? String(data.telegram_username).trim()
            : null;

        setContactInfo({
          waNumber: waNumber || null,
          tgUsername: tgUsername || null,
        });
      } catch {
        if (!cancelled) setContactInfo(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [row.client_id, viewerId]);

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
      if (contactInfo?.waNumber) {
        window.open(
          getWhatsAppLink(String(contactInfo.waNumber)),
          "_blank",
          "noopener,noreferrer",
        );
        return;
      }
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
    [addToast, contactInfo?.waNumber, row.client_id],
  );

  const openTelegram = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!row.client_id) return;
      if (contactInfo?.tgUsername) {
        window.open(
          getTelegramLink(String(contactInfo.tgUsername)),
          "_blank",
          "noopener,noreferrer",
        );
        return;
      }
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
    [addToast, contactInfo?.tgUsername, row.client_id],
  );

  const [showFullDetailsModal, setShowFullDetailsModal] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);

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
  const showLiveDot = isFreelancerInActive24hLiveWindow({ live_until: clientLiveUntil ?? null });

  return (
    <>
      <div
        className={cn(
          "group relative flex min-h-0 flex-col overflow-hidden",
          JOB_CARD_OUTER_CORNER,
          "max-md:rounded-[28px]",
          // Mobile keeps a distinct card surface; desktop blends into page background.
          "bg-white text-slate-900 ring-1 ring-slate-200/80 transition-all duration-500 ease-out",
          "shadow-lg shadow-slate-900/[0.08] md:bg-transparent md:ring-0 md:shadow-none",
          "dark:bg-zinc-900 dark:text-zinc-100 dark:ring-white/10 dark:shadow-2xl dark:shadow-black/40",
          variant === "fullscreen"
            ? "h-full shadow-md shadow-slate-900/10 dark:shadow-none dark:ring-0"
            : "max-md:hover:-translate-y-1 max-md:hover:shadow-xl max-md:hover:shadow-slate-900/12 dark:max-md:hover:shadow-black/50",
        )}

        role="article"
        aria-label="Open request"
      >
        {/* Media section */}
        <div
          className={cn(
            "relative w-full shrink-0 overflow-hidden bg-zinc-900",
            variant === "fullscreen"
              ? "h-[44%] min-h-[14rem] max-h-[50vh]"
              : "aspect-[16/10] min-h-[14.5rem] max-h-[22rem] md:aspect-[16/9] md:min-h-[15.5rem] md:max-h-[24rem]",
          )}
        >



          {heroSlides.length === 0 ? (
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
                "overscroll-x-contain [-webkit-overflow-scrolling:touch] touch-pan-x",
              )}
            >
              {heroSlides.map((s) => (
                <div
                  key={s.key}
                  className="relative h-full w-full min-w-full max-w-full shrink-0 snap-start snap-always overflow-hidden"
                >
                  <div className="absolute inset-0 z-0 bg-zinc-900">
                    {s.kind === "video" ? (
                      <video
                        src={s.src}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                        controls
                      />
                    ) : s.src ? (
                      <img
                        src={s.src}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onClick={() => setLightboxSrc(s.src)}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />
                    )}
                    {/* Top overlay for legibility — image only (sits behind UI) */}
                    <div
                      className="pointer-events-none absolute inset-x-0 top-0 z-[10] h-24 bg-gradient-to-b from-black/55 via-black/18 to-transparent md:h-28"
                      aria-hidden
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/75 via-black/25 to-transparent md:h-40" />
                  </div>

                  {/* Top-left: avatar + name + rating (YouTube-style) */}
                  <div className="absolute left-4 top-4 z-[20]">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        className={cn(
                          "pointer-events-auto inline-flex items-center justify-center overflow-hidden rounded-full bg-white/10 shadow-lg backdrop-blur-xl transition hover:bg-white/15",
                          // Bigger avatar + Tebnu purple outline (matches Discover profile card accent)
                          "h-16 w-16 ring-4 ring-[#7B61FF]/55 ring-offset-2 ring-offset-white/85 md:h-[74px] md:w-[74px]",
                          "dark:ring-[#A78BFA]/40 dark:ring-offset-[#121212]/70",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55",
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenProfile(row.client_id);
                        }}
                        aria-label={`Open profile: ${(row.client_display_name || "").trim() || "Member"}`}
                      >
                        {showLiveDot ? (
                          <span className="pointer-events-none absolute right-1.5 top-1.5 z-[2] h-3.5 w-3.5 rounded-full bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.85)] ring-2 ring-white/70" />
                        ) : null}
                        {row.client_photo_url ? (
                          <img
                            src={row.client_photo_url}
                            alt=""
                            className="h-full w-full object-cover"
                            draggable={false}
                          />
                        ) : (
                          <span className="text-base font-black text-white">
                            {((row.client_display_name || "M").trim() || "M")
                              .charAt(0)
                              .toUpperCase()}
                          </span>
                        )}
                      </button>

                      <div className="min-w-0 max-w-[min(22rem,72vw)] pt-0.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="pointer-events-auto truncate text-left text-[16px] font-black tracking-tight text-white drop-shadow hover:underline underline-offset-4 md:text-[17px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenProfile(row.client_id);
                            }}
                            aria-label={`Open profile: ${(row.client_display_name || "").trim() || "Member"}`}
                          >
                            {(row.client_display_name || "").trim() || "Member"}
                          </button>
                          {row.client_is_verified ? (
                            <BadgeCheck
                              className="h-5 w-5 shrink-0 fill-emerald-500 text-white drop-shadow md:h-[22px] md:w-[22px]"
                              aria-label="Verified"
                              strokeWidth={2}
                            />
                          ) : null}
                        </div>
                        {ratingLine != null ? (
                          <div className="mt-0.5 inline-flex items-center gap-2 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-[13px] font-extrabold tabular-nums md:text-[14px]">
                              {ratingLine}
                            </span>
                            <span className="text-[12px] font-semibold text-white/70 tabular-nums md:text-[13px]">
                              ({Number(ratingCount) || 0})
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Bottom-right: posted time */}
                  {row.created_at ? (
                    <div className="pointer-events-none absolute bottom-4 right-4 z-[21]">
                      <div className={postedTimeGlassBadge}>
                        <Clock
                          className="h-3.5 w-3.5 shrink-0 text-white/90"
                          strokeWidth={2.5}
                        />
                        <span className="text-[11px] font-black uppercase tracking-widest text-white/95">
                          {timeAgo(row.created_at)}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {/* Top-right: category badge (desktop only) */}
                  <div className="pointer-events-none absolute right-4 top-4 z-[23] hidden md:block">
                    <CategoryBadge
                      serviceType={row.service_type}
                      formatTitle={formatTitle}
                    />
                  </div>

                  {/* Bottom-left: client public profile media mini-carousel */}
                  {profileSlides.length > 1 ? (
                    <div className="absolute bottom-4 left-4 z-[22] flex items-end gap-2">
                      <div className="flex items-center gap-2 rounded-xl bg-black/30 p-2 backdrop-blur-md">
                        {profileSlides.slice(1, 5).map((s, idx) => {
                          const absoluteIndex = idx + 1;
                          return (
                            <button
                              key={s.key}
                              type="button"
                              className="group relative h-12 w-12 overflow-hidden rounded-xl bg-white/10 shadow-md transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55 md:h-14 md:w-14"
                              onClick={(e) => {
                                e.stopPropagation();
                                setClientGalleryStartIndex(absoluteIndex);
                                setShowClientGalleryModal(true);
                              }}
                              aria-label="Open client gallery"
                            >
                              {s.kind === "video" ? (
                                <>
                                  <video
                                    src={s.src}
                                    className="h-full w-full object-cover"
                                    muted
                                    playsInline
                                    preload="metadata"
                                  />
                                  <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/20">
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/40">
                                      <span className="ml-[1px] h-0 w-0 border-y-[5px] border-y-transparent border-l-[7px] border-l-white/90" />
                                    </span>
                                  </span>
                                </>
                              ) : (
                                <img
                                  src={s.src}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  draggable={false}
                                />
                              )}
                            </button>
                          );
                        })}

                        {profileSlides.length > 5 ? (
                          <button
                            type="button"
                            className="relative h-12 w-12 rounded-xl bg-white/10 text-[12px] font-black text-white shadow-md hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55 md:h-14 md:w-14"
                            onClick={(e) => {
                              e.stopPropagation();
                              setClientGalleryStartIndex(1);
                              setShowClientGalleryModal(true);
                            }}
                            aria-label="Open all client media"
                          >
                            +{profileSlides.length - 5}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}


          {/* Pagination dots — all slides including profile hero */}
          {showStrip && (
            <div
              className="pointer-events-none absolute bottom-4 left-1/2 z-[30] -translate-x-1/2"
            >
              <div className="flex gap-1.5 rounded-full bg-slate-900/10 px-2 py-1.5 backdrop-blur-md dark:bg-black/10">
                {heroSlides.map((_, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "h-1 rounded-full transition-all duration-300",
                      idx === activeIndex
                        ? "w-4 bg-emerald-500"
                        : "w-1 bg-slate-400/60 dark:bg-white/40",
                    )}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Details section — light panel in light mode, dark in dark mode */}
        <div
          className={cn(
            "relative flex min-h-0 flex-1 flex-col border-t p-4 pt-3 md:p-6 md:pt-5",
            // Desktop: match page background + remove outlines.
            "border-slate-200/90 bg-slate-50 text-slate-900 md:border-transparent md:bg-transparent",
            "dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100",
            variant === "grid" &&
              "pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]",
          )}
        >
          <div
            className={cn(
              "min-h-0 flex-1",
              variant === "fullscreen" && "overflow-hidden",
            )}
          >
            <div className="mb-3 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-slate-200/90 pb-3 dark:border-white/10">
              <MapPin className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-500" strokeWidth={2.5} />
              <span className="min-w-0 font-bold text-slate-900 dark:text-zinc-100">
                {row.location_city || "Anywhere"}
              </span>
              <div className="shrink-0 md:hidden">
                <CategoryBadge
                  serviceType={row.service_type}
                  formatTitle={formatTitle}
                  compact
                />
              </div>
              {dist ? (
                <span className="tabular-nums text-sm text-slate-500 dark:text-zinc-400">{dist}</span>
              ) : null}
              {viewerId ? (
                <div className="ml-auto flex items-center gap-2 md:hidden">
                  <button
                    type="button"
                    className={cn(
                      "inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-colors",
                      "hover:text-slate-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2",
                      "dark:text-zinc-300 dark:hover:text-white dark:focus-visible:ring-offset-zinc-900",
                    )}
                    onClick={(e) => void openDirectChat(e)}
                    disabled={chatOpening}
                    aria-busy={chatOpening}
                    aria-label="Contact me"
                  >
                    {chatOpening ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    ) : (
                      <MessageSquare className="h-6 w-6" strokeWidth={2.6} aria-hidden />
                    )}
                  </button>

                  {contactInfo?.waNumber ? (
                    <button
                      type="button"
                      className={cn(
                        "inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-colors",
                        "hover:text-slate-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2",
                        "dark:text-zinc-300 dark:hover:text-white dark:focus-visible:ring-offset-zinc-900",
                      )}
                      onClick={(e) => void openWhatsApp(e)}
                      disabled={socialBusy != null}
                      aria-busy={socialBusy === "wa"}
                      aria-label="Open WhatsApp"
                    >
                      {socialBusy === "wa" ? (
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                      ) : (
                        <WhatsAppIcon size={26} className="text-emerald-600 dark:text-emerald-400" />
                      )}
                    </button>
                  ) : null}

                  {contactInfo?.tgUsername ? (
                    <button
                      type="button"
                      className={cn(
                        "inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-colors",
                        "hover:text-slate-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2",
                        "dark:text-zinc-300 dark:hover:text-white dark:focus-visible:ring-offset-zinc-900",
                      )}
                      onClick={(e) => void openTelegram(e)}
                      disabled={socialBusy != null}
                      aria-busy={socialBusy === "tg"}
                      aria-label="Open Telegram"
                    >
                      {socialBusy === "tg" ? (
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                      ) : (
                        <TelegramIcon size={24} className="text-sky-600 dark:text-sky-400" />
                      )}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {viewerId ? (
                <div className="hidden md:ml-auto md:flex items-center gap-3">
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-[12px] font-black uppercase tracking-wider text-white shadow-lg",
                      "hover:bg-black/90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2",
                      "dark:focus-visible:ring-white/25 dark:focus-visible:ring-offset-zinc-900",
                      chatOpening && "opacity-75",
                    )}
                    onClick={(e) => void openDirectChat(e)}
                    disabled={chatOpening}
                    aria-busy={chatOpening}
                    aria-label="Contact me"
                  >
                    {chatOpening ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    ) : (
                      <MessageSquare className="h-5 w-5" strokeWidth={2.75} aria-hidden />
                    )}
                    Contact me
                  </button>

                  {contactInfo?.waNumber ? (
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center justify-center rounded-full p-2 text-slate-500 transition-colors",
                        "hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2",
                        "dark:text-zinc-500 dark:hover:bg-white/5 dark:hover:text-zinc-200 dark:focus-visible:ring-offset-zinc-900",
                        socialBusy != null && "opacity-70",
                      )}
                      onClick={(e) => void openWhatsApp(e)}
                      disabled={socialBusy != null}
                      aria-busy={socialBusy === "wa"}
                      aria-label="Open WhatsApp"
                    >
                      {socialBusy === "wa" ? (
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                      ) : (
                        <WhatsAppIcon size={24} className="text-emerald-600 dark:text-emerald-400" />
                      )}
                    </button>
                  ) : null}

                  {contactInfo?.tgUsername ? (
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center justify-center rounded-full p-2 text-slate-500 transition-colors",
                        "hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2",
                        "dark:text-zinc-500 dark:hover:bg-white/5 dark:hover:text-zinc-200 dark:focus-visible:ring-offset-zinc-900",
                        socialBusy != null && "opacity-70",
                      )}
                      onClick={(e) => void openTelegram(e)}
                      disabled={socialBusy != null}
                      aria-busy={socialBusy === "tg"}
                      aria-label="Open Telegram"
                    >
                      {socialBusy === "tg" ? (
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                      ) : (
                        <TelegramIcon size={22} className="text-sky-600 dark:text-sky-400" />
                      )}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-3 md:gap-x-6 md:gap-y-3">
              {displayedItems.map((item, idx) => (
                <div key={idx} className="flex min-w-0 flex-col gap-0.5 md:gap-1">
                  <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 md:text-[11px] md:tracking-[0.2em] dark:text-zinc-500">
                    {item.label}
                  </span>
                  <span className="line-clamp-3 break-words text-[15px] font-bold leading-snug text-slate-900 md:text-base dark:text-zinc-100">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Desktop: show notes (1-line collapsed, click to expand). */}
            {fullNotesText ? (
              <div className="mt-4 hidden md:block">
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-xl bg-zinc-100/70 px-4 py-3 text-left",
                    "hover:bg-zinc-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "dark:border-white/10 dark:bg-black/20 dark:hover:bg-black/30",
                  )}
                  aria-expanded={notesExpanded}
                  onClick={() => setNotesExpanded((v) => !v)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700/80 dark:text-emerald-400/80">
                      Notes
                    </span>
                    <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-zinc-500">
                      {notesExpanded ? "Less" : "More"}
                    </span>
                  </div>
                  {notesExpanded ? (
                    <p className="mt-2 whitespace-pre-wrap text-[15px] font-semibold leading-relaxed text-slate-800 dark:text-zinc-200">
                      {fullNotesText}
                    </p>
                  ) : (
                    <p className="mt-2 line-clamp-1 text-[15px] font-semibold text-slate-800 dark:text-zinc-200">
                      {fullNotesText}
                    </p>
                  )}
                </button>
              </div>
            ) : null}

            {/* Mobile: show notes box and open Request Details modal on tap. */}
            {canOpenDetailsModal ? (
              <div className="mt-4 md:hidden">
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-2xl bg-zinc-100/70 px-4 py-3 text-left",
                    "hover:bg-zinc-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "dark:border-white/10 dark:bg-black/20 dark:hover:bg-black/30",
                  )}
                  onClick={() => setShowFullDetailsModal(true)}
                  aria-label="Open request details"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700/80 dark:text-emerald-400/80">
                      Notes
                    </span>
                    <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-zinc-500">
                      Tap to open
                    </span>
                  </div>
                  {fullNotesText ? (
                    <p className="mt-2 line-clamp-2 text-[15px] font-semibold leading-relaxed text-slate-800 dark:text-zinc-200">
                      {fullNotesText}
                    </p>
                  ) : (
                    <p className="mt-2 line-clamp-2 text-[15px] font-semibold leading-relaxed text-slate-500 dark:text-zinc-400">
                      Tap to see details
                    </p>
                  )}
                </button>
              </div>
            ) : null}
          </div>

          {/* Decline left · comments + contact + accept on the right */}
          <div
            className={cn(
              "mt-auto flex w-full min-w-0 shrink-0 items-center justify-between gap-4 px-2 pt-4 md:gap-5",
              variant === "fullscreen"
                ? "pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
                : "pb-2 md:px-3 md:pb-1 md:pt-3",
            )}
          >
            {accepted ? (
              <div className="flex w-full justify-center py-0.5">
                <div className="rounded-2xl bg-zinc-100 px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:bg-zinc-800">
                  Accepted · Pending
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className={cn(declineRoundBtn, "shrink-0")}
                  onClick={(e) => {
                    e.stopPropagation();
                    void decline();
                  }}
                  disabled={busy != null}
                  aria-label="Decline"
                >
                  <X className="h-8 w-8" strokeWidth={3} />
                </button>
                <div className="flex min-w-0 flex-1 items-center justify-end">
                  <div className="relative shrink-0">
                    {openAcceptCountDisplay > 0 ? (
                      <div
                        className={cn(
                          "pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 max-w-[min(100vw-6rem,14rem)] -translate-x-1/2 whitespace-nowrap rounded-full border border-emerald-600/10 bg-emerald-500/[0.07] px-2.5 py-1 text-center shadow-sm",
                          "text-[11px] leading-snug text-emerald-900/80 dark:border-emerald-400/15 dark:bg-emerald-400/[0.08] dark:text-emerald-100/75",
                          "motion-safe:animate-pulse",
                        )}
                        role="status"
                      >
                        <span className="font-semibold tabular-nums text-emerald-800 dark:text-emerald-200/90">
                          {openAcceptCountDisplay > 99 ? "99+" : openAcceptCountDisplay}
                        </span>
                        <span className="font-medium text-emerald-800/75 dark:text-emerald-200/65">
                          {" "}
                          already accepted
                        </span>
                      </div>
                    ) : null}
                    <>
                      {/* Mobile: round accept button */}
                      <button
                        type="button"
                        className={cn(acceptRoundBtn, "shrink-0 md:hidden")}
                        onClick={(e) => {
                          e.stopPropagation();
                          void accept();
                        }}
                        disabled={busy != null}
                        aria-label={
                          openAcceptCountDisplay > 0
                            ? `Accept request — ${openAcceptCountDisplay} helper${
                                openAcceptCountDisplay === 1 ? "" : "s"
                              } already accepted`
                            : "Accept request"
                        }
                      >
                        <Check className="h-10 w-10" strokeWidth={3.5} />
                      </button>

                      {/* Desktop: text button */}
                      <button
                        type="button"
                        className={cn(
                          "hidden md:inline-flex items-center gap-2 rounded-full px-6 py-3",
                          "bg-emerald-500 text-white shadow-xl shadow-emerald-500/20",
                          "hover:bg-emerald-600 active:bg-emerald-700 active:scale-[0.99]",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                          "disabled:pointer-events-none disabled:opacity-60",
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          void accept();
                        }}
                        disabled={busy != null}
                        aria-label="Accept request"
                      >
                        <Check className="h-5 w-5" strokeWidth={3} aria-hidden />
                        <span className="text-[12px] font-black uppercase tracking-[0.18em]">
                          Accept request
                        </span>
                      </button>
                    </>
                  </div>
                  <div className="ml-6 flex shrink-0 items-center gap-3 sm:ml-8 sm:gap-3.5">
                    <button
                      type="button"
                      className="flex shrink-0 items-center gap-1.5 text-slate-500 transition-colors hover:text-slate-800 dark:text-zinc-500 dark:hover:text-zinc-300 md:hidden"
                      onClick={() => onOpenComments?.(row.id)}
                      aria-label="Comments"
                    >
                      <MessageSquare className="h-5 w-5" strokeWidth={2.5} />
                      {commentCount > 0 ? (
                        <span className="text-sm font-black tabular-nums">{commentCount}</span>
                      ) : null}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>








      {/* Full Details Modal (mobile only) */}
      {showFullDetailsModal && (
        <div
          className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setShowFullDetailsModal(false)}
        >
          <div
            className="relative flex h-[80vh] w-full flex-col rounded-t-[24px] bg-white shadow-2xl animate-in slide-in-from-bottom-6 dark:bg-zinc-900"
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

      {/* Client gallery carousel (job cards stay job-first) */}
      {showClientGalleryModal && (
        <div
          className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/60 backdrop-blur-sm md:items-center"
          onClick={() => setShowClientGalleryModal(false)}
        >
          <div
            className={cn(
              "relative flex min-h-0 w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-zinc-900",
              // Mobile: open from top, stop above the fixed “Map & search” dock + BottomNav.
              "max-md:h-[calc(100dvh-(5rem+env(safe-area-inset-bottom,0px)))] max-md:rounded-none max-md:animate-in max-md:fade-in",
              // Desktop: centered dialog
              "md:h-[min(85vh,44rem)] md:w-[min(92vw,56rem)] md:max-w-none md:rounded-[24px] md:animate-in md:zoom-in-95",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
              <div className="min-w-0">
                <div className="truncate text-base font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                  Client photos
                </div>
                <div className="mt-1 truncate text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  {(row.client_display_name || "").trim() || "Member"}
                </div>
              </div>
              <button
                type="button"
                className="rounded-full p-2 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                onClick={() => setShowClientGalleryModal(false)}
                aria-label="Close"
              >
                <X className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>

            <div className="relative flex-1 min-h-0 bg-black">
              <div
                ref={clientGalleryScrollRef}
                className={cn(
                  "absolute inset-0 flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden",
                  "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
                  "overscroll-x-contain [-webkit-overflow-scrolling:touch] touch-pan-x",
                )}
              >
                {profileSlides.map((s) => (
                  <div
                    key={s.key}
                    className="relative h-full w-full min-w-full max-w-full shrink-0 snap-start snap-always overflow-hidden"
                  >
                    {s.kind === "video" ? (
                      <video
                        src={s.src}
                        className="absolute inset-0 h-full w-full object-contain"
                        muted
                        playsInline
                        controls
                      />
                    ) : s.src ? (
                      <img
                        src={s.src}
                        alt=""
                        className="absolute inset-0 h-full w-full object-contain"
                        draggable={false}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />
                    )}
                  </div>
                ))}
              </div>
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

