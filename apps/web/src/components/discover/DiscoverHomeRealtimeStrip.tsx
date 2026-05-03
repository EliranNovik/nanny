import {
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { queryKeys } from "@/hooks/data/keys";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FullscreenMapModal } from "@/components/FullscreenMapModal";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { publicProfileMediaPublicUrl } from "@/lib/publicProfileMedia";
import type { PublicProfileGalleryRow } from "@/components/helpers/HelperResultProfileCard";
import {
  useDiscoverLiveAvatars,
  type DiscoverLiveAvatarEntry,
} from "@/hooks/data/useDiscoverFeed";
import { useFreelancerRequests } from "@/hooks/data/useFreelancerRequests";
import { canStartInCardLabel, respondsWithinCardLabel } from "@/lib/liveCanStart";
import {
  DISCOVER_HOME_CATEGORIES,
  ALL_HELP_CATEGORY_ID,
  SERVICE_CATEGORIES,
  isServiceCategoryId,
  serviceCategoryLabel,
} from "@/lib/serviceCategories";
import type { ServiceCategoryId } from "@/lib/serviceCategories";
import { trackEvent } from "@/lib/analytics";
import { LiveAvatarDot } from "@/components/discover/LiveAvatarDot";
import { DiscoverProfileSaveBadge } from "@/components/discover/DiscoverProfileSaveBadge";
import { matchesCommunityRequestsIncoming } from "@/lib/communityRequestsNotificationFilter";
import { haversineDistanceKm } from "@/lib/geo";
import {
  useDiscoverOpenHelpRequests,
  type DiscoverOpenHelpRequestRow,
} from "@/hooks/data/useDiscoverOpenHelpRequests";
import { sendKnockMessage } from "@/lib/knockMessage";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BellRing,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Compass,
  CookingPot,
  MapPin,
  Loader2,
  MessageCircle,
  MessageSquare,
  Phone,
  Play,
  Send,
  Sparkles,
  StickyNote,
  Star,
  Truck,
  User,
  Wrench,
  UsersRound,
  X,
} from "lucide-react";
import {
  DISCOVER_STROKE,
  discoverIcon,
} from "@/components/discover/discoverHomeIcons";

const JobMapLazy = lazy(() => import("@/components/JobMap"));

/** One full row of cards on desktop (md:grid-cols-5); mobile strip stays compact. */
const MAX = 5;
/** Same row count as hire strip on Discover home desktop. */
const MAX_WORK_REQUEST_ROWS = 5;

function ageLabel(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null;
  try {
    const t = new Date(createdAt).getTime();
    if (Number.isNaN(t)) return null;
    const diffMs = Date.now() - t;
    const hoursTotal = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
    const days = Math.floor(hoursTotal / 24);
    const hours = hoursTotal % 24;
    if (days > 0) return `Posted ${days}d ${hours}h ago`;
    return `Posted ${hoursTotal}h ago`;
  } catch {
    return null;
  }
}

function shortDisplayName(full: string | null | undefined): string {
  const t = (full || "?").trim();
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.toLowerCase();
  const last = parts[parts.length - 1]!;
  return `${parts[0]!.toLowerCase()} ${last.charAt(0).toLowerCase()}.`;
}

function ratingLabel(r: number | null | undefined): string {
  if (r == null || Number.isNaN(Number(r)) || Number(r) <= 0) return "New";
  return Number(r).toFixed(1);
}

type Props = {
  variant: "hire" | "work";
  explorePath: string;
};

type WorkRowItem = {
  key: string;
  href: string;
  jobId: string;
  title: string;
  categoryIcon: ReactNode;
  /** City / area only */
  cityLine: string;
  createdAt: string | null;
  /** Shift / duration / time — only when present */
  detailLine: string | null;
  /** care_type + care_frequency from job_requests (footer) */
  helpTypeLine: string | null;
  /** job_requests.time_duration only */
  durationLine: string | null;
  thumbUrl: string;
  name: string;
  average_rating: number | null;
  total_ratings: number | null;
  responds_within_label?: string | null;
  distanceKm?: number | null;
  is_verified?: boolean | null;
  clientId: string;
  categoryId: ServiceCategoryId;
  /** Freelancer inbound notification id — enables Accept / Decline in the detail sheet. */
  inboundNotifId?: string | null;
  /** URLs from job_requests.service_details.images */
  jobPhotoUrls: string[];
  /** job_requests.notes — client request notes */
  jobNotes: string | null;
  /** Raw `job_requests.service_details` (pickup/delivery addresses, coords, etc.) */
  serviceDetails: Record<string, unknown> | null;
};

type HireStripItem = {
  key: string;
  categoryId: ServiceCategoryId;
  /** How many additional live categories beyond categoryId (shown as +N on badge). */
  extraLiveCategoryCount: number;
  label: string;
  photo: string | null;
  name: string;
  href: string;
  helperUserId: string;
  average_rating: number | null;
  total_ratings: number | null;
  locationLine: string;
  can_start_in_label: string | null;
  responds_within_label: string | null;
  distanceKm: number | null;
  is_verified: boolean | null;
  categoryIcon: ReactNode;
};

/** Match `OpenJobRequestMatchCard` decline / accept round actions (discover request sheet). */
const workStripRoundActionBtn = cn(
  "flex items-center justify-center rounded-full shadow-xl transition-all active:scale-90",
  "ring-1 ring-inset disabled:opacity-50 disabled:pointer-events-none",
);
const workStripAcceptRoundBtn = cn(
  workStripRoundActionBtn,
  "h-16 w-16 bg-emerald-500 text-white shadow-emerald-500/20 hover:bg-emerald-600 ring-emerald-400/20",
);
const workStripDeclineRoundBtn = cn(
  workStripRoundActionBtn,
  "h-14 w-14 bg-white text-rose-500 ring-zinc-200 hover:bg-rose-50 dark:bg-zinc-800 dark:text-rose-400 dark:ring-zinc-700",
);

/**
 * Avatar frame: three-tone gradient in one hue (no outer shadow).
 * Hire = violet family; work = emerald family.
 */
function stripAvatarRingClass(mode: "hire" | "work"): string {
  if (mode === "hire") {
    return "bg-gradient-to-br from-violet-400 via-violet-600 to-violet-900 dark:from-violet-300 dark:via-violet-500 dark:to-violet-800";
  }
  return "bg-gradient-to-br from-emerald-300 via-emerald-600 to-emerald-900 dark:from-emerald-400 dark:via-emerald-600 dark:to-emerald-800";
}

function pickPrimaryLiveCategory(
  catSet: Set<ServiceCategoryId>,
  preferred: ServiceCategoryId | null,
): ServiceCategoryId {
  if (preferred && catSet.has(preferred)) return preferred;
  for (const c of DISCOVER_HOME_CATEGORIES) {
    if (c.id === ALL_HELP_CATEGORY_ID || !isServiceCategoryId(c.id)) continue;
    const id = c.id as ServiceCategoryId;
    if (catSet.has(id)) return id;
  }
  const first = [...catSet][0];
  return (first ?? "other_help") as ServiceCategoryId;
}

function stripDistanceBadgeText(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km <= 5) return "Near you";
  return `${km.toFixed(1)} km`;
}

function DarkMetaBadges({
  distanceKm,
  isVerified,
  postedAtLabel,
}: {
  distanceKm: number | null | undefined;
  isVerified: boolean | null | undefined;
  /** e.g. “Posted 2d ago” — shown beside Verified when present */
  postedAtLabel?: string | null;
}) {
  const dist =
    distanceKm != null && Number.isFinite(Number(distanceKm))
      ? stripDistanceBadgeText(Number(distanceKm))
      : null;
  const showVerified = isVerified === true;
  const posted = (postedAtLabel || "").trim();
  if (!dist && !showVerified && !posted) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {showVerified ? (
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
          Verified
        </span>
      ) : null}
      {posted ? (
        <span className="max-w-[14rem] truncate rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-zinc-600 ring-1 ring-zinc-200 dark:bg-white/10 dark:text-zinc-300 dark:ring-white/10">
          {posted}
        </span>
      ) : null}
      {dist ? (
        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-zinc-700 dark:bg-white/10 dark:text-zinc-200">
          {dist}
        </span>
      ) : null}
    </div>
  );
}

function labelForKnockCategoryId(id: string): string {
  if (isServiceCategoryId(id))
    return serviceCategoryLabel(id as ServiceCategoryId);
  return id.replace(/_/g, " ");
}

/** Hire modal: Contact now ▾ (menu opens upward) → WhatsApp, Telegram, in-app chat, Knock. */
function StripHelperContactDropdown({
  helperUserId,
  helperRole,
  knockCategories,
  contactReady,
  whatsappE164,
  telegramUsername,
  shareWhatsapp,
  shareTelegram,
  onDismissSheet,
}: {
  helperUserId: string;
  helperRole: string | null;
  knockCategories: string[];
  contactReady: boolean;
  whatsappE164: string | null;
  telegramUsername: string | null;
  shareWhatsapp: boolean;
  shareTelegram: boolean;
  onDismissSheet: () => void;
}) {
  const navigate = useNavigate();
  const { user, profile: viewerProfile } = useAuth();
  const { addToast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [knockStep, setKnockStep] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);
  const [knockSending, setKnockSending] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const viewerId = user?.id ?? null;
  const viewerRole = viewerProfile?.role ?? null;
  const viewerName = viewerProfile?.full_name ?? null;

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setKnockStep(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) setKnockStep(false);
  }, [menuOpen]);

  if (!viewerId || viewerId === helperUserId) return null;

  const digitsWa = (whatsappE164 || "").replace(/\D/g, "");
  const showWa =
    contactReady &&
    shareWhatsapp &&
    Boolean(digitsWa);
  const tgUser =
    contactReady &&
    shareTelegram &&
    (telegramUsername || "").replace(/^@/, "").trim();

  async function openInternalChat() {
    if (!viewerId || viewerId === helperUserId) return;
    if (!viewerRole) {
      addToast({
        title: "Please wait",
        description: "Your profile is still loading. Try again in a moment.",
        variant: "default",
      });
      return;
    }
    if (viewerRole !== "client" && viewerRole !== "freelancer") {
      addToast({
        title: "Messaging unavailable",
        description: "Your account cannot start a chat from here.",
        variant: "error",
      });
      return;
    }
    const theirRole = helperRole;
    if (!theirRole || (theirRole !== "client" && theirRole !== "freelancer")) {
      addToast({
        title: "Messaging unavailable",
        description: "You can only message clients or helpers.",
        variant: "error",
      });
      return;
    }
    if (viewerRole === theirRole) {
      addToast({
        title: "Messaging unavailable",
        description:
          "You can only message someone in the opposite role (client ↔ helper).",
        variant: "default",
      });
      return;
    }

    const clientId = viewerRole === "client" ? viewerId : helperUserId;
    const freelancerId =
      viewerRole === "freelancer" ? viewerId : helperUserId;

    setOpeningChat(true);
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

      setMenuOpen(false);
      onDismissSheet();
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
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Please try again.";
      addToast({
        title: "Could not open chat",
        description: msg,
        variant: "error",
      });
    } finally {
      setOpeningChat(false);
    }
  }

  async function onKnockCategory(categoryId: string) {
    if (!viewerId || knockSending) return;
    setKnockSending(categoryId);
    try {
      const result = await sendKnockMessage({
        supabase,
        currentUserId: viewerId,
        currentProfileRole: viewerRole,
        currentProfileName: viewerName,
        targetUserId: helperUserId,
        targetRole: helperRole,
        categoryId,
      });
      if (!result.ok) {
        if (result.code === "no_role") {
          addToast({
            title: "Please wait",
            description:
              "Your profile is still loading. Try again in a moment.",
            variant: "default",
          });
        } else {
          addToast({
            title: "Could not send",
            description: result.message ?? "Try again.",
            variant: "error",
          });
        }
        return;
      }
      setMenuOpen(false);
      setKnockStep(false);
      onDismissSheet();
      addToast({
        title: "Message sent",
        description: "They’ll see your knock in your chat.",
        variant: "success",
      });
      navigate(`/messages?conversation=${result.conversationId}`);
    } finally {
      setKnockSending(null);
    }
  }

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        aria-expanded={menuOpen}
        onClick={() => {
          setMenuOpen((o) => !o);
          setKnockStep(false);
        }}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/60 bg-emerald-600 py-3.5 text-[15px] font-bold tracking-tight text-white shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-500 active:scale-[0.99]",
          "outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#121212]",
        )}
      >
        Contact now
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-white/90 transition-transform",
            menuOpen && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {menuOpen ? (
        <div
          className="absolute bottom-[calc(100%+0.4rem)] left-0 right-0 top-auto z-[100] overflow-hidden rounded-2xl border border-zinc-200 bg-white py-1.5 text-left text-zinc-900 shadow-xl ring-1 ring-zinc-200/80 dark:border-zinc-700 dark:bg-[#1a1a1a] dark:text-zinc-100 dark:ring-black/40"
          role="menu"
        >
          {!knockStep ? (
            <>
              {showWa ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] font-semibold text-zinc-900 transition hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-white/10"
                  onClick={() => {
                    window.open(`https://wa.me/${digitsWa}`, "_blank");
                    setMenuOpen(false);
                  }}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
                    <Phone className="h-4 w-4 fill-current" aria-hidden strokeWidth={0} />
                  </span>
                  WhatsApp
                </button>
              ) : null}
              {tgUser ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] font-semibold text-zinc-900 transition hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-white/10"
                  onClick={() => {
                    window.open(`https://t.me/${tgUser}`, "_blank");
                    setMenuOpen(false);
                  }}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0088cc] text-white">
                    <Send className="h-4 w-4 translate-x-[-1px] translate-y-[1px] fill-current" aria-hidden strokeWidth={0} />
                  </span>
                  Telegram
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                disabled={openingChat}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-100 dark:hover:bg-white/10"
                onClick={() => void openInternalChat()}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-white dark:text-[#121212]">
                  {openingChat ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <MessageSquare className="h-4 w-4" aria-hidden strokeWidth={2} />
                  )}
                </span>
                Internal chat
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] font-semibold text-zinc-900 transition hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-white/10"
                onClick={() => {
                  if (knockCategories.length === 0) {
                    addToast({
                      title: "Knock unavailable",
                      description:
                        "This helper doesn’t list categories yet. Open their profile to connect.",
                      variant: "default",
                    });
                    return;
                  }
                  setKnockStep(true);
                }}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-900/40">
                  <BellRing className="h-4 w-4" aria-hidden strokeWidth={2} />
                </span>
                Knock
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-semibold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200"
                onClick={() => setKnockStep(false)}
              >
                <ChevronRight className="h-4 w-4 rotate-180" aria-hidden />
                Back
              </button>
              <div className="border-t border-zinc-200 px-2 pb-1 pt-1 dark:border-zinc-700/90">
                <p className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Choose category
                </p>
                <div className="max-h-52 overflow-y-auto">
                  {knockCategories.map((id) => (
                    <button
                      key={id}
                      type="button"
                      role="menuitem"
                      disabled={knockSending !== null}
                      className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-white/10"
                      onClick={() => void onKnockCategory(id)}
                    >
                      {knockSending === id ? (
                        <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin text-zinc-500 dark:text-zinc-400" aria-hidden />
                      ) : null}
                      {labelForKnockCategoryId(id)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

type DiscoverMediaSlide = {
  key: string;
  kind: "image" | "video";
  src: string;
};

type DiscoverStripReviewRow = {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  reviewer_name: string | null;
  reviewer_photo: string | null;
};

function normalizeDiscoverStripReviews(raw: unknown[] | null | undefined): DiscoverStripReviewRow[] {
  if (!Array.isArray(raw)) return [];
  const out: DiscoverStripReviewRow[] = [];
  for (const row of raw) {
    const r = row as {
      id?: string;
      rating?: number | null;
      review_text?: string | null;
      created_at?: string;
      reviewer?:
        | { full_name?: string | null; photo_url?: string | null }
        | { full_name?: string | null; photo_url?: string | null }[]
        | null;
    };
    if (!r?.id || !r.created_at) continue;
    const revRaw = r.reviewer;
    const rev = Array.isArray(revRaw) ? revRaw[0] : revRaw;
    out.push({
      id: String(r.id),
      rating: Math.min(5, Math.max(1, Number(r.rating) || 1)),
      review_text: r.review_text ?? null,
      created_at: String(r.created_at),
      reviewer_name: rev?.full_name != null ? String(rev.full_name).trim() || null : null,
      reviewer_photo: rev?.photo_url != null ? String(rev.photo_url).trim() || null : null,
    });
  }
  return out;
}

function stripReviewCardDisplayName(full: string): string {
  const t = full.trim();
  if (!t) return "Client";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0] ?? t;
  const first = parts[0];
  const last = parts[parts.length - 1];
  const initial = last?.charAt(0);
  return initial ? `${first} ${initial}.` : (first ?? t);
}

/** Testimonial-style cards: overlapping gradient avatar, name + rating row, italic quote. */
function DiscoverStripReviewsCarousel({ reviews }: { reviews: DiscoverStripReviewRow[] }) {
  if (reviews.length === 0) return null;
  return (
    <div className="w-full">
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-visible py-2 pl-0.5 pr-1 pt-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {reviews.map((rev) => {
          const quoted = (rev.review_text || "").trim() || "No comments provided.";
          const rawName = rev.reviewer_name?.trim() || "Client";
          const name = stripReviewCardDisplayName(rawName);
          return (
            <article
              key={rev.id}
              className="relative w-[min(19rem,calc(100vw-5rem))] shrink-0 snap-start rounded-3xl border border-zinc-100 bg-white px-4 pb-5 pt-3 shadow-lg shadow-zinc-900/[0.06] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/40"
            >
              <div className="pointer-events-none absolute -top-9 left-4 z-[1]">
                <div className="rounded-full bg-gradient-to-br from-sky-500 via-indigo-500 to-fuchsia-500 p-[3px] shadow-md shadow-indigo-500/25">
                  <div className="rounded-full bg-white p-0.5 dark:bg-zinc-900">
                    <Avatar className="h-14 w-14 border-0">
                      <AvatarImage src={rev.reviewer_photo || undefined} alt="" className="object-cover" />
                      <AvatarFallback className="text-lg font-bold text-zinc-600 dark:text-zinc-300">
                        {rawName.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
              </div>
              <div className="mt-9 flex items-start justify-between gap-3">
                <span className="min-w-0 truncate text-[15px] font-bold leading-tight text-zinc-900 dark:text-zinc-50">
                  {name}
                </span>
                <div className="flex shrink-0 items-center gap-1 rounded-full border border-amber-200/90 bg-amber-50 px-2.5 py-1 dark:border-amber-400/35 dark:bg-amber-400/15">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" strokeWidth={0} aria-hidden />
                  <span className="text-[13px] font-bold tabular-nums text-amber-950 dark:text-amber-100">
                    {rev.rating}
                  </span>
                </div>
              </div>
              <p className="mt-3 line-clamp-4 text-[14px] font-medium italic leading-relaxed text-slate-600 dark:text-slate-300">
                &ldquo;{quoted}&rdquo;
              </p>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function buildDiscoverMediaSlides(
  photoUrl: string | null | undefined,
  gallery: PublicProfileGalleryRow[],
): DiscoverMediaSlide[] {
  const slides: DiscoverMediaSlide[] = [];
  const trimmed = photoUrl?.trim();
  if (trimmed) slides.push({ key: "profile", kind: "image", src: trimmed });
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

function useDiscoverStripDetailExtras(userId: string | undefined, open: boolean) {
  return useQuery({
    queryKey: ["discoverStripDetailExtras", userId],
    enabled: open && !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const uid = userId!;
      const [fpRes, profRes, mediaRes, reviewsRes] = await Promise.all([
        supabase.from("freelancer_profiles").select("live_categories, bio").eq("user_id", uid).maybeSingle(),
        supabase
          .from("profiles")
          .select(
            "bio, role, whatsapp_number_e164, telegram_username, share_whatsapp, share_telegram, categories",
          )
          .eq("id", uid)
          .maybeSingle(),
        supabase
          .from("public_profile_media")
          .select("id, user_id, media_type, storage_path, sort_order, created_at")
          .eq("user_id", uid),
        supabase
          .from("job_reviews")
          .select(
            "id, rating, review_text, created_at, reviewer:profiles!reviewer_id(full_name, photo_url)",
          )
          .eq("reviewee_id", uid)
          .order("created_at", { ascending: false })
          .limit(24),
      ]);
      if (fpRes.error) throw fpRes.error;
      if (profRes.error) throw profRes.error;
      if (mediaRes.error) throw mediaRes.error;
      if (reviewsRes.error) {
        if (import.meta.env.DEV) {
          console.warn("[useDiscoverStripDetailExtras] job_reviews", reviewsRes.error);
        }
      }

      const liveCategories = Array.isArray(fpRes.data?.live_categories)
        ? (fpRes.data!.live_categories as string[]).map((c) => String(c ?? "").trim()).filter(Boolean)
        : [];

      const bio =
        (profRes.data?.bio as string | null | undefined)?.trim() ||
        (fpRes.data?.bio as string | null | undefined)?.trim() ||
        "";

      const prof = profRes.data as {
        role?: string | null;
        whatsapp_number_e164?: string | null;
        telegram_username?: string | null;
        share_whatsapp?: boolean | null;
        share_telegram?: boolean | null;
        categories?: unknown;
      } | null;

      const targetRole =
        prof?.role != null && String(prof.role).trim() !== ""
          ? String(prof.role)
          : null;
      const whatsappE164 =
        prof?.whatsapp_number_e164 != null
          ? String(prof.whatsapp_number_e164).trim() || null
          : null;
      const telegramUsername =
        prof?.telegram_username != null
          ? String(prof.telegram_username).trim().replace(/^@/, "") || null
          : null;
      const shareWhatsapp = prof?.share_whatsapp === true;
      const shareTelegram = prof?.share_telegram === true;
      const profileCategories = Array.isArray(prof?.categories)
        ? (prof!.categories as string[])
            .map((c) => String(c ?? "").trim())
            .filter(Boolean)
        : [];

      let gallery = (mediaRes.data ?? []) as PublicProfileGalleryRow[];
      gallery = [...gallery].sort(
        (a, b) =>
          a.sort_order - b.sort_order ||
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );

      const reviews = normalizeDiscoverStripReviews(
        !reviewsRes.error ? (reviewsRes.data as unknown[]) : [],
      );

      return {
        liveCategories,
        bio,
        gallery,
        targetRole,
        whatsappE164,
        telegramUsername,
        shareWhatsapp,
        shareTelegram,
        profileCategories,
        reviews,
      };
    },
  });
}

function GSheetRow({
  icon: Icon,
  children,
  right,
  hint,
}: {
  icon: typeof MapPin;
  children: ReactNode;
  right?: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex w-full items-start gap-3 border-b border-zinc-200/90 py-3.5 dark:border-zinc-800/90">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-sky-500/12 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400"
        aria-hidden
      >
        <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium leading-snug text-zinc-900 dark:text-zinc-100">{children}</div>
        {hint ? <div className="mt-0.5 text-[13px] leading-snug text-zinc-500">{hint}</div> : null}
      </div>
      {right ? <div className="shrink-0 pt-0.5">{right}</div> : null}
    </div>
  );
}

function DiscoverStripMediaCarousel({
  slides,
  title = "Photos & videos",
}: {
  slides: DiscoverMediaSlide[];
  title?: string;
}) {
  if (slides.length === 0) return null;
  return (
    <div className="w-full">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">{title}</p>
      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {slides.map((s) => (
          <div
            key={s.key}
            className="relative h-[7.5rem] w-[10.5rem] shrink-0 snap-start overflow-hidden rounded-xl bg-zinc-100 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-white/10"
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
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm">
                    <Play className="ml-0.5 h-5 w-5 fill-white" aria-hidden />
                  </span>
                </span>
              </>
            ) : (
              <img src={s.src} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

type StripDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hire: HireStripItem | null;
  work: WorkRowItem | null;
  variant: "hire" | "work";
};

/** Sheet header line for incoming requests — matches in-body copy tone. */
function StripDialogWorkTitle({
  displayName,
  work,
}: {
  displayName: string;
  work: WorkRowItem;
}) {
  const name = shortDisplayName(displayName) || displayName.trim() || "—";
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1 gap-y-1">
      <span className="font-bold text-zinc-900 dark:text-white">{name}</span>
      <span className="font-medium text-zinc-600 dark:text-zinc-400">needs your help in </span>
      <span className="inline-flex items-center gap-1.5 font-bold text-zinc-900 dark:text-white">
        {categoryIconNode(
          work.categoryId,
          "h-[1.1rem] w-[1.1rem] shrink-0 stroke-[2.25] text-sky-600 sm:h-[1.25rem] sm:w-[1.25rem] dark:text-sky-400",
        )}
        <span>{work.title}</span>
      </span>
    </span>
  );
}

function DiscoverRealtimeStripDetailDialog({
  open,
  onOpenChange,
  hire,
  work,
  variant,
}: StripDetailDialogProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [workAction, setWorkAction] = useState<"accept" | "decline" | null>(null);
  const [pickupMapOpen, setPickupMapOpen] = useState(false);
  const sheetPullYRef = useRef<number | null>(null);
  const profileUserId = hire?.helperUserId ?? work?.clientId ?? null;
  const photoUrl = hire?.photo ?? work?.thumbUrl ?? null;
  const displayName = hire?.name ?? work?.name ?? "";

  const hireExtras = useDiscoverStripDetailExtras(hire?.helperUserId, open && variant === "hire" && !!hire);
  const counterpartExtras = useDiscoverStripDetailExtras(work?.clientId, open && variant === "work" && !!work);

  const hireMediaSlides = useMemo(
    () => buildDiscoverMediaSlides(hire?.photo ?? null, hireExtras.data?.gallery ?? []),
    [hire?.photo, hireExtras.data?.gallery],
  );

  const workCounterpartSlides = useMemo(
    () => buildDiscoverMediaSlides(work?.thumbUrl ?? null, counterpartExtras.data?.gallery ?? []),
    [work?.thumbUrl, counterpartExtras.data?.gallery],
  );

  const workJobPhotoSlides = useMemo((): DiscoverMediaSlide[] => {
    if (!work?.jobPhotoUrls?.length) return [];
    return work.jobPhotoUrls.map((src, i) => ({
      key: `job-req-${work.jobId}-${i}`,
      kind: "image" as const,
      src,
    }));
  }, [work?.jobPhotoUrls, work?.jobId]);

  const pickupDetail = useMemo(() => {
    if (!work || work.categoryId !== "pickup_delivery") return null;
    return parsePickupDeliveryDetails(work.serviceDetails);
  }, [work]);

  const pickupMapJob = useMemo(() => {
    if (!work || work.categoryId !== "pickup_delivery") return null;
    return workRowToMapJob(work);
  }, [work]);

  const showPickupMapPreview =
    !!work &&
    work.categoryId === "pickup_delivery" &&
    pickupDetail != null &&
    (pickupDetail.hasRouteCoords ||
      Boolean((work.cityLine || "").trim() && work.cityLine !== "—"));

  useEffect(() => {
    if (!open) setPickupMapOpen(false);
  }, [open]);

  useEffect(() => {
    setPickupMapOpen(false);
  }, [work?.jobId]);

  const hireLiveCatIds = useMemo(() => {
    const fromDb = hireExtras.data?.liveCategories ?? [];
    const fromProf = hireExtras.data?.profileCategories ?? [];
    const merged = [
      ...new Set(
        [...fromDb, ...fromProf]
          .map((c) => String(c ?? "").trim())
          .filter(Boolean),
      ),
    ];
    if (merged.length > 0) return merged;
    if (hire?.categoryId) return [hire.categoryId];
    return [];
  }, [
    hireExtras.data?.liveCategories,
    hireExtras.data?.profileCategories,
    hire?.categoryId,
  ]);

  function liveCategoryLabel(cat: string): string {
    if (cat && isServiceCategoryId(cat)) return serviceCategoryLabel(cat as ServiceCategoryId);
    return cat.replace(/_/g, " ");
  }

  const goProfile = () => {
    if (!profileUserId) return;
    onOpenChange(false);
    navigate(`/profile/${encodeURIComponent(profileUserId)}`);
  };

  async function handleWorkAccept() {
    if (!work?.jobId) return;
    setWorkAction("accept");
    try {
      if (work.inboundNotifId) {
        await apiPost(
          `/api/jobs/${work.jobId}/notifications/${work.inboundNotifId}/open`,
          {},
        );
        await apiPost(`/api/jobs/${work.jobId}/confirm`, {});
        void queryClient.invalidateQueries({
          queryKey: queryKeys.freelancerRequests(user?.id),
        });
        addToast({
          title: "Job accepted",
          description: "Moved to pending while the client confirms.",
          variant: "success",
        });
      } else {
        await apiPost(`/api/jobs/${work.jobId}/freelancer-confirm-open`, {});
        void queryClient.invalidateQueries({
          queryKey: queryKeys.discoverOpenHelpRequests(user?.id),
        });
        addToast({
          title: "Accepted",
          description: `Waiting for ${(displayName || "the client").trim()}.`,
          variant: "success",
        });
      }
      onOpenChange(false);
    } catch (err: unknown) {
      addToast({
        title: "Failed to accept",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setWorkAction(null);
    }
  }

  async function handleWorkDecline() {
    if (!work?.jobId) return;
    setWorkAction("decline");
    try {
      if (work.inboundNotifId) {
        await apiPost(`/api/jobs/${work.jobId}/freelancer-decline`, {
          notifId: work.inboundNotifId,
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.freelancerRequests(user?.id),
        });
        addToast({
          title: "Declined",
          description: "We’ll stop showing you this request.",
          variant: "success",
        });
      } else {
        await apiPost(`/api/jobs/${work.jobId}/freelancer-decline-open`, {});
        void queryClient.invalidateQueries({
          queryKey: queryKeys.discoverOpenHelpRequests(user?.id),
        });
        addToast({
          title: "Declined",
          description: "We’ll hide this request from your picks.",
          variant: "success",
        });
      }
      onOpenChange(false);
    } catch (err: unknown) {
      addToast({
        title: "Failed to decline",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setWorkAction(null);
    }
  }

  function closeSheet() {
    onOpenChange(false);
  }

  function onSheetPullTouchStart(e: React.TouchEvent) {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
      return;
    }
    sheetPullYRef.current = e.touches[0]?.clientY ?? null;
  }

  function onSheetPullTouchEnd(e: React.TouchEvent) {
    if (sheetPullYRef.current == null) return;
    const start = sheetPullYRef.current;
    sheetPullYRef.current = null;
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
      return;
    }
    const end = e.changedTouches[0]?.clientY;
    if (end == null) return;
    if (end - start > 72) {
      closeSheet();
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => {
          // Nested `FullscreenMapModal` portals outside this sheet; without this, Radix treats
          // map overlay / content as an “outside” interaction and closes the sheet (unmounting the map).
          if (pickupMapOpen) e.preventDefault();
        }}
        onFocusOutside={(e) => {
          if (pickupMapOpen) e.preventDefault();
        }}
        className={cn(
          "flex max-h-[90dvh] flex-col gap-0 overflow-hidden border-0 bg-white p-0 text-zinc-900 shadow-2xl duration-200 dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-100",
          "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:left-0 max-md:max-h-[88dvh] max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-t-[28px] max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          // Desktop: right-aligned drawer (overrides default centered DialogContent)
          "md:fixed md:inset-y-0 md:left-auto md:right-0 md:top-0 md:h-dvh md:max-h-dvh md:max-w-md md:w-full md:translate-x-0 md:translate-y-0",
          "md:rounded-none md:rounded-l-3xl md:border md:border-zinc-200 md:border-r-0 md:p-0 dark:md:border-zinc-700",
          "md:duration-300 md:data-[state=open]:animate-in md:data-[state=closed]:animate-out",
          "md:data-[state=open]:fade-in-0 md:data-[state=closed]:fade-out-0",
          "md:data-[state=open]:slide-in-from-right-8 md:data-[state=closed]:slide-out-to-right-8",
          "md:data-[state=open]:zoom-in-100 md:data-[state=closed]:zoom-out-100",
        )}
      >
        <div
          className="shrink-0 pb-1"
          onTouchStart={onSheetPullTouchStart}
          onTouchEnd={onSheetPullTouchEnd}
        >
          <div className="flex justify-center px-4 pt-2 max-md:pt-3 md:pt-3">
            <button
              type="button"
              onClick={() => closeSheet()}
              className="group flex w-full max-w-[10rem] flex-col items-center rounded-2xl py-2 outline-none transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-sky-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#121212]"
              aria-label="Close"
            >
              <span
                className="h-1.5 w-14 shrink-0 rounded-full bg-zinc-300 transition group-hover:bg-zinc-400 group-active:bg-zinc-500 dark:bg-zinc-600 dark:group-hover:bg-zinc-500 dark:group-active:bg-zinc-400"
                aria-hidden
              />
              <span className="sr-only">Close sheet</span>
            </button>
          </div>
          {variant === "hire" ? (
            <DialogHeader className="sr-only">
              <DialogTitle>Helper profile</DialogTitle>
            </DialogHeader>
          ) : (
            <div className="px-4 pb-4 pt-5">
              <DialogHeader className="m-0 space-y-0 p-0 text-center">
                <DialogTitle className="text-center text-[15px] font-semibold leading-snug tracking-tight text-zinc-900 sm:text-[16px] dark:text-zinc-100">
                  {work ? (
                    <StripDialogWorkTitle displayName={displayName} work={work} />
                  ) : (
                    "Request"
                  )}
                </DialogTitle>
              </DialogHeader>
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-1",
            hire || work ? "pb-4" : "pb-6",
          )}
        >
          {work ? (
            <>
              <div className="mb-5 flex w-full gap-5">
                <div className="flex w-[7.125rem] shrink-0 flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={goProfile}
                    className="relative rounded-2xl p-1 outline-none ring-offset-2 ring-offset-white transition hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-sky-500/50 disabled:opacity-60 dark:ring-offset-[#121212] dark:hover:bg-white/5"
                    disabled={!profileUserId}
                    aria-label="View public profile"
                  >
                    <div className={cn("relative overflow-visible rounded-full p-[3px]", stripAvatarRingClass("work"))}>
                      <div className="rounded-full bg-white p-0.5 dark:bg-[#121212]">
                        <Avatar className="h-[5.5rem] w-[5.5rem] border-0">
                          <AvatarImage src={photoUrl || undefined} className="object-cover" alt="" />
                          <AvatarFallback className="bg-zinc-200 text-xl font-black text-zinc-800 dark:bg-zinc-800 dark:text-white">
                            {(displayName || "?").charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <LiveAvatarDot />
                    </div>
                  </button>
                  <div className="flex flex-wrap items-center justify-center gap-x-1 text-[13px] text-zinc-500 dark:text-zinc-400">
                    <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                      <Star className="h-4 w-4 shrink-0 fill-amber-600 text-amber-600 dark:fill-amber-400 dark:text-amber-400" strokeWidth={0} />
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{ratingLabel(work.average_rating)}</span>
                    </span>
                    {work.total_ratings ? (
                      <span className="text-zinc-500">({work.total_ratings})</span>
                    ) : null}
                  </div>
                </div>

                <div className="min-w-0 flex-1 pt-1">
                  <div>
                    <DarkMetaBadges
                      distanceKm={work.distanceKm}
                      isVerified={work.is_verified}
                      postedAtLabel={ageLabel(work.createdAt)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={goProfile}
                    className="mt-4 inline-flex items-center gap-1 text-[14px] font-semibold text-sky-600 hover:text-sky-700 disabled:opacity-50 dark:text-sky-400 dark:hover:text-sky-300"
                    disabled={!profileUserId}
                  >
                    View profile
                    <ChevronRight className="h-4 w-4 opacity-90" aria-hidden />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Hire helper: avatar left + identity right */}
              <div className="mb-5 flex w-full gap-4">
                <button
                  type="button"
                  onClick={goProfile}
                  className="relative shrink-0 rounded-2xl p-1 outline-none ring-offset-2 ring-offset-white transition hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-sky-500/50 disabled:opacity-60 dark:ring-offset-[#121212] dark:hover:bg-white/5"
                  disabled={!profileUserId}
                  aria-label="View public profile"
                >
                  <div
                    className={cn(
                      "relative overflow-visible rounded-full p-[3px]",
                      hire ? stripAvatarRingClass("hire") : "bg-zinc-400 dark:bg-zinc-600",
                    )}
                  >
                    <div className="rounded-full bg-white p-0.5 dark:bg-[#121212]">
                      <Avatar className="h-[5.5rem] w-[5.5rem] border-0">
                        <AvatarImage src={photoUrl || undefined} className="object-cover" alt="" />
                        <AvatarFallback className="bg-zinc-200 text-xl font-black text-zinc-800 dark:bg-zinc-800 dark:text-white">
                          {(displayName || "?").charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    {hire ? <LiveAvatarDot /> : null}
                  </div>
                </button>

                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[22px] font-bold leading-[1.2] tracking-tight text-zinc-900 dark:text-white">
                    {displayName.trim() || "—"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[14px] text-zinc-500 dark:text-zinc-400">
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <Star className="h-4 w-4 fill-amber-600 text-amber-600 dark:fill-amber-400 dark:text-amber-400" strokeWidth={0} />
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{ratingLabel(hire?.average_rating)}</span>
                    </span>
                    {hire?.total_ratings ? <span className="text-zinc-500">({hire.total_ratings})</span> : null}
                    <span className="text-zinc-400 dark:text-zinc-600">·</span>
                    <span className="text-zinc-700 dark:text-zinc-300">{hire?.label}</span>
                    <span className="text-zinc-400 dark:text-zinc-600">·</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">Live</span>
                  </div>
                  <div className="mt-2.5">
                    {hire ? (
                      <DarkMetaBadges distanceKm={hire.distanceKm} isVerified={hire.is_verified} />
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={goProfile}
                    className="mt-3 inline-flex items-center gap-1 text-[14px] font-semibold text-sky-600 hover:text-sky-700 disabled:opacity-50 dark:text-sky-400 dark:hover:text-sky-300"
                    disabled={!profileUserId}
                  >
                    View profile
                    <ChevronRight className="h-4 w-4 opacity-90" aria-hidden />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Hire: live categories (go-live selections) */}
          {hire ? (
            <div className="mb-5">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                Live categories
              </p>
              <div className="flex flex-wrap gap-2">
                {hireLiveCatIds.map((cid) => (
                  <span
                    key={cid}
                    className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-[12px] font-semibold text-zinc-800 ring-1 ring-zinc-200 dark:bg-zinc-800/90 dark:text-zinc-200 dark:ring-white/10"
                  >
                    {categoryIconNode(cid, "h-3.5 w-3.5 shrink-0 stroke-[2.25] text-zinc-600 dark:text-zinc-400")}
                    {liveCategoryLabel(cid)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Media carousel */}
          {hire && hireMediaSlides.length > 0 ? (
            <div className="mb-5">
              <DiscoverStripMediaCarousel slides={hireMediaSlides} />
            </div>
          ) : null}
          {work && workCounterpartSlides.length > 0 ? (
            <div className="mb-5">
              <DiscoverStripMediaCarousel slides={workCounterpartSlides} />
            </div>
          ) : null}
          {work && workJobPhotoSlides.length > 0 ? (
            <div className="mb-5">
              <DiscoverStripMediaCarousel slides={workJobPhotoSlides} title="Request photos" />
            </div>
          ) : null}

          {/* Info rows — hire */}
          {hire ? (
            <div className="border-t border-zinc-200 pt-1 dark:border-zinc-800">
              {hire.locationLine ? (
                <GSheetRow icon={MapPin}>{hire.locationLine}</GSheetRow>
              ) : null}
              {hire.can_start_in_label ? (
                <GSheetRow icon={Clock} hint="Availability">
                  {hire.can_start_in_label}
                </GSheetRow>
              ) : null}
              {hire.responds_within_label ? (
                <GSheetRow icon={MessageCircle} hint="Typical reply time">
                  {hire.responds_within_label}
                </GSheetRow>
              ) : null}
              {hireExtras.data?.bio ? (
                <GSheetRow icon={User} hint="About">
                  {hireExtras.data.bio}
                </GSheetRow>
              ) : null}
            </div>
          ) : null}

          {hire && hireExtras.data?.reviews && hireExtras.data.reviews.length > 0 ? (
            <div className="mt-1 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <DiscoverStripReviewsCarousel reviews={hireExtras.data.reviews} />
            </div>
          ) : null}

          {/* Info rows — work (request) */}
          {work ? (
            <div className="border-t border-zinc-200 pt-1 dark:border-zinc-800">
              <GSheetRow icon={MapPin}>{work.cityLine || "—"}</GSheetRow>
              {work.helpTypeLine ? (
                <GSheetRow icon={UsersRound} hint="Care / type">
                  {work.helpTypeLine}
                </GSheetRow>
              ) : null}
              {work.durationLine ? (
                <GSheetRow icon={Clock} hint="Duration">
                  {work.durationLine}
                </GSheetRow>
              ) : null}
              {work.responds_within_label ? (
                <GSheetRow icon={MessageCircle} hint="Typical reply time">
                  {work.responds_within_label}
                </GSheetRow>
              ) : null}
              {work.jobNotes ? (
                <GSheetRow icon={StickyNote} hint="Notes">
                  {work.jobNotes}
                </GSheetRow>
              ) : null}
              {counterpartExtras.data?.bio ? (
                <GSheetRow icon={User} hint="About">
                  {counterpartExtras.data.bio}
                </GSheetRow>
              ) : null}
              {work.categoryId === "pickup_delivery" &&
              pickupDetail &&
              (pickupDetail.fromAddress || pickupDetail.toAddress) ? (
                <div className="mt-3 space-y-2.5 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/50">
                  {pickupDetail.fromAddress ? (
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-white/10">
                        <ArrowUpCircle className="h-4 w-4 text-orange-500" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                          Pickup
                        </p>
                        <p className="text-sm font-semibold leading-snug text-zinc-800 dark:text-zinc-100">
                          {pickupDetail.fromAddress}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  {pickupDetail.toAddress ? (
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-white/10">
                        <ArrowDownCircle className="h-4 w-4 text-sky-600" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                          Delivery
                        </p>
                        <p className="text-sm font-semibold leading-snug text-zinc-800 dark:text-zinc-100">
                          {pickupDetail.toAddress}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {showPickupMapPreview && pickupMapJob ? (
                <div className="relative mt-3 h-[7.5rem] overflow-hidden rounded-2xl border border-zinc-200 ring-1 ring-black/[0.04] dark:border-zinc-700 dark:ring-white/10">
                  <button
                    type="button"
                    className="absolute inset-0 z-10 cursor-pointer rounded-2xl bg-transparent p-0 outline-none ring-offset-2 ring-offset-white focus-visible:ring-2 focus-visible:ring-sky-500/60 dark:ring-offset-[#121212]"
                    onClick={() => setPickupMapOpen(true)}
                    aria-label="Open full route map"
                  />
                  <div className="h-full w-full">
                    <Suspense
                      fallback={
                        <div className="flex h-full min-h-[7.5rem] w-full items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                          <Loader2 className="h-7 w-7 animate-spin text-zinc-400" aria-hidden />
                        </div>
                      }
                    >
                      <JobMapLazy job={pickupMapJob} />
                    </Suspense>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

        </div>

        {work ? (
          <div className="shrink-0 border-t border-zinc-200 bg-white px-4 pb-3 pt-3 dark:border-zinc-800 dark:bg-[#121212]">
            <div className="flex items-center justify-center gap-10 pt-1">
              <button
                type="button"
                className={workStripDeclineRoundBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleWorkDecline();
                }}
                disabled={workAction !== null}
                aria-label="Decline"
              >
                {workAction === "decline" ? (
                  <Loader2 className="h-8 w-8 animate-spin" strokeWidth={2.5} aria-hidden />
                ) : (
                  <X className="h-8 w-8" strokeWidth={3} aria-hidden />
                )}
              </button>
              <button
                type="button"
                className={workStripAcceptRoundBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleWorkAccept();
                }}
                disabled={workAction !== null}
                aria-label="Accept"
              >
                {workAction === "accept" ? (
                  <Loader2 className="h-10 w-10 animate-spin" strokeWidth={2.5} aria-hidden />
                ) : (
                  <Check className="h-10 w-10" strokeWidth={3.5} aria-hidden />
                )}
              </button>
            </div>
          </div>
        ) : null}

        {hire ? (
          <div className="shrink-0 border-t border-zinc-200 bg-white px-4 pb-3 pt-3 dark:border-zinc-800 dark:bg-[#121212]">
            <StripHelperContactDropdown
              helperUserId={hire.helperUserId}
              helperRole={hireExtras.data?.targetRole ?? null}
              knockCategories={hireLiveCatIds}
              contactReady={hireExtras.isSuccess}
              whatsappE164={hireExtras.data?.whatsappE164 ?? null}
              telegramUsername={hireExtras.data?.telegramUsername ?? null}
              shareWhatsapp={hireExtras.data?.shareWhatsapp ?? false}
              shareTelegram={hireExtras.data?.shareTelegram ?? false}
              onDismissSheet={() => onOpenChange(false)}
            />
          </div>
        ) : null}
        </div>
      </DialogContent>
    </Dialog>
    {pickupMapJob ? (
      <FullscreenMapModal
        job={pickupMapJob}
        isOpen={pickupMapOpen}
        onClose={() => setPickupMapOpen(false)}
        sheetPresentation
      />
    ) : null}
    </>
  );
}

function categoryIconNode(
  serviceType: string | null | undefined,
  className = "h-4 w-4 shrink-0",
): ReactNode {
  // Keep these simple + recognizable on tiny sizes.
  if (serviceType === "cleaning") return <Sparkles className={className} aria-hidden />;
  if (serviceType === "cooking") return <CookingPot className={className} aria-hidden />;
  if (serviceType === "pickup_delivery") return <Truck className={className} aria-hidden />;
  if (serviceType === "nanny") return <UsersRound className={className} aria-hidden />;
  return <Wrench className={className} aria-hidden />;
}

function categoryImageSrc(
  serviceType: string | null | undefined,
): string {
  if (serviceType && isServiceCategoryId(serviceType)) {
    const hit = SERVICE_CATEGORIES.find((c) => c.id === serviceType);
    if (hit) return hit.imageSrc;
  }
  return SERVICE_CATEGORIES[0]?.imageSrc ?? "/nanny-mar22.png";
}

// (relativeDayLabel / pickBadge were used by the old vertical list UI; removed)

function humanizeSnakeField(raw: string | null | undefined): string | null {
  const t = (raw || "").trim();
  if (!t) return null;
  return t.replace(/_/g, " ");
}

/** Normalize duration text and insert " - " between adjacent number tokens (e.g. "3 4 h" → "3 - 4 h"). */
function formatDurationDisplayForStrip(raw: string | null | undefined): string | null {
  const t = (raw || "").trim();
  if (!t) return null;
  let s = humanizeSnakeField(t) ?? t;
  let prev = "";
  while (s !== prev) {
    prev = s;
    s = s.replace(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/g, "$1 - $2");
  }
  return s || null;
}

function extractJobRequestPhotoUrls(serviceDetails: unknown): string[] {
  if (!serviceDetails || typeof serviceDetails !== "object") return [];
  const images = (serviceDetails as { images?: unknown }).images;
  if (!Array.isArray(images)) return [];
  return images.filter(
    (u): u is string => typeof u === "string" && u.trim().length > 0,
  );
}

function normalizeServiceDetailsRecord(raw: unknown): Record<string, unknown> | null {
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

function parsePickupDeliveryDetails(sd: Record<string, unknown> | null) {
  if (!sd) {
    return { fromAddress: "", toAddress: "", hasRouteCoords: false as const };
  }
  const fromAddress = typeof sd.from_address === "string" ? sd.from_address.trim() : "";
  const toAddress = typeof sd.to_address === "string" ? sd.to_address.trim() : "";
  const fl = Number(sd.from_lat);
  const fg = Number(sd.from_lng);
  const tl = Number(sd.to_lat);
  const tg = Number(sd.to_lng);
  const hasRouteCoords =
    Number.isFinite(fl) &&
    Number.isFinite(fg) &&
    Number.isFinite(tl) &&
    Number.isFinite(tg);
  return { fromAddress, toAddress, hasRouteCoords };
}

/** Align pickup coords / addresses with `JobMap` (snake_case + optional camelCase from JSON). */
function serviceDetailsForMap(sd: Record<string, unknown>): Record<string, unknown> {
  const g = (a: string, b: string) => {
    const av = sd[a];
    if (av !== undefined && av !== null && String(av).trim() !== "") return av;
    const bv = sd[b];
    if (bv !== undefined && bv !== null && String(bv).trim() !== "") return bv;
    return av;
  };
  return {
    ...sd,
    from_lat: g("from_lat", "fromLat"),
    from_lng: g("from_lng", "fromLng"),
    to_lat: g("to_lat", "toLat"),
    to_lng: g("to_lng", "toLng"),
    from_address: g("from_address", "fromAddress") ?? sd.from_address,
    to_address: g("to_address", "toAddress") ?? sd.to_address,
  };
}

/** Minimal job row shape for `JobMap` / `FullscreenMapModal` on discover request sheet. */
function workRowToMapJob(work: WorkRowItem): Record<string, unknown> {
  const sd = work.serviceDetails ?? {};
  const city = (work.cityLine || "").trim();
  return {
    id: work.jobId,
    client_id: work.clientId,
    service_type: work.categoryId,
    location_city: city && city !== "—" ? city : null,
    service_details: serviceDetailsForMap(sd),
  };
}

function buildHelpTypeFromCareFields(
  careType: string | null | undefined,
  careFrequency: string | null | undefined,
): string | null {
  const ct = humanizeSnakeField(careType);
  const cf = humanizeSnakeField(careFrequency);
  const parts = [ct, cf].filter((p): p is string => Boolean(p));
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

function mapJobLikeToWorkRow(opts: {
  key: string;
  jobId: string;
  href: string;
  serviceType: string | null | undefined;
  location_city: string | null | undefined;
  created_at?: string | null;
  start_at?: string | null;
  shift_hours?: string | null;
  time_duration?: string | null;
  care_type?: string | null;
  care_frequency?: string | null;
  photo: string | null | undefined;
  name: string | null | undefined;
  average_rating?: number | null | undefined;
  total_ratings?: number | null | undefined;
  responds_within_label?: string | null;
  distanceKm?: number | null;
  is_verified?: boolean | null;
  clientId: string;
  inboundNotifId?: string | null;
  service_details?: unknown;
  notes?: string | null;
}): WorkRowItem {
  const cat = opts.serviceType;
  const title =
    cat && isServiceCategoryId(cat)
      ? serviceCategoryLabel(cat as ServiceCategoryId)
      : (cat || "Request").replace(/_/g, " ");
  const categoryIcon = categoryIconNode(cat);
  const city = (opts.location_city || "").trim() || "—";
  const rawDetail = formatJobDetailLine({
    shift_hours: opts.shift_hours,
    time_duration: opts.time_duration,
    start_at: opts.start_at ?? null,
  });
  const detailLineRaw = rawDetail === "—" ? null : rawDetail;
  const detailLine =
    detailLineRaw == null
      ? null
      : detailLineRaw
          .split(" · ")
          .map((p) => humanizeSnakeField(p.trim()) || p.trim())
          .join(" · ");
  const helpTypeLine = buildHelpTypeFromCareFields(
    opts.care_type,
    opts.care_frequency,
  );
  const durationRaw = (opts.time_duration || "").trim() || null;
  const durationLine = durationRaw == null ? null : formatDurationDisplayForStrip(durationRaw);
  const jobPhotoUrls = extractJobRequestPhotoUrls(opts.service_details);
  const jobNotesTrim = (opts.notes ?? "").trim();
  const thumb = opts.photo?.trim() || categoryImageSrc(cat ?? null);
  const serviceDetails = normalizeServiceDetailsRecord(opts.service_details);
  return {
    key: opts.key,
    href: opts.href,
    jobId: opts.jobId,
    title,
    categoryIcon,
    cityLine: city,
    createdAt: opts.created_at ?? null,
    detailLine,
    helpTypeLine,
    durationLine,
    thumbUrl: thumb,
    name: (opts.name || "?").trim() || "?",
    average_rating: opts.average_rating ?? null,
    total_ratings: opts.total_ratings ?? null,
    responds_within_label: opts.responds_within_label ?? null,
    distanceKm: opts.distanceKm ?? null,
    is_verified: opts.is_verified ?? null,
    clientId: opts.clientId,
    categoryId: opts.serviceType as ServiceCategoryId,
    inboundNotifId: opts.inboundNotifId ?? null,
    jobPhotoUrls,
    jobNotes: jobNotesTrim.length > 0 ? jobNotesTrim : null,
    serviceDetails,
  };
}

function formatJobDetailLine(job: {
  shift_hours?: string | null;
  time_duration?: string | null;
  start_at?: string | null;
}): string {
  const parts: string[] = [];
  const sh = (job.shift_hours || "").trim();
  const td = (job.time_duration || "").trim();
  if (sh) parts.push(sh);
  if (td) parts.push(td);
  if (parts.length) return parts.join(" · ");
  if (job.start_at) {
    try {
      const d = new Date(job.start_at);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    } catch {
      /* ignore */
    }
  }
  return "—";
}

/**
 * Hire: horizontal avatar strip. Work: vertical request rows (reference layout).
 */
export function DiscoverHomeRealtimeStrip({ variant, explorePath }: Props) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailHire, setDetailHire] = useState<HireStripItem | null>(null);
  const [detailWork, setDetailWork] = useState<WorkRowItem | null>(null);

  const closeDetail = (open: boolean) => {
    setDetailOpen(open);
    if (!open) {
      setDetailHire(null);
      setDetailWork(null);
    }
  };

  const openHireDetail = (it: HireStripItem) => {
    setDetailWork(null);
    setDetailHire(it);
    setDetailOpen(true);
  };

  const openWorkDetail = (row: WorkRowItem) => {
    setDetailHire(null);
    setDetailWork(row);
    setDetailOpen(true);
  };
  const { data: liveAvatarsPayload } = useDiscoverLiveAvatars(user?.id);
  const categoryAvatars = liveAvatarsPayload?.byCategory ?? {};
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<ServiceCategoryId | "all">("all");
  const { data: frData } = useFreelancerRequests(
    variant === "work" && user?.id ? user.id : undefined,
  );
  const fetchOpenHelpPool =
    variant === "work" &&
    !!user?.id &&
    profile?.role !== "freelancer";
  const { data: openHelpRows = [] } = useDiscoverOpenHelpRequests(
    fetchOpenHelpPool,
    user?.id,
  );

  const { data: profileFavoriteRows = [] } = useQuery({
    queryKey: queryKeys.profileFavorites(user?.id ?? null),
    queryFn: async () => {
      const uid = user?.id;
      if (!uid) return [];
      const { data, error } = await supabase
        .from("profile_favorites")
        .select("favorite_user_id")
        .eq("user_id", uid);
      if (error) throw error;
      return (data ?? []) as { favorite_user_id: string }[];
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const favoriteUserIds = useMemo(
    () => new Set(profileFavoriteRows.map((r) => r.favorite_user_id)),
    [profileFavoriteRows],
  );

  const hireItems = useMemo((): HireStripItem[] => {
    const catsByHelper = new Map<string, Set<ServiceCategoryId>>();
    for (const catDef of DISCOVER_HOME_CATEGORIES) {
      if (catDef.id === ALL_HELP_CATEGORY_ID || !isServiceCategoryId(catDef.id)) continue;
      const cid = catDef.id as ServiceCategoryId;
      for (const av of categoryAvatars[cid] || []) {
        const hid = String(av.helper_user_id ?? "").trim();
        if (!hid) continue;
        if (!catsByHelper.has(hid)) catsByHelper.set(hid, new Set());
        catsByHelper.get(hid)!.add(cid);
      }
    }

    function toHireStripItem(
      av: DiscoverLiveAvatarEntry,
      primary: ServiceCategoryId,
      catSet: Set<ServiceCategoryId>,
    ): HireStripItem {
      const helperId = String(av.helper_user_id).trim();
      const extra = Math.max(0, catSet.size - 1);
      return {
        key: helperId,
        categoryId: primary,
        extraLiveCategoryCount: extra,
        label: serviceCategoryLabel(primary),
        photo: av.photo_url,
        name: av.full_name || "?",
        href: `/profile/${encodeURIComponent(helperId)}?category=${encodeURIComponent(primary)}`,
        helperUserId: helperId,
        average_rating: av.average_rating ?? null,
        total_ratings: (av as { total_ratings?: number | null }).total_ratings ?? null,
        locationLine: av.location_line || "",
        can_start_in_label: canStartInCardLabel(av.live_can_start_in),
        responds_within_label: respondsWithinCardLabel(av.avg_reply_seconds, av.reply_sample_count),
        distanceKm: (() => {
          const vl = profile?.location_lat;
          const vg = profile?.location_lng;
          const hl = av.location_lat;
          const hn = av.location_lng;
          if (vl != null && vg != null && hl != null && hn != null) {
            const a = Number(vl), b = Number(vg), c = Number(hl), d = Number(hn);
            if ([a, b, c, d].every(Number.isFinite)) {
              return haversineDistanceKm(a, b, c, d);
            }
          }
          return av.distance_km ?? null;
        })(),
        is_verified: av.is_verified ?? null,
        categoryIcon: categoryIconNode(primary),
      };
    }

    const categoriesToProcess = selectedFilterCategory === "all"
      ? DISCOVER_HOME_CATEGORIES.filter((c) => c.id !== ALL_HELP_CATEGORY_ID && isServiceCategoryId(c.id))
      : DISCOVER_HOME_CATEGORIES.filter((c) => c.id === selectedFilterCategory);

    const out: HireStripItem[] = [];
    const used = new Set<string>();

    if (selectedFilterCategory === "all") {
      for (const cat of categoriesToProcess) {
        const cid = cat.id as ServiceCategoryId;
        const avs = categoryAvatars[cid] || [];
        for (const av of avs.slice(0, 1)) {
          const hid = String(av.helper_user_id ?? "").trim();
          if (!hid || used.has(hid)) continue;
          used.add(hid);
          const catSet = catsByHelper.get(hid) ?? new Set([cid]);
          const primary = pickPrimaryLiveCategory(catSet, null);
          out.push(toHireStripItem(av, primary, catSet));
          if (out.length >= MAX) return out;
        }
      }
      return out;
    }

    const only = selectedFilterCategory as ServiceCategoryId;
    const usedOneCat = new Set<string>();
    for (const av of categoryAvatars[only] || []) {
      if (out.length >= MAX) break;
      const hid = String(av.helper_user_id ?? "").trim();
      if (!hid || usedOneCat.has(hid)) continue;
      usedOneCat.add(hid);
      const catSet = catsByHelper.get(hid) ?? new Set([only]);
      const primary = pickPrimaryLiveCategory(catSet, only);
      out.push(toHireStripItem(av, primary, catSet));
    }
    return out;
  }, [categoryAvatars, selectedFilterCategory, profile]);

  const workListRows = useMemo((): WorkRowItem[] => {
    const focusHref = (jobId: string) =>
      `/freelancer/jobs/match?focus_job_id=${encodeURIComponent(jobId)}`;

    const fromOpenHelpRpc = (rows: DiscoverOpenHelpRequestRow[]) =>
      rows.slice(0, MAX_WORK_REQUEST_ROWS).map((r) =>
        mapJobLikeToWorkRow({
          key: r.id,
          jobId: r.id,
          href: focusHref(r.id),
          serviceType: r.service_type,
          location_city: r.location_city,
          created_at: r.created_at,
          start_at: r.start_at,
          shift_hours: r.shift_hours,
          time_duration: r.time_duration,
          care_type: r.care_type ?? null,
          care_frequency: r.care_frequency ?? null,
          photo: r.client_photo_url,
          name: r.client_display_name,
          average_rating: r.client_average_rating ?? null,
          total_ratings: r.client_total_ratings ?? null,
          responds_within_label: respondsWithinCardLabel(r.client_avg_reply_seconds, r.client_reply_sample_count),
          distanceKm: (() => {
            const vl = profile?.location_lat;
            const vg = profile?.location_lng;
            const hl = r.location_lat;
            const hn = r.location_lng;
            if (vl != null && vg != null && hl != null && hn != null) {
              const a = Number(vl), b = Number(vg), c = Number(hl), d = Number(hn);
              if ([a, b, c, d].every(Number.isFinite)) {
                return haversineDistanceKm(a, b, c, d);
              }
            }
            return null;
          })(),
          is_verified: r.is_verified ?? null,
          clientId: r.client_id ?? "",
          service_details: r.service_details ?? null,
          notes: r.notes ?? null,
        }),
      );

    if (profile?.role === "freelancer") {
      // Same data as Jobs → Community’s requests only (your notification inbox).
      // Do not merge get_discover_open_help_requests — that pool is not what the tab shows.
      const inbound = (frData?.inboundNotifications ?? []).filter((n) =>
        matchesCommunityRequestsIncoming(n, {
          excludeClientId: user?.id ?? null,
        }),
      );
      return inbound.slice(0, MAX_WORK_REQUEST_ROWS).map(
        (n: {
          id: string;
          job_requests: {
            id: string;
            client_id?: string | null;
            service_type?: string;
            care_type?: string | null;
            care_frequency?: string | null;
            location_city?: string;
            location_lat?: number | null;
            location_lng?: number | null;
            created_at?: string;
            start_at?: string | null;
            shift_hours?: string | null;
            time_duration?: string | null;
            service_details?: unknown;
            notes?: string | null;
            profiles?: { photo_url?: string | null; full_name?: string | null; average_rating?: number | null; total_ratings?: number | null; is_verified?: boolean | null };
            client_avg_reply_seconds?: number | null;
            client_reply_sample_count?: number | null;
          };
        }) => {
          const jr = n.job_requests;
          return mapJobLikeToWorkRow({
            key: n.id,
            jobId: jr.id,
            inboundNotifId: n.id,
            href: focusHref(jr.id),
            serviceType: jr.service_type,
            location_city: jr.location_city,
            created_at: jr.created_at,
            start_at: jr.start_at,
            shift_hours: jr.shift_hours,
            time_duration: jr.time_duration,
            care_type: jr.care_type ?? null,
            care_frequency: jr.care_frequency ?? null,
            service_details: jr.service_details ?? null,
            notes: jr.notes ?? null,
            photo: jr.profiles?.photo_url,
            name: jr.profiles?.full_name,
            average_rating:
              jr.profiles?.average_rating != null ? Number(jr.profiles.average_rating) : null,
            total_ratings:
              jr.profiles?.total_ratings != null ? Number(jr.profiles.total_ratings) : null,
            distanceKm: (() => {
              const vl = profile?.location_lat;
              const vg = profile?.location_lng;
              const hl = jr.location_lat;
              const hn = jr.location_lng;
              if (vl != null && vg != null && hl != null && hn != null) {
                const a = Number(vl), b = Number(vg), c = Number(hl), d = Number(hn);
                if ([a, b, c, d].every(Number.isFinite)) {
                  return haversineDistanceKm(a, b, c, d);
                }
              }
              return null;
            })(),
            is_verified: jr.profiles?.is_verified ?? null,
            clientId: String(jr.client_id ?? ""),
          });
        },
      );
    }

    const list = fromOpenHelpRpc(openHelpRows);
    if (selectedFilterCategory === "all") return list;
    return list.filter(item => {
      // item.jobId is used to find the original row
      const original = openHelpRows.find(r => r.id === item.jobId);
      return original?.service_type === selectedFilterCategory;
    });
  }, [frData, profile?.role, openHelpRows, user?.id, fetchOpenHelpPool, selectedFilterCategory]);

  const items = variant === "hire" ? hireItems : workListRows;

  function onBrowseTap() {
    if (variant === "hire") {
      trackEvent("discover_strip_view_all", { variant: "hire_live_posts" });
      navigate("/client/helpers");
      return;
    }
    trackEvent("discover_strip_view_all", { variant: "work_community_requests" });
    navigate("/freelancer/jobs/match");
  }

  const browseLabel =
    variant === "hire" ? "Browse helpers" : "Browse requests";

  const BrowseRoundControl = (
    <button
      type="button"
      onClick={onBrowseTap}
      className={cn(
        "flex shrink-0 flex-col items-center gap-2 text-center min-h-24 justify-center",
        "outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2",
        variant === "hire"
          ? "focus-visible:ring-[#1e3a8a]/45"
          : "focus-visible:ring-[#065f46]/45",
      )}
    >
      <span
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-full shadow-sm ring-2 transition-transform active:scale-[0.97]",
          variant === "hire"
            ? "bg-[#1e3a8a]/12 text-[#1e3a8a] ring-[#1e3a8a]/25 dark:bg-blue-950/50 dark:text-blue-300"
            : "bg-[#065f46]/12 text-[#065f46] ring-[#065f46]/25 dark:bg-emerald-950/50 dark:text-emerald-300",
        )}
        aria-hidden
      >
        {variant === "hire" ? (
          <UsersRound
            className="w-8 h-8"
            strokeWidth={DISCOVER_STROKE}
          />
        ) : (
          <ClipboardList
            className="w-8 h-8"
            strokeWidth={DISCOVER_STROKE}
          />
        )}
      </span>
      <span className="max-w-[6rem] text-xs font-bold leading-tight text-foreground">
        {browseLabel}
      </span>
    </button>
  );

  if (items.length === 0) {
    return (
      <>
        <div
          className={cn(
            "rounded-[1rem] border border-dashed px-4 py-5 dark:bg-zinc-900/40",
            variant === "hire"
              ? "border-[#7B61FF]/25 bg-[rgba(123,97,255,0.06)]"
              : "border-border/50 bg-muted/25",
          )}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-1 flex-col items-center gap-2 text-center text-sm text-muted-foreground sm:items-start sm:text-left">
              {variant === "hire" ? (
                <p>
                  No helpers showing as available right now — try{" "}
                  <button
                    type="button"
                    onClick={onBrowseTap}
                    className="font-semibold text-[#7B61FF] underline-offset-4 hover:underline"
                  >
                    browsing all helpers
                  </button>
                  .
                </p>
              ) : (
                <p>
                  Nothing live right now — open{" "}
                  <Link
                    to={explorePath}
                    className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    <Compass
                      className={cn(discoverIcon.sm, "inline shrink-0")}
                      strokeWidth={DISCOVER_STROKE}
                    />
                    Explore
                  </Link>
                  .
                </p>
              )}
            </div>
            {variant === "work" ? BrowseRoundControl : null}
          </div>
        </div>
        <DiscoverRealtimeStripDetailDialog
          open={detailOpen}
          onOpenChange={closeDetail}
          hire={detailHire}
          work={detailWork}
          variant={variant}
        />
      </>
    );
  }

  /* ——— Work mode: vertical list (mockup) ——— */
  if (variant === "work") {
    const rows = items as WorkRowItem[];

    return (
      <>
      <div className="space-y-4">
        {/* Category Icons Row - Work Mode */}
        <div className="mt-2 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden gap-3 px-4 pb-2">
          <button
            onClick={() => setSelectedFilterCategory("all")}
            className={cn(
              "flex flex-col items-center gap-2 shrink-0 transition-transform active:scale-95",
              "focus-visible:outline-none focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            <div className={cn(
              "relative h-14 w-14 rounded-full flex items-center justify-center border transition-all",
              "bg-white/85 shadow-sm backdrop-blur-md dark:bg-zinc-900/55",
              selectedFilterCategory === "all"
                ? "border-emerald-500/70 text-emerald-700 shadow-[0_10px_25px_-16px_rgba(16,185,129,0.7)] dark:text-emerald-300"
                : "border-slate-200/80 text-slate-500 dark:border-white/10 dark:text-zinc-400"
            )}>
              <Compass className="h-9 w-9" strokeWidth={2.5} />
            </div>
            <span className={cn(
              "text-[9px] font-extrabold uppercase tracking-[0.14em]",
              selectedFilterCategory === "all" ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500 dark:text-zinc-500"
            )}>All</span>
          </button>

          {DISCOVER_HOME_CATEGORIES.filter(c => c.id !== ALL_HELP_CATEGORY_ID).map(cat => {
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedFilterCategory(cat.id as ServiceCategoryId)}
                className={cn(
                  "flex flex-col items-center gap-2 shrink-0 transition-transform active:scale-95",
                  "focus-visible:outline-none focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                <div className={cn(
                  "relative h-14 w-14 rounded-full flex items-center justify-center border transition-all",
                  "bg-white/85 shadow-sm backdrop-blur-md dark:bg-zinc-900/55",
                  selectedFilterCategory === cat.id
                    ? "border-emerald-500/70 text-emerald-700 shadow-[0_10px_25px_-16px_rgba(16,185,129,0.7)] dark:text-emerald-300"
                    : "border-slate-200/80 text-slate-500 dark:border-white/10 dark:text-zinc-400"
                )}>
                  <span className="h-9 w-9 flex items-center justify-center">
                    {categoryIconNode(cat.id, "h-6 w-6")}
                  </span>
                </div>
                <span className={cn(
                  "text-[9px] font-extrabold uppercase tracking-[0.14em]",
                  selectedFilterCategory === cat.id ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500 dark:text-zinc-500"
                )}>{cat.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        <div
          className={cn(
            "flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "md:mx-0 md:flex md:max-w-full md:flex-nowrap md:justify-start md:gap-2.5 md:overflow-visible md:px-0 md:pb-0 md:snap-none",
          )}
          role="list"
          aria-label="Requests now near you"
        >
          {rows.map((row) => (
            <button
              key={row.key}
              type="button"
              role="listitem"
              onClick={() => openWorkDetail(row)}
              className={cn(
                "flex w-[6.25rem] shrink-0 snap-start flex-col items-center gap-0.5 rounded-2xl py-1 transition-transform",
                "outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "active:scale-[0.97] md:w-[5.5rem]",
              )}
            >
              <div className="relative inline-flex">
                <div className={cn("relative overflow-visible rounded-full p-[3px]", stripAvatarRingClass("work"))}>
                  <div className="rounded-full bg-white p-0.5 dark:bg-zinc-950">
                    <Avatar className="h-[5.5rem] w-[5.5rem] border-0 md:h-[5.25rem] md:w-[5.25rem]">
                      <AvatarImage
                        src={row.thumbUrl || undefined}
                        className="object-cover"
                        loading="lazy"
                        decoding="async"
                        alt=""
                      />
                      <AvatarFallback className="text-lg font-bold">
                        {row.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <LiveAvatarDot />
                </div>
                {row.clientId.trim() ? (
                  <DiscoverProfileSaveBadge
                    targetUserId={row.clientId}
                    accent="work"
                    viewerUserId={user?.id}
                    favoriteUserIds={favoriteUserIds}
                  />
                ) : null}
              </div>
              <span className="line-clamp-2 w-full px-0.5 text-center text-[12px] font-medium lowercase leading-tight tracking-normal text-zinc-900 dark:text-zinc-50">
                {shortDisplayName(row.name)}
              </span>
            </button>
          ))}
        </div>
      </div>
      <DiscoverRealtimeStripDetailDialog
        open={detailOpen}
        onOpenChange={closeDetail}
        hire={detailHire}
        work={detailWork}
        variant={variant}
      />
      </>
    );
  }

  /* ——— Hire mode: helper cards ——— */
  const hireStrip = items as HireStripItem[];
  return (
    <>
    <div className="space-y-4">
      {/* Category Icons Row - Hire Mode */}
      <div className="mt-2 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden gap-3 px-4 pb-2">
        <button
          onClick={() => setSelectedFilterCategory("all")}
          className={cn(
            "flex flex-col items-center gap-2 shrink-0 transition-transform active:scale-95",
            "focus-visible:outline-none focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          <div className={cn(
            "relative h-14 w-14 rounded-full flex items-center justify-center border transition-all",
            "bg-white/85 shadow-sm backdrop-blur-md dark:bg-zinc-900/55",
            selectedFilterCategory === "all"
              ? "border-violet-500/70 text-violet-700 shadow-[0_10px_25px_-16px_rgba(124,58,237,0.7)] dark:text-violet-300"
              : "border-slate-200/80 text-slate-500 dark:border-white/10 dark:text-zinc-400"
          )}>
            <Compass className="h-9 w-9" strokeWidth={2.5} />
          </div>
          <span className={cn(
            "text-[9px] font-extrabold uppercase tracking-[0.14em]",
            selectedFilterCategory === "all" ? "text-violet-700 dark:text-violet-300" : "text-slate-500 dark:text-zinc-500"
          )}>All</span>
        </button>

        {DISCOVER_HOME_CATEGORIES.filter(c => c.id !== ALL_HELP_CATEGORY_ID).map(cat => {
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedFilterCategory(cat.id as ServiceCategoryId)}
              className={cn(
                "flex flex-col items-center gap-2 shrink-0 transition-transform active:scale-95",
                "focus-visible:outline-none focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <div className={cn(
                "relative h-14 w-14 rounded-full flex items-center justify-center border transition-all",
                "bg-white/85 shadow-sm backdrop-blur-md dark:bg-zinc-900/55",
                selectedFilterCategory === cat.id
                  ? "border-violet-500/70 text-violet-700 shadow-[0_10px_25px_-16px_rgba(124,58,237,0.7)] dark:text-violet-300"
                  : "border-slate-200/80 text-slate-500 dark:border-white/10 dark:text-zinc-400"
              )}>
                <span className="h-9 w-9 flex items-center justify-center">
                  {categoryIconNode(cat.id, "h-6 w-6")}
                </span>
              </div>
              <span className={cn(
                "text-[9px] font-extrabold uppercase tracking-[0.14em]",
                selectedFilterCategory === cat.id ? "text-violet-700 dark:text-violet-300" : "text-slate-500 dark:text-zinc-500"
              )}>{cat.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "gap-2 pb-0.5",
          "flex snap-x snap-mandatory overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "md:mx-0 md:flex md:max-w-full md:flex-nowrap md:justify-start md:gap-2.5 md:overflow-visible md:px-0 md:pb-0 md:snap-none",
        )}
        role="list"
      >
        {hireStrip.map((it) => (
          <button
            key={it.key}
            type="button"
            role="listitem"
            onClick={() => openHireDetail(it)}
            className={cn(
              "flex w-[6.25rem] shrink-0 snap-start flex-col items-center gap-0.5 rounded-2xl py-1 transition-transform",
              "outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "active:scale-[0.97] md:w-[5.5rem]",
            )}
          >
            <div className="relative inline-flex">
              <div className={cn("relative overflow-visible rounded-full p-[3px]", stripAvatarRingClass("hire"))}>
                <div className="rounded-full bg-white p-0.5 dark:bg-zinc-950">
                  <Avatar className="h-[5.5rem] w-[5.5rem] border-0 md:h-[5.25rem] md:w-[5.25rem]">
                    <AvatarImage
                      src={it.photo || undefined}
                      className="object-cover"
                      loading="lazy"
                      decoding="async"
                      alt=""
                    />
                    <AvatarFallback className="text-lg font-bold">
                      {it.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <LiveAvatarDot />
              </div>
              {it.helperUserId.trim() ? (
                <DiscoverProfileSaveBadge
                  targetUserId={it.helperUserId}
                  accent="hire"
                  viewerUserId={user?.id}
                  favoriteUserIds={favoriteUserIds}
                />
              ) : null}
            </div>
            <span className="line-clamp-2 w-full px-0.5 text-center text-[12px] font-medium lowercase leading-tight tracking-normal text-zinc-900 dark:text-zinc-50">
              {shortDisplayName(it.name)}
            </span>
          </button>
        ))}
      </div>
    </div>
    <DiscoverRealtimeStripDetailDialog
      open={detailOpen}
      onOpenChange={closeDetail}
      hire={detailHire}
      work={detailWork}
      variant={variant}
    />
    </>
  );
}
