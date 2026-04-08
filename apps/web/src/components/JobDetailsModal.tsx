import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  discoverSheetDialogContentClassName,
  discoverSheetInnerCardClassName,
  DiscoverSheetTopHandle,
} from "@/lib/discoverSheetDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    MapPin, Clock, Hourglass, X,
    Sparkles, UtensilsCrossed, Baby, HelpCircle, AlignLeft,
    Calendar, Briefcase, RefreshCw, Globe, CheckCircle2, Loader2, XCircle,
    CalendarClock, Languages, ListChecks, Banknote, CircleDollarSign, StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StarRating } from "./StarRating";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ImageLightboxModal } from "./ImageLightboxModal";
import { ExpiryCountdown } from "@/components/ExpiryCountdown";

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

/** Incoming-style modals: text rows, no icon tiles, neutral palette. */
function JobDetailRow({
    simple,
    label,
    children,
    icon,
    multiline,
}: {
    simple: boolean;
    label: string;
    children: ReactNode;
    icon?: ReactNode;
    multiline?: boolean;
}) {
    if (simple) {
        return (
            <div className="border-b border-border py-3.5 last:border-b-0">
                <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
                <div
                    className={cn(
                        "mt-1 text-sm font-medium leading-snug text-foreground",
                        multiline && "whitespace-pre-wrap leading-relaxed"
                    )}
                >
                    {children}
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
                        multiline && "whitespace-pre-wrap"
                    )}
                >
                    {children}
                </div>
            </div>
        </div>
    );
}

function SectionTitle({ simple, children }: { simple: boolean; children: ReactNode }) {
    return (
        <h3
            className={cn(
                "px-0.5",
                simple
                    ? "text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
                    : "text-[11px] font-bold uppercase tracking-[0.16em] text-orange-700/70 dark:text-orange-400/85"
            )}
        >
            {children}
        </h3>
    );
}

export function JobDetailsModal({ 
    isOpen, onOpenChange, job, formatJobTitle, isOwnRequest, 
    onConfirm, isConfirming, showAcceptButton, onDecline, isDeclining,
    sheetPresentation = false,
    previewLayout = false,
    incomingActionMessage = null,
}: JobDetailsModalProps) {
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    if (!job) return null;

    const isCommunityPostJob = Boolean(job.community_post_id);
    const hideNannyPlaceholders =
        isCommunityPostJob && job.service_type !== "nanny";

    const getServiceIcon = (serviceType?: string) => {
        if (serviceType === 'cleaning') return <Sparkles className="w-4 h-4" />;
        if (serviceType === 'cooking') return <UtensilsCrossed className="w-4 h-4" />;
        if (serviceType === 'nanny') return <Baby className="w-4 h-4" />;
        if (serviceType === 'other_help') return <HelpCircle className="w-4 h-4" />;
        return <HelpCircle className="w-4 h-4" />;
    };

    const getServiceImage = (serviceType?: string) => {
        if (serviceType === 'cleaning') return "/cleaning-mar22.png";
        if (serviceType === 'cooking') return "/cooking-mar22.png";
        if (serviceType === 'nanny') return "/nanny-mar22.png";
        return "/other-mar22.png";
    };

    const clean = (text?: string) => {
        if (!text) return '';
        // If it's a range like "1_4", replace underscore with a hyphen: "1-4"
        return text.replace(/(\d)_(\d)/g, '$1-$2').replace(/_/g, ' ');
    };

    const client = job.profiles;

    const jobNotesText =
        typeof job.notes === "string" && job.notes.trim() ? job.notes.trim() : "";
    const budgetLabel =
        job.budget_min != null || job.budget_max != null
            ? [job.budget_min, job.budget_max]
                  .filter((v) => v != null && v !== "")
                  .map(String)
                  .join(" – ")
            : "";

    /** Discover sheet + jobs-tab incoming accept/decline: calmer layout. */
    const incomingSimple =
        previewLayout || sheetPresentation || Boolean(showAcceptButton && onDecline);

    /** Override DialogContent defaults (grid/gap/p-6) so hero + scroll + footer stay in one column and the action bar stays visible. */
    const defaultShellClass =
        "flex !h-[100dvh] !max-h-[100dvh] w-full max-w-none !flex-col !gap-0 overflow-hidden rounded-none border-none bg-[hsl(var(--background))] !p-0 shadow-2xl focus:outline-none sm:!h-auto sm:!max-h-[90vh] sm:max-w-lg sm:rounded-[2.5rem]";

    const modalBody = (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <VisuallyHidden>
                    <DialogTitle>{formatJobTitle(job)} Details</DialogTitle>
                </VisuallyHidden>

                {/* Hero — slimmer image strip + restrained badges */}
                <div className="relative h-[13rem] w-full shrink-0 overflow-hidden bg-zinc-950 sm:h-[15rem]">
                    <img
                        src={getServiceImage(job.service_type)}
                        alt={formatJobTitle(job)}
                        className="h-full w-full object-cover select-none"
                    />
                    <div
                        className={cn(
                            "absolute inset-0",
                            incomingSimple && !isOwnRequest
                                ? "bg-gradient-to-b from-black/30 via-black/10 to-black/50"
                                : "bg-gradient-to-b from-black/45 via-black/20 to-black/75"
                        )}
                    />

                    {!sheetPresentation && (
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="absolute right-3 top-3 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md transition-colors hover:bg-black/50 active:scale-95"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                    )}

                    {/* Service category — subtle chip, top-left */}
                    <div className="absolute left-3 top-3 z-40 max-w-[70%]">
                        <div className="inline-flex items-center gap-1.5 rounded-md border border-white/25 bg-black/35 px-2.5 py-1.5 text-white shadow-sm backdrop-blur-md">
                            <span className="text-white/90 [&>svg]:h-3.5 [&>svg]:w-3.5">
                                {getServiceIcon(job.service_type)}
                            </span>
                            <span className="text-[11px] font-semibold uppercase tracking-wide">
                                {formatJobTitle(job)}
                            </span>
                        </div>
                    </div>

                    {/* Bottom stack: own-request meta + client (gradient dock) */}
                    <div
                        className={cn(
                            "absolute inset-x-0 bottom-0 z-40 px-3 pb-3 pt-10 sm:px-4 sm:pb-3.5 sm:pt-12",
                            incomingSimple && !isOwnRequest
                                ? "bg-gradient-to-t from-black/65 via-black/25 to-transparent"
                                : "bg-gradient-to-t from-black/85 via-black/50 to-transparent"
                        )}
                    >
                        {isOwnRequest && (
                            <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                                <span className="text-[10px] font-medium uppercase tracking-wider text-white/75">
                                    Your listing
                                </span>
                                <div className="flex items-center gap-1.5 rounded border border-white/15 bg-black/45 px-2 py-1 font-mono text-[11px] tabular-nums text-white/95 backdrop-blur-sm">
                                    <Clock className="h-3 w-3 shrink-0 text-white/60" aria-hidden />
                                    <LiveTimer createdAt={job.created_at} />
                                </div>
                            </div>
                        )}

                        {client &&
                            (incomingSimple && !isOwnRequest ? (
                                <div className="flex items-center gap-3">
                                    <Link
                                        to={job.client_id ? `/profile/${job.client_id}` : "#"}
                                        onClick={(e) => {
                                            if (!job.client_id) {
                                                e.preventDefault();
                                                return;
                                            }
                                            onOpenChange(false);
                                        }}
                                        className="shrink-0 rounded-full outline-none shadow-lg transition-transform hover:scale-[1.03] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                                        aria-label={`View ${client.full_name || "client"} public profile`}
                                    >
                                        <Avatar className="h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20">
                                            <AvatarImage src={client.photo_url || ""} className="object-cover" />
                                            <AvatarFallback className="bg-white/20 text-xl font-bold text-white backdrop-blur-sm sm:text-2xl">
                                                {client.full_name?.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                    </Link>
                                    <div className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate text-lg font-bold leading-tight text-white drop-shadow-md sm:text-xl">
                                            {client.full_name}
                                        </span>
                                        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                <StarRating
                                                    rating={client.average_rating || 0}
                                                    size="md"
                                                    starClassName="text-white drop-shadow-sm"
                                                    emptyStarClassName="text-white/35"
                                                    numberClassName="text-white/95 drop-shadow-sm"
                                                />
                                                <span className="text-[10px] font-semibold uppercase tracking-wide text-white/75 sm:text-[11px]">
                                                    {client.total_ratings || 0} reviews
                                                </span>
                                            </div>
                                            <div
                                                className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] tabular-nums text-white/95"
                                                title={
                                                    job.community_post_expires_at
                                                        ? "Time until post expires"
                                                        : "Time since invite sent"
                                                }
                                            >
                                                <Clock className="h-3 w-3 shrink-0 text-white/60" aria-hidden />
                                                {job.community_post_expires_at ? (
                                                    <ExpiryCountdown
                                                        compact
                                                        expiresAtIso={job.community_post_expires_at}
                                                        endedLabel="Ended"
                                                        className="text-[10px] font-semibold text-white/95"
                                                    />
                                                ) : (
                                                    <span className="text-white/90">
                                                        <LiveTimer createdAt={job.created_at} />
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-xl border border-white/15 bg-black/30 p-3 backdrop-blur-md sm:p-3.5">
                                    {!isOwnRequest && (
                                        <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                                            <span className="text-[9px] font-medium uppercase tracking-wider text-white/65">
                                                {job.community_post_expires_at
                                                    ? "Post expires in"
                                                    : "Invite sent"}
                                            </span>
                                            <div className="flex items-center gap-1.5 font-mono text-[10px] tabular-nums text-white/90">
                                                <Clock className="h-3 w-3 shrink-0 text-white/50" aria-hidden />
                                                {job.community_post_expires_at ? (
                                                    <ExpiryCountdown
                                                        compact
                                                        expiresAtIso={job.community_post_expires_at}
                                                        endedLabel="Ended"
                                                        className="text-[10px] font-semibold text-white/95"
                                                    />
                                                ) : (
                                                    <span className="text-white/80">
                                                        <LiveTimer createdAt={job.created_at} />
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-12 w-12 shrink-0 shadow-lg ring-2 ring-white/10 sm:h-14 sm:w-14">
                                            <AvatarImage src={client.photo_url || ""} className="object-cover" />
                                            <AvatarFallback className="bg-zinc-800 text-lg font-bold text-white">
                                                {client.full_name?.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex min-w-0 flex-1 flex-col">
                                            <span className="truncate text-base font-bold leading-tight text-white drop-shadow-sm sm:text-lg">
                                                {client.full_name}
                                            </span>
                                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                                <StarRating
                                                    rating={client.average_rating || 0}
                                                    size="sm"
                                                    starClassName="text-white"
                                                    emptyStarClassName="text-white/30"
                                                    numberClassName="text-white/70"
                                                />
                                                <span className="text-[9px] font-semibold uppercase tracking-wide text-white/45">
                                                    {client.total_ratings || 0} reviews
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>

                <div className={cn(
                    "flex min-h-0 flex-1 flex-col overflow-y-auto bg-[hsl(var(--background))] custom-scrollbar",
                    incomingSimple ? "space-y-5 px-4 pb-6 pt-4" : "space-y-6 px-4 pb-6 pt-4 sm:space-y-8 sm:p-8 sm:pb-8",
                    sheetPresentation ? "sm:max-h-[min(50vh,420px)]" : "sm:max-h-[60vh]"
                )}>
                    {/* Summary: location + duration */}
                    {incomingSimple ? (
                        <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/25 p-4">
                            <div>
                                <p className="text-[11px] font-medium text-muted-foreground">Location</p>
                                <p className="mt-0.5 text-sm font-semibold leading-snug text-foreground">
                                    {job.location_city}
                                </p>
                            </div>
                            <div>
                                <p className="text-[11px] font-medium text-muted-foreground">Duration</p>
                                <p className="mt-0.5 text-sm font-semibold capitalize leading-snug text-foreground">
                                    {clean(job.time_duration) || "Flexible"}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-[1.25rem] border border-orange-200/45 bg-transparent sm:rounded-3xl dark:border-orange-900/40">
                            <div className="grid grid-cols-2 divide-x divide-orange-100/70 dark:divide-zinc-700/80">
                                <div className="flex flex-col gap-2 p-4 sm:p-5">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-600/75 dark:text-orange-400/90">
                                        Target location
                                    </span>
                                    <div className="flex min-w-0 items-start gap-2">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/12 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
                                            <MapPin className="h-4 w-4" strokeWidth={2.25} />
                                        </div>
                                        <span className="pt-0.5 text-[15px] font-bold leading-snug tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-base">
                                            {job.location_city}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 p-4 sm:p-5">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-600/75 dark:text-orange-400/90">
                                        Time duration
                                    </span>
                                    <div className="flex min-w-0 items-start gap-2">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/12 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
                                            <Hourglass className="h-4 w-4" strokeWidth={2.25} />
                                        </div>
                                        <span className="pt-0.5 text-[15px] font-bold capitalize leading-snug tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-base">
                                            {clean(job.time_duration) || "Flexible"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Service particulars */}
                    <div className="space-y-2.5">
                        <SectionTitle simple={incomingSimple}>Job details</SectionTitle>
                        <div
                            className={cn(
                                incomingSimple
                                    ? "rounded-xl border border-border bg-card/50 px-4"
                                    : "overflow-hidden rounded-[1.25rem] border border-orange-100/55 bg-transparent sm:rounded-2xl dark:border-border/50"
                            )}
                        >
                            <div
                                className={cn(
                                    !incomingSimple &&
                                        "divide-y divide-orange-100/70 dark:divide-zinc-800/80"
                                )}
                            >
                            {job.start_at && (
                                <JobDetailRow
                                    simple={incomingSimple}
                                    label="Scheduled for"
                                    icon={<Calendar className="h-5 w-5" strokeWidth={2} />}
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
                                    icon={<Briefcase className="h-5 w-5" strokeWidth={2} />}
                                >
                                    {clean(job.care_type)}
                                </JobDetailRow>
                            )}
                            {job.children_count > 0 && !hideNannyPlaceholders && (
                                <JobDetailRow
                                    simple={incomingSimple}
                                    label="Children"
                                    icon={<Baby className="h-5 w-5" strokeWidth={2} />}
                                >
                                    {job.children_count}{" "}
                                    {job.children_age_group ? `(${clean(job.children_age_group)})` : ""}
                                </JobDetailRow>
                            )}
                            {job.care_frequency && (
                                <JobDetailRow
                                    simple={incomingSimple}
                                    label="Frequency"
                                    icon={<RefreshCw className="h-5 w-5" strokeWidth={2} />}
                                >
                                    {clean(job.care_frequency)}
                                </JobDetailRow>
                            )}
                            {job.shift_hours && String(job.shift_hours).trim() && (
                                <JobDetailRow
                                    simple={incomingSimple}
                                    label="Shift"
                                    icon={<CalendarClock className="h-5 w-5" strokeWidth={2} />}
                                >
                                    {clean(String(job.shift_hours))}
                                </JobDetailRow>
                            )}
                            {Array.isArray(job.languages_pref) && job.languages_pref.length > 0 && (
                                <JobDetailRow
                                    simple={incomingSimple}
                                    label="Language preferences"
                                    icon={<Languages className="h-5 w-5" strokeWidth={2} />}
                                >
                                    {job.languages_pref.map((lang: string) => clean(lang)).join(", ")}
                                </JobDetailRow>
                            )}
                            {Array.isArray(job.requirements) && job.requirements.length > 0 && (
                                <JobDetailRow
                                    simple={incomingSimple}
                                    label="Requirements"
                                    icon={<ListChecks className="h-5 w-5" strokeWidth={2} />}
                                >
                                    {job.requirements.map((r: string) => clean(r)).join(", ")}
                                </JobDetailRow>
                            )}
                            {budgetLabel && (
                                <JobDetailRow
                                    simple={incomingSimple}
                                    label="Budget"
                                    icon={<Banknote className="h-5 w-5" strokeWidth={2} />}
                                >
                                    {budgetLabel}
                                </JobDetailRow>
                            )}
                            {job.offered_hourly_rate != null && Number(job.offered_hourly_rate) > 0 && (
                                <JobDetailRow
                                    simple={incomingSimple}
                                    label="Offered hourly rate"
                                    icon={<CircleDollarSign className="h-5 w-5" strokeWidth={2} />}
                                >
                                    {Number(job.offered_hourly_rate)}
                                </JobDetailRow>
                            )}
                            {jobNotesText && (
                                <JobDetailRow
                                    simple={incomingSimple}
                                    label="Request notes"
                                    icon={<StickyNote className="h-5 w-5" strokeWidth={2} />}
                                    multiline
                                >
                                    {jobNotesText}
                                </JobDetailRow>
                            )}

                            {isCommunityPostJob && job.community_post_id && (
                                <JobDetailRow simple={incomingSimple} label="From" icon={<AlignLeft className="h-5 w-5" strokeWidth={2} />}>
                                    <Link
                                        to={`/public/posts?post=${job.community_post_id}`}
                                        className={cn(
                                            "font-medium underline-offset-2 hover:underline",
                                            incomingSimple
                                                ? "text-foreground"
                                                : "text-orange-600 dark:text-orange-400"
                                        )}
                                    >
                                        View availability post
                                    </Link>
                                </JobDetailRow>
                            )}
                            {job.service_details &&
                                Object.entries(job.service_details).map(([key, value]) => {
                                    if (key === "custom" || key === "images") return null;
                                    if (key === "from_lat" || key === "from_lng" || key === "to_lat" || key === "to_lng")
                                        return null;
                                    if (key === "care_type" || key === "children_count" || key === "care_frequency")
                                        return null;
                                    if (isCommunityPostJob && (key === "source" || key === "community_post_id"))
                                        return null;

                                    return (
                                        <JobDetailRow
                                            key={key}
                                            simple={incomingSimple}
                                            label={clean(key)}
                                            icon={<AlignLeft className="h-5 w-5" strokeWidth={2} />}
                                        >
                                            {clean(String(value))}
                                        </JobDetailRow>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Bio & languages */}
                    {client && (client.bio || client.languages || client.city) && (
                        <div className="space-y-2.5">
                            <SectionTitle simple={incomingSimple}>About the client</SectionTitle>
                            <div
                                className={cn(
                                    "space-y-4",
                                    incomingSimple
                                        ? "rounded-xl border border-border bg-muted/20 p-4"
                                        : "rounded-[1.25rem] border border-orange-100/60 bg-transparent p-5 sm:rounded-3xl sm:p-6 dark:border-orange-900/35"
                                )}
                            >
                                {client.bio && (
                                    <p
                                        className={cn(
                                            "leading-relaxed",
                                            incomingSimple
                                                ? "text-sm text-foreground"
                                                : "text-[15px] font-medium text-zinc-700 dark:text-zinc-200 sm:text-sm"
                                        )}
                                    >
                                        {client.bio}
                                    </p>
                                )}
                                <div className={cn("flex flex-wrap gap-2", incomingSimple && "gap-x-3 gap-y-1.5")}>
                                    {client.city && (
                                        <span
                                            className={cn(
                                                "inline-flex items-center gap-1.5 text-sm",
                                                incomingSimple
                                                    ? "font-medium text-foreground"
                                                    : "rounded-full border border-orange-200/70 bg-transparent px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-orange-700 dark:border-orange-800/50 dark:text-orange-300"
                                            )}
                                        >
                                            <MapPin
                                                className={cn(
                                                    "shrink-0",
                                                    incomingSimple ? "h-4 w-4 text-muted-foreground" : "h-3.5 w-3.5 text-orange-500"
                                                )}
                                                aria-hidden
                                            />
                                            {incomingSimple ? (
                                                <span>
                                                    <span className="text-muted-foreground">City </span>
                                                    {client.city}
                                                </span>
                                            ) : (
                                                client.city
                                            )}
                                        </span>
                                    )}
                                    {client.languages &&
                                        Array.isArray(client.languages) &&
                                        client.languages.map((lang: string) =>
                                            incomingSimple ? (
                                                <span
                                                    key={lang}
                                                    className="rounded-md bg-muted/80 px-2 py-0.5 text-xs font-medium text-foreground"
                                                >
                                                    {lang}
                                                </span>
                                            ) : (
                                                <div
                                                    key={lang}
                                                    className="inline-flex items-center gap-1.5 rounded-full border border-orange-100/60 bg-transparent px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-600 dark:border-border/50 dark:text-zinc-300"
                                                >
                                                    <Globe className="h-3.5 w-3.5 text-orange-500/90" />
                                                    {lang}
                                                </div>
                                            )
                                        )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Job photos */}
                    {job.service_details?.images && job.service_details.images.length > 0 && (
                        <div className="space-y-2.5">
                            <SectionTitle simple={incomingSimple}>Photos</SectionTitle>
                            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                                {job.service_details.images.map((img: string, idx: number) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        className={cn(
                                            "relative aspect-video overflow-hidden rounded-xl shadow-sm transition cursor-zoom-in active:scale-[0.99]",
                                            incomingSimple
                                                ? "ring-1 ring-border hover:ring-foreground/20"
                                                : "rounded-2xl ring-1 ring-orange-100/70 hover:ring-2 hover:ring-orange-400/80 dark:ring-zinc-700/80"
                                        )}
                                        onClick={() => setLightboxIndex(idx)}
                                    >
                                        <img src={img} alt={`Job photo ${idx + 1}`} className="h-full w-full object-cover" />
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
                            <SectionTitle simple={incomingSimple}>Notes & requirements</SectionTitle>
                            <div
                                className={cn(
                                    "py-1 pl-4 text-[15px] font-medium leading-relaxed sm:pl-5 sm:text-base",
                                    incomingSimple
                                        ? "border-l-2 border-border text-foreground"
                                        : "border-l-[3px] border-orange-500 text-zinc-800 dark:border-orange-500/80 dark:text-zinc-100"
                                )}
                            >
                                {job.service_details.custom}
                            </div>
                        </div>
                    )}
                </div>

                {/* Fixed bottom: incoming = Decline + Accept; status message; else single Accept when applicable */}
                {(incomingActionMessage ||
                    (showAcceptButton && onConfirm)) && (
                    <div
                        className={cn(
                            "shrink-0 flex animate-in flex-row items-stretch gap-3 border-t bg-[hsl(var(--background))]/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 backdrop-blur-md duration-500 slide-in-from-bottom-4 sm:gap-4 sm:p-6",
                            incomingSimple ? "border-border" : "border-orange-100/50 dark:border-border"
                        )}
                    >
                        {incomingActionMessage ? (
                            <p className="w-full text-center text-sm font-medium leading-relaxed text-muted-foreground">
                                {incomingActionMessage}
                            </p>
                        ) : onDecline ? (
                            <>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-14 flex-1 rounded-[18px] border-slate-200 font-bold transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-[0.98] dark:border-white/10 dark:hover:bg-red-500/10 sm:text-base"
                                    onClick={onDecline}
                                    disabled={isDeclining || isConfirming}
                                >
                                    {isDeclining ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <>
                                            <XCircle className="mr-2 h-5 w-5" />
                                            Decline
                                        </>
                                    )}
                                </Button>
                                <Button
                                    type="button"
                                    className="h-14 flex-1 rounded-[18px] bg-emerald-600 font-bold text-white shadow-[0_8px_20px_rgba(5,150,105,0.2)] transition-all hover:bg-emerald-700 active:scale-[0.98] sm:text-base"
                                    onClick={onConfirm}
                                    disabled={isConfirming || isDeclining}
                                >
                                    {isConfirming ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <>
                                            <CheckCircle2 className="mr-2 h-5 w-5" />
                                            Accept
                                        </>
                                    )}
                                </Button>
                            </>
                        ) : (
                            <Button
                                type="button"
                                className="flex h-14 w-full items-center justify-center gap-3 rounded-[20px] bg-emerald-600 font-black text-lg text-white shadow-[0_10px_30px_rgba(5,150,105,0.3)] transition-all hover:bg-emerald-700 active:scale-[0.98]"
                                onClick={onConfirm}
                                disabled={isConfirming}
                            >
                                {isConfirming ? (
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-6 w-6" />
                                        Accept Invitation
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                )}
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent
                className={cn(
                    sheetPresentation ? discoverSheetDialogContentClassName : defaultShellClass
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
