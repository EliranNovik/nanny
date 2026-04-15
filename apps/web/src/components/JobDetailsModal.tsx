import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  discoverSheetDialogContentClassName,
  discoverSheetInnerCardClassName,
  DiscoverSheetTopHandle,
} from "@/lib/discoverSheetDialog";
import {
  MapPin,
  Clock,
  Hourglass,
  X,
  Sparkles,
  UtensilsCrossed,
  Baby,
  HelpCircle,
  AlignLeft,
  Truck,
  Calendar,
  Briefcase,
  RefreshCw,
  CheckCircle2,
  Loader2,
  XCircle,
  Heart,
  CalendarClock,
  Languages,
  ListChecks,
  Banknote,
  CircleDollarSign,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StarRating } from "./StarRating";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ImageLightboxModal } from "./ImageLightboxModal";
import { ExpiryCountdown } from "@/components/ExpiryCountdown";
import { SwipeDecisionLayer } from "@/components/discover/SwipeDecisionLayer";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";

interface JobDetailsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  job: any;
  formatJobTitle: (job: any) => string;
  isOwnRequest?: boolean;
  onConfirm?: () => void;
  isConfirming?: boolean;
  showAcceptButton?: boolean;
  /** Incoming request: decline notification (shown with Accept when set). */
  onDecline?: () => void;
  isDeclining?: boolean;
  /** Discover home incoming strip: same bottom sheet + card shell as availability preview. */
  sheetPresentation?: boolean;
  /** Public profile / read-only preview: same “incoming” simple layout without accept/decline. */
  previewLayout?: boolean;
  /** Replaces accept/decline row (e.g. already responded or not invited). */
  incomingActionMessage?: string | null;
}

const LiveTimer = ({ createdAt }: { createdAt: string }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(createdAt).getTime();
    const update = () => {
      const now = Date.now();
      setElapsed(Math.floor((now - start) / 1000));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const formatElapsedTime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (days > 0) {
      return `${days}d ${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return <>{formatElapsedTime(elapsed)}</>;
};

/** Job modal rows: plain text + optional icon (no grey panels). */
function JobDetailRow({
  simple,
  label,
  children,
  icon,
  multiline,
  colSpanFull,
}: {
  simple: boolean;
  label: string;
  children: ReactNode;
  icon?: ReactNode;
  multiline?: boolean;
  /** Span both columns in a 2-col grid (long notes, links). */
  colSpanFull?: boolean;
}) {
  if (simple) {
    return (
      <div
        className={cn(
          "flex gap-2.5 py-2.5 first:pt-0 sm:gap-3 sm:py-3",
          colSpanFull && "col-span-2",
        )}
      >
        {icon && (
          <span className="mt-0.5 shrink-0 text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[11px]">
            {label}
          </p>
          <div
            className={cn(
              "mt-0.5 text-sm font-medium leading-snug text-foreground sm:text-[15px]",
              multiline && "whitespace-pre-wrap leading-relaxed",
            )}
          >
            {children}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-[3.5rem] items-center gap-3.5 px-4 py-3.5 sm:px-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400">
        {icon ?? <AlignLeft className="h-5 w-5" strokeWidth={2} />}
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {label}
        </span>
        <div
          className={cn(
            "mt-0.5 text-[15px] font-semibold leading-snug text-zinc-900 dark:text-zinc-100",
            multiline && "whitespace-pre-wrap",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  simple,
  children,
}: {
  simple: boolean;
  children: ReactNode;
}) {
  return (
    <h3
      className={cn(
        "mb-3 mt-8 first:mt-0",
        simple
          ? "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          : "text-[11px] font-bold uppercase tracking-[0.16em] text-orange-700/70 dark:text-orange-400/85",
      )}
    >
      {children}
    </h3>
  );
}

export function JobDetailsModal({
  isOpen,
  onOpenChange,
  job,
  formatJobTitle,
  isOwnRequest,
  onConfirm,
  isConfirming,
  showAcceptButton,
  onDecline,
  isDeclining,
  sheetPresentation = false,
  previewLayout: _previewLayout = false,
  incomingActionMessage = null,
}: JobDetailsModalProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { user } = useAuth();
  const { addToast } = useToast();
  const [profileFavorited, setProfileFavorited] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);

  const targetProfileId = useMemo(
    () => (job?.profiles?.id ?? job?.client_id) as string | undefined,
    [job],
  );

  useEffect(() => {
    if (
      !isOpen ||
      !job ||
      !user?.id ||
      !targetProfileId ||
      user.id === targetProfileId
    ) {
      setProfileFavorited(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("profile_favorites")
        .select("favorite_user_id")
        .eq("user_id", user.id)
        .eq("favorite_user_id", targetProfileId)
        .maybeSingle();
      if (!cancelled) setProfileFavorited(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, job?.id, targetProfileId, user?.id]);

  const toggleProfileFavorite = useCallback(async () => {
    if (!user?.id || !targetProfileId || user.id === targetProfileId) return;
    setFavoriteBusy(true);
    try {
      if (profileFavorited) {
        const { error } = await supabase
          .from("profile_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("favorite_user_id", targetProfileId);
        if (error) throw error;
        setProfileFavorited(false);
        addToast({ title: "Removed from saved", variant: "success" });
      } else {
        const { error } = await supabase.from("profile_favorites").insert({
          user_id: user.id,
          favorite_user_id: targetProfileId,
        });
        if (error) throw error;
        setProfileFavorited(true);
        addToast({ title: "Saved — view under Saved", variant: "success" });
      }
    } catch (e: unknown) {
      addToast({
        title: "Could not update",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "error",
      });
    } finally {
      setFavoriteBusy(false);
    }
  }, [user?.id, targetProfileId, profileFavorited, addToast]);

  if (!job) return null;

  const isCommunityPostJob = Boolean(job.community_post_id);
  const hideNannyPlaceholders =
    isCommunityPostJob && job.service_type !== "nanny";

  const getServiceIcon = (serviceType?: string) => {
    if (serviceType === "cleaning")
      return <Sparkles className="h-4 w-4" strokeWidth={2} />;
    if (serviceType === "cooking")
      return <UtensilsCrossed className="h-4 w-4" strokeWidth={2} />;
    if (serviceType === "pickup_delivery")
      return <Truck className="h-4 w-4" strokeWidth={2} />;
    if (serviceType === "nanny")
      return <Baby className="h-4 w-4" strokeWidth={2} />;
    if (serviceType === "other_help")
      return <HelpCircle className="h-4 w-4" strokeWidth={2} />;
    return <HelpCircle className="h-4 w-4" strokeWidth={2} />;
  };

  const getServiceImage = (serviceType?: string) => {
    if (serviceType === "cleaning") return "/cleaning-mar22.png";
    if (serviceType === "cooking") return "/cooking-mar22.png";
    if (serviceType === "nanny") return "/nanny-mar22.png";
    return "/other-mar22.png";
  };

  const clean = (text?: string) => {
    if (!text) return "";
    // If it's a range like "1_4", replace underscore with a hyphen: "1-4"
    return text.replace(/(\d)_(\d)/g, "$1-$2").replace(/_/g, " ");
  };

  const client = job.profiles;
  /** Public profile route for the person shown on the hero (job poster / embedded profile). */
  const heroProfileId: string | undefined = targetProfileId;
  const showProfileHeart = Boolean(
    heroProfileId && user?.id && user.id !== heroProfileId,
  );

  const jobNotesText =
    typeof job.notes === "string" && job.notes.trim() ? job.notes.trim() : "";
  const budgetLabel =
    job.budget_min != null || job.budget_max != null
      ? [job.budget_min, job.budget_max]
          .filter((v) => v != null && v !== "")
          .map(String)
          .join(" – ")
      : "";

  /** Plain text + full-width hero — used for every job modal surface. */
  const incomingSimple = true;

  /** Override DialogContent defaults (grid/gap/p-6) so hero + scroll + footer stay in one column and the action bar stays visible. */
  const defaultShellClass =
    "flex !h-[100dvh] !max-h-[100dvh] w-full max-w-none !flex-col !gap-0 overflow-hidden rounded-none border-none bg-[hsl(var(--background))] !p-0 shadow-2xl focus:outline-none sm:!h-auto sm:!max-h-[90vh] sm:max-w-lg sm:rounded-[2.5rem]";

  const heroImageSrc =
    client?.photo_url && String(client.photo_url).trim()
      ? String(client.photo_url)
      : getServiceImage(job.service_type);

  /** Swipe right = accept, left = decline — any full-screen or sheet presentation. */
  const incomingSwipeEnabled = Boolean(
    showAcceptButton && onConfirm && onDecline && !incomingActionMessage,
  );

  const showFloatingActionBar = Boolean(
    incomingActionMessage || (showAcceptButton && onConfirm),
  );

  const heroSection = (
    <div
      className={cn(
        "relative w-full shrink-0 overflow-hidden bg-zinc-900",
        sheetPresentation
          ? "rounded-t-[1.75rem] sm:rounded-t-2xl"
          : "rounded-none sm:rounded-t-[2.5rem]",
      )}
    >
      {heroProfileId ? (
        <Link
          to={`/profile/${heroProfileId}`}
          onClick={() => onOpenChange(false)}
          className="relative block cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
          aria-label="View profile"
        >
          <img
            src={heroImageSrc}
            alt=""
            className="h-[min(52dvh,26rem)] w-full object-cover object-center select-none sm:h-[min(52dvh,30rem)]"
          />
        </Link>
      ) : (
        <img
          src={heroImageSrc}
          alt=""
          className="h-[min(52dvh,26rem)] w-full object-cover object-center select-none sm:h-[min(52dvh,30rem)]"
        />
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/85 via-black/50 to-transparent" />

      {!sheetPresentation && (
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-black/55 active:scale-95"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      <div className="absolute left-3 top-3 z-50 flex max-w-[min(100%-5rem,85%)] items-center gap-2 rounded-full border border-white/20 bg-black/45 py-1.5 pl-1.5 pr-3 text-white shadow-lg backdrop-blur-md">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white [&>svg]:shrink-0">
          {getServiceIcon(job.service_type)}
        </span>
        <span className="truncate text-[13px] font-semibold tracking-wide drop-shadow-sm">
          {formatJobTitle(job)}
        </span>
      </div>

      {/* Name, reviews & timer on image */}
      <div className="absolute inset-x-0 bottom-0 z-40 px-4 pb-4 pt-10">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            {isOwnRequest ? (
              <p className="text-2xl font-bold tracking-tight text-white drop-shadow-md">
                Your request
              </p>
            ) : client ? (
              <>
                {heroProfileId ? (
                  <Link
                    to={`/profile/${heroProfileId}`}
                    onClick={() => onOpenChange(false)}
                    className="block truncate text-2xl font-bold tracking-tight text-white drop-shadow-md underline-offset-4 hover:underline"
                  >
                    {client.full_name || "Client"}
                  </Link>
                ) : (
                  <p className="truncate text-2xl font-bold tracking-tight text-white drop-shadow-md">
                    {client.full_name || "Client"}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <StarRating
                    rating={client.average_rating || 0}
                    totalRatings={client.total_ratings ?? 0}
                    size="sm"
                    showCount={false}
                    starClassName="text-amber-300"
                    emptyStarClassName="text-white/35"
                    numberClassName="text-white drop-shadow-sm"
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-white/85">
                    {client.total_ratings ?? 0} reviews
                  </span>
                </div>
              </>
            ) : (
              <p className="text-2xl font-bold tracking-tight text-white drop-shadow-md">
                {formatJobTitle(job)}
              </p>
            )}
          </div>
          <div
            className="flex shrink-0 items-center gap-1.5 self-end font-mono text-[11px] tabular-nums text-white/95 drop-shadow-sm"
            title={
              job.community_post_expires_at
                ? "Time until post expires"
                : "Time since invite sent"
            }
          >
            <Clock className="h-3.5 w-3.5 shrink-0 text-white/80" aria-hidden />
            {job.community_post_expires_at ? (
              <ExpiryCountdown
                compact
                expiresAtIso={job.community_post_expires_at}
                endedLabel="Ended"
                className="text-[11px] font-semibold text-white/95"
              />
            ) : (
              <span>
                <LiveTimer createdAt={job.created_at} />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const scrollSection = (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[hsl(var(--background))] [-webkit-overflow-scrolling:touch] custom-scrollbar",
        "space-y-0 px-5 pb-4 pt-5",
        showFloatingActionBar && "pb-32",
      )}
    >
      <div className="min-w-0 space-y-0">
        <SectionTitle simple={incomingSimple}>Job details</SectionTitle>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0 [grid-template-columns:minmax(0,1fr)_minmax(0,1fr)] [&>*:nth-child(2)]:pt-0">
          <JobDetailRow
            simple={incomingSimple}
            label="Location"
            icon={<MapPin className="h-4 w-4" strokeWidth={2} />}
          >
            <span className="break-words">{job.location_city}</span>
          </JobDetailRow>
          <JobDetailRow
            simple={incomingSimple}
            label="Duration"
            icon={<Hourglass className="h-4 w-4" strokeWidth={2} />}
          >
            <span className="capitalize">
              {clean(job.time_duration) || "Flexible"}
            </span>
          </JobDetailRow>
          {job.start_at && (
            <JobDetailRow
              simple={incomingSimple}
              label="Scheduled for"
              icon={<Calendar className="h-4 w-4" strokeWidth={2} />}
            >
              {new Date(job.start_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </JobDetailRow>
          )}
          {job.care_type && !hideNannyPlaceholders && (
            <JobDetailRow
              simple={incomingSimple}
              label="Care type"
              icon={<Briefcase className="h-4 w-4" strokeWidth={2} />}
            >
              {clean(job.care_type)}
            </JobDetailRow>
          )}
          {job.children_count > 0 && !hideNannyPlaceholders && (
            <JobDetailRow
              simple={incomingSimple}
              label="Children"
              icon={<Baby className="h-4 w-4" strokeWidth={2} />}
            >
              {job.children_count}{" "}
              {job.children_age_group
                ? `(${clean(job.children_age_group)})`
                : ""}
            </JobDetailRow>
          )}
          {job.care_frequency && (
            <JobDetailRow
              simple={incomingSimple}
              label="Frequency"
              icon={<RefreshCw className="h-4 w-4" strokeWidth={2} />}
            >
              {clean(job.care_frequency)}
            </JobDetailRow>
          )}
          {job.shift_hours && String(job.shift_hours).trim() && (
            <JobDetailRow
              simple={incomingSimple}
              label="Shift"
              icon={<CalendarClock className="h-4 w-4" strokeWidth={2} />}
            >
              {clean(String(job.shift_hours))}
            </JobDetailRow>
          )}
          {Array.isArray(job.languages_pref) &&
            job.languages_pref.length > 0 && (
              <JobDetailRow
                simple={incomingSimple}
                label="Language preferences"
                icon={<Languages className="h-4 w-4" strokeWidth={2} />}
              >
                {job.languages_pref
                  .map((lang: string) => clean(lang))
                  .join(", ")}
              </JobDetailRow>
            )}
          {Array.isArray(job.requirements) && job.requirements.length > 0 && (
            <JobDetailRow
              simple={incomingSimple}
              label="Requirements"
              icon={<ListChecks className="h-4 w-4" strokeWidth={2} />}
            >
              {job.requirements.map((r: string) => clean(r)).join(", ")}
            </JobDetailRow>
          )}
          {budgetLabel && (
            <JobDetailRow
              simple={incomingSimple}
              label="Budget"
              icon={<Banknote className="h-4 w-4" strokeWidth={2} />}
            >
              {budgetLabel}
            </JobDetailRow>
          )}
          {job.offered_hourly_rate != null &&
            Number(job.offered_hourly_rate) > 0 && (
              <JobDetailRow
                simple={incomingSimple}
                label="Offered hourly rate"
                icon={<CircleDollarSign className="h-4 w-4" strokeWidth={2} />}
              >
                {Number(job.offered_hourly_rate)}
              </JobDetailRow>
            )}
          {jobNotesText && (
            <JobDetailRow
              simple={incomingSimple}
              label="Request notes"
              icon={<StickyNote className="h-4 w-4" strokeWidth={2} />}
              multiline
              colSpanFull
            >
              {jobNotesText}
            </JobDetailRow>
          )}

          {isCommunityPostJob && job.community_post_id && (
            <JobDetailRow
              simple={incomingSimple}
              label="From"
              icon={<AlignLeft className="h-4 w-4" strokeWidth={2} />}
              colSpanFull
            >
              <Link
                to={`/public/posts?post=${job.community_post_id}`}
                className={cn(
                  "font-medium underline-offset-2 hover:underline",
                  incomingSimple
                    ? "text-foreground"
                    : "text-orange-600 dark:text-orange-400",
                )}
              >
                View availability post
              </Link>
            </JobDetailRow>
          )}
          {job.service_details &&
            Object.entries(job.service_details).map(([key, value]) => {
              if (key === "custom" || key === "images") return null;
              if (
                key === "from_lat" ||
                key === "from_lng" ||
                key === "to_lat" ||
                key === "to_lng"
              )
                return null;
              if (
                key === "care_type" ||
                key === "children_count" ||
                key === "care_frequency"
              )
                return null;
              if (
                isCommunityPostJob &&
                (key === "source" || key === "community_post_id")
              )
                return null;

              const strVal = clean(String(value));
              return (
                <JobDetailRow
                  key={key}
                  simple={incomingSimple}
                  label={clean(key)}
                  icon={<AlignLeft className="h-4 w-4" strokeWidth={2} />}
                  colSpanFull={strVal.length > 48}
                >
                  {strVal}
                </JobDetailRow>
              );
            })}
        </div>
      </div>

      {/* Job photos */}
      {job.service_details?.images && job.service_details.images.length > 0 && (
        <div className="space-y-2.5">
          <SectionTitle simple={incomingSimple}>Photos</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {job.service_details.images.map((img: string, idx: number) => (
              <button
                key={idx}
                type="button"
                className="relative aspect-video cursor-zoom-in overflow-hidden rounded-xl transition active:scale-[0.99]"
                onClick={() => setLightboxIndex(idx)}
              >
                <img
                  src={img}
                  alt={`Job photo ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {lightboxIndex !== null && (
        <ImageLightboxModal
          images={job.service_details?.images || []}
          initialIndex={lightboxIndex}
          isOpen={lightboxIndex !== null}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* Notes */}
      {job.service_details?.custom && (
        <div className="space-y-2.5">
          <SectionTitle simple={incomingSimple}>
            Notes & requirements
          </SectionTitle>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
            {job.service_details.custom}
          </p>
        </div>
      )}
    </div>
  );

  const profileHeartButton = showProfileHeart ? (
    <Button
      type="button"
      title={profileFavorited ? "Remove from saved" : "Save profile"}
      aria-label={profileFavorited ? "Remove from saved" : "Save profile"}
      variant="outline"
      className={cn(
        "h-14 w-14 shrink-0 rounded-full border-2 p-0 shadow-[0_6px_20px_rgba(0,0,0,0.12)] backdrop-blur-sm transition-all active:scale-[0.98] disabled:opacity-60 dark:shadow-[0_6px_20px_rgba(0,0,0,0.35]",
        profileFavorited
          ? "border-rose-400 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-500 dark:bg-rose-950/60 dark:text-rose-400 dark:hover:bg-rose-950/80"
          : "border-white/90 bg-background/95 text-rose-500 hover:border-rose-300 hover:bg-rose-50/90 dark:border-white/20 dark:bg-zinc-900/95 dark:hover:bg-rose-950/40",
      )}
      onClick={() => void toggleProfileFavorite()}
      disabled={favoriteBusy}
    >
      {favoriteBusy ? (
        <Loader2 className="h-7 w-7 shrink-0 animate-spin" aria-hidden />
      ) : (
        <Heart
          className={cn("h-7 w-7 shrink-0", profileFavorited && "fill-current")}
          strokeWidth={2}
          aria-hidden
        />
      )}
    </Button>
  ) : null;

  const footerBarShell =
    "pointer-events-auto w-fit min-w-0 max-w-[min(100vw-1.5rem,22rem)] rounded-2xl border border-border/50 bg-[hsl(var(--background))]/92 px-3 py-2 shadow-[0_-4px_28px_rgba(0,0,0,0.07)] backdrop-blur-md dark:border-white/10 dark:bg-background/88 dark:shadow-[0_-4px_28px_rgba(0,0,0,0.28)] mx-auto";

  const footerSection =
    incomingActionMessage || (showAcceptButton && onConfirm) ? (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1">
        {incomingActionMessage ? (
          <div className={footerBarShell}>
            <p className="text-center text-sm font-medium leading-snug text-muted-foreground">
              {incomingActionMessage}
            </p>
          </div>
        ) : onDecline ? (
          <div
            className={cn(
              footerBarShell,
              "flex flex-row items-center justify-center gap-4",
            )}
          >
            <Button
              type="button"
              title="Accept"
              aria-label="Accept"
              className="h-14 w-14 shrink-0 rounded-full bg-emerald-600 p-0 text-white shadow-[0_8px_24px_rgba(5,150,105,0.3)] transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
              onClick={onConfirm}
              disabled={isConfirming || isDeclining}
            >
              {isConfirming ? (
                <Loader2
                  className="h-7 w-7 shrink-0 animate-spin"
                  aria-hidden
                />
              ) : (
                <CheckCircle2 className="h-7 w-7 shrink-0" aria-hidden />
              )}
            </Button>
            {profileHeartButton}
            <Button
              type="button"
              title="Decline"
              aria-label="Decline"
              variant="outline"
              className="h-14 w-14 shrink-0 rounded-full border-2 border-slate-200 bg-background/95 p-0 shadow-[0_6px_20px_rgba(0,0,0,0.1)] backdrop-blur-sm transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-600 active:scale-[0.98] dark:border-white/20 dark:bg-zinc-900/95 dark:hover:bg-red-500/15"
              onClick={onDecline}
              disabled={isDeclining || isConfirming}
            >
              {isDeclining ? (
                <Loader2
                  className="h-7 w-7 shrink-0 animate-spin"
                  aria-hidden
                />
              ) : (
                <XCircle className="h-7 w-7 shrink-0" aria-hidden />
              )}
            </Button>
          </div>
        ) : (
          <div
            className={cn(
              footerBarShell,
              "flex flex-row items-center justify-center gap-4",
            )}
          >
            <Button
              type="button"
              title="Accept invitation"
              aria-label="Accept invitation"
              className="h-14 w-14 shrink-0 rounded-full bg-emerald-600 p-0 text-white shadow-[0_10px_30px_rgba(5,150,105,0.35)] transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
              onClick={onConfirm}
              disabled={isConfirming}
            >
              {isConfirming ? (
                <Loader2
                  className="h-7 w-7 shrink-0 animate-spin"
                  aria-hidden
                />
              ) : (
                <CheckCircle2 className="h-7 w-7 shrink-0" aria-hidden />
              )}
            </Button>
            {profileHeartButton}
          </div>
        )}
      </div>
    ) : null;

  const modalShellInner = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <VisuallyHidden>
        <DialogTitle>{formatJobTitle(job)} Details</DialogTitle>
      </VisuallyHidden>
      {incomingSwipeEnabled ? (
        <>
          <SwipeDecisionLayer
            variant="incoming"
            disabled={Boolean(isConfirming || isDeclining)}
            onSwipeLeft={() => {
              void onDecline?.();
            }}
            onSwipeRight={() => {
              void onConfirm?.();
            }}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {heroSection}
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
              {scrollSection}
              {footerSection}
            </div>
          </SwipeDecisionLayer>
        </>
      ) : (
        <>
          {heroSection}
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            {scrollSection}
            {footerSection}
          </div>
        </>
      )}
    </div>
  );

  const modalBody = modalShellInner;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          sheetPresentation
            ? discoverSheetDialogContentClassName
            : defaultShellClass,
        )}
      >
        {sheetPresentation ? (
          <div className={discoverSheetInnerCardClassName}>
            <DiscoverSheetTopHandle />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {modalBody}
            </div>
          </div>
        ) : (
          modalBody
        )}
      </DialogContent>
    </Dialog>
  );
}
