import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Baby,
  BadgeCheck,
  Bookmark,
  Check,
  ChevronRight,
  Clock,
  Home,
  Loader2,
  MapPin,
  Sparkles,
  Truck,
  Users,
  UtensilsCrossed,
  Wrench,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageLightboxModal } from "@/components/ImageLightboxModal";
import { jobAttachmentImageUrls } from "@/components/JobAttachedPhotosStrip";
import { cn } from "@/lib/utils";
import { avatarUrl } from "@/lib/imageTransform";
import { supabase } from "@/lib/supabase";
import type { DiscoverOpenHelpRequestRow } from "@/hooks/data/useDiscoverOpenHelpRequests";
import {
  DISCOVER_OPEN_HELP_REQUEST_CARD_HOVER,
  DISCOVER_OPEN_HELP_REQUEST_CARD_SURFACE,
} from "@/components/jobs/jobCardSharedClasses";
import {
  discoverRequestCardCarouselBodyClass,
  discoverRequestCardCarouselDescriptionClass,
  discoverRequestCardCarouselFooterActionClass,
  discoverRequestCardCarouselFooterBudgetClass,
  discoverRequestCardCarouselFooterClass,
  discoverRequestCardCarouselMetaRowClass,
  discoverRequestCardCarouselPosterRowClass,
  discoverRequestCardCarouselShellClass,
  discoverRequestCardCarouselTitleClass,
} from "@/components/discover/discoverRequestCarouselCardShared";
import {
  categoryAccentClass,
  categoryIconCircleClass,
  formatOpenHelpRequestBudget,
  openHelpRequestDescription,
  openHelpRequestDetailLine,
  openHelpRequestScheduleLine,
  openHelpRequestTitle,
  openHelpRequestWhenBadgeLabel,
  serviceCategoryTitle,
  whenBadgeToneClass,
} from "@/lib/openHelpRequestDisplay";

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
}: {
  serviceType: string | null | undefined;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[(serviceType ?? "").toLowerCase()] ?? Sparkles;
  return <Icon className={className} aria-hidden />;
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return mins <= 1 ? "Posted just now" : `Posted ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Posted ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Posted ${days}d ago`;
}

const myRequestUploadedImageThumbClass =
  "h-[4.5rem] w-[4.5rem] md:h-20 md:w-20";

const discoverMyRequestMetaRowClass =
  "mt-2 flex min-h-[1.5rem] w-full flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-muted-foreground md:text-base";

const discoverMyRequestMetaIconClass = "h-[1.125rem] w-[1.125rem] shrink-0 md:h-5 md:w-5";

const myRequestPostedBadgeClass = cn(
  "inline-flex rounded-lg bg-zinc-100 px-2.5 py-1 text-sm font-semibold text-zinc-600",
  "dark:bg-zinc-700/80 dark:text-zinc-300",
);

type AcceptedHelperProfile = {
  id: string;
  photo_url: string | null;
  full_name: string | null;
};

function helperInitials(name: string | null | undefined): string {
  return (
    name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"
  );
}

function MyRequestAcceptedCountBadge({
  acceptedCount,
  acceptedHelpers = [],
  size = "carousel",
}: {
  acceptedCount: number;
  acceptedHelpers?: AcceptedHelperProfile[];
  size?: "carousel" | "default";
}) {
  const visibleHelpers = acceptedHelpers.slice(0, 3);
  const showOverflow = acceptedCount > 3;
  const showAvatars = acceptedCount > 0 && visibleHelpers.length > 0;

  const countBadgeClass = cn(
    "inline-flex shrink-0 items-center gap-1.5 rounded-full font-black tabular-nums",
    size === "carousel" ? "h-10 px-3 text-sm" : "h-9 px-2.5 text-xs sm:h-10 sm:text-sm",
    acceptedCount > 0
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : "bg-zinc-200/80 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  );

  return (
    <div className="flex shrink-0 items-center">
      {showAvatars ? (
        <div className="mr-1.5 flex items-center" aria-hidden>
          {visibleHelpers.map((helper, index) => (
            <Avatar
              key={helper.id}
              className={cn("h-8 w-8", index > 0 && "-ml-2.5")}
              title={helper.full_name || undefined}
            >
              <AvatarImage
                src={resolveClientPhotoUrl(helper.photo_url) || undefined}
                alt=""
                className="object-cover"
              />
              <AvatarFallback className="bg-emerald-500/15 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                {helperInitials(helper.full_name)}
              </AvatarFallback>
            </Avatar>
          ))}
          {showOverflow ? (
            <div
              className="-ml-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-black text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100"
              title={`${acceptedCount - 3} more accepted`}
            >
              +
            </div>
          ) : null}
        </div>
      ) : null}
      <span
        className={countBadgeClass}
        aria-label={
          acceptedCount > 0
            ? `${acceptedCount} helpers accepted`
            : "No helpers accepted yet"
        }
      >
        <Users className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
        {acceptedCount}
      </span>
    </div>
  );
}

function MyRequestUploadedImageButton({
  imageUrl,
  className,
  onOpen,
}: {
  imageUrl: string;
  className?: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "pointer-events-auto shrink-0 overflow-hidden rounded-xl ring-1 ring-black/5 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 dark:ring-white/10",
        myRequestUploadedImageThumbClass,
        className,
      )}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      aria-label="View photo full screen"
    >
      <img
        src={imageUrl}
        alt=""
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
    </button>
  );
}

function resolveClientPhotoUrl(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  const trimmed = raw.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return avatarUrl.sm(trimmed) || trimmed;
  }
  const fileName = trimmed.split("/").pop() || trimmed;
  const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
  return avatarUrl.sm(data.publicUrl) || data.publicUrl;
}

function ClientPoster({
  row,
  clientName,
}: {
  row: DiscoverOpenHelpRequestRow;
  clientName: string;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const [useRawUrl, setUseRawUrl] = useState(false);
  const rawPhoto = row.client_photo_url?.trim() || "";
  const transformedPhoto = resolveClientPhotoUrl(row.client_photo_url);
  const photoSrc =
    useRawUrl && (rawPhoto.startsWith("http://") || rawPhoto.startsWith("https://"))
      ? rawPhoto
      : transformedPhoto;
  const showPhoto = Boolean(photoSrc) && !photoFailed;
  const initial = clientName.charAt(0).toUpperCase();

  const inner = (
    <>
      <span className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
        {showPhoto ? (
          <img
            src={photoSrc}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            onError={() => {
              if (
                !useRawUrl &&
                rawPhoto &&
                (rawPhoto.startsWith("http://") || rawPhoto.startsWith("https://")) &&
                photoSrc !== rawPhoto
              ) {
                setUseRawUrl(true);
                return;
              }
              setPhotoFailed(true);
            }}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs font-bold text-muted-foreground">
            {initial}
          </span>
        )}
      </span>
      <span className="flex min-w-0 items-center gap-1">
        <span className="truncate text-base font-semibold text-foreground">{clientName}</span>
        {row.is_verified === true ? (
          <BadgeCheck
            className="h-4 w-4 shrink-0 fill-emerald-500 text-white"
            strokeWidth={2.25}
            aria-label="Verified"
          />
        ) : null}
      </span>
    </>
  );

  if (row.client_id) {
    return (
      <Link
        to={`/profile/${row.client_id}`}
        className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-lg py-0.5 pr-2 transition-colors hover:bg-muted/50"
        onClick={(e) => e.stopPropagation()}
      >
        {inner}
      </Link>
    );
  }

  return <div className="inline-flex min-w-0 max-w-full items-center gap-2">{inner}</div>;
}

function WhenBadge({
  whenTimeframe,
  className,
}: {
  whenTimeframe: string | null | undefined;
  className?: string;
}) {
  const whenBadge = openHelpRequestWhenBadgeLabel(whenTimeframe);
  if (!whenBadge) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border-0 px-2 py-0.5 text-xs font-black uppercase tracking-[0.1em]",
        whenBadgeToneClass(whenTimeframe),
        className,
      )}
    >
      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {whenBadge}
    </span>
  );
}

type Props = {
  row: DiscoverOpenHelpRequestRow;
  onAccept: () => void;
  /** Opens the request on the global community feed (deep link). */
  onOpen?: () => void;
  accepted?: boolean;
  accepting?: boolean;
  saved?: boolean;
  saveBusy?: boolean;
  onToggleSave?: () => void;
  onDismiss?: () => void;
  className?: string;
  layout?: "default" | "carousel";
};

const acceptRequestBtnClass = cn(
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2",
  "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20",
  "hover:bg-emerald-600 active:bg-emerald-700 active:scale-[0.99]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "disabled:pointer-events-none disabled:opacity-60",
  "text-xs font-black uppercase tracking-[0.14em] sm:w-full sm:px-4 sm:py-2",
);

const acceptRequestBtnCarouselClass = cn(
  "inline-flex h-10 min-w-[9.5rem] shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5",
  "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20",
  "hover:bg-emerald-600 active:bg-emerald-700 active:scale-[0.99]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "disabled:pointer-events-none disabled:opacity-60",
  "text-[11px] font-black uppercase tracking-[0.12em]",
);

const acceptRequestPendingCarouselClass = cn(
  "inline-flex h-10 min-w-[9.5rem] shrink-0 items-center justify-center rounded-2xl px-3",
  "bg-zinc-100 text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500",
  "dark:bg-zinc-700/80 dark:text-zinc-400",
);

const dismissOpenHelpRequestBtnClass = cn(
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
  "border border-zinc-200/80 bg-white text-muted-foreground transition-colors",
  "hover:bg-zinc-100 hover:text-foreground active:scale-[0.98]",
  "dark:border-white/10 dark:bg-zinc-800 dark:hover:bg-zinc-700",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

const saveOpenHelpRequestBtnClass = cn(
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted/60 sm:h-11 sm:w-11",
);

const saveOpenHelpRequestIconClass = "h-5 w-5 sm:h-[1.35rem] sm:w-[1.35rem]";

export function DiscoverOpenHelpRequestCard({
  row,
  onAccept,
  onOpen,
  accepted = false,
  accepting = false,
  saved = false,
  saveBusy = false,
  onToggleSave,
  onDismiss,
  className,
  layout = "default",
}: Props) {
  const { t } = useTranslation();
  const title = openHelpRequestTitle(row);
  const description = openHelpRequestDescription(row);
  const detailLine = openHelpRequestDetailLine(row);
  const scheduleLine = openHelpRequestScheduleLine(row);
  const budget = formatOpenHelpRequestBudget(row);
  const categoryLabel = serviceCategoryTitle(row.service_type).toUpperCase();
  const postedLabel = timeAgo(row.created_at);
  const clientName = (row.client_display_name || "").trim() || "Member";

  const shellClass = cn(
    layout === "carousel" ? discoverRequestCardCarouselShellClass : "flex flex-col",
    "rounded-[18px]",
    layout === "carousel" ? "p-3.5" : "p-3",
    DISCOVER_OPEN_HELP_REQUEST_CARD_SURFACE,
    onOpen &&
      cn(
        "cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        DISCOVER_OPEN_HELP_REQUEST_CARD_HOVER,
      ),
    className,
  );

  const articleProps = {
    role: onOpen ? ("button" as const) : undefined,
    tabIndex: onOpen ? 0 : undefined,
    onClick: onOpen ? () => onOpen() : undefined,
    onKeyDown: onOpen
      ? (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }
      : undefined,
    className: shellClass,
  };

  if (layout === "carousel") {
    return (
      <article {...articleProps}>
        <div className="flex w-full items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                categoryIconCircleClass(row.service_type),
              )}
            >
              <CategoryIcon serviceType={row.service_type} className="h-4 w-4" />
            </div>
            <span
              className={cn(
                "truncate text-sm font-black uppercase tracking-[0.12em]",
                categoryAccentClass(row.service_type),
              )}
            >
              {categoryLabel}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <WhenBadge whenTimeframe={row.when_timeframe} />
            <button
              type="button"
              className={cn(
                saveOpenHelpRequestBtnClass,
                saved ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
              )}
              aria-label={saved ? "Remove from saved requests" : "Save request"}
              disabled={saveBusy || !onToggleSave}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSave?.();
              }}
            >
              {saveBusy ? (
                <Loader2 className={cn(saveOpenHelpRequestIconClass, "animate-spin")} aria-hidden />
              ) : (
                <Bookmark
                  className={cn(saveOpenHelpRequestIconClass, saved && "fill-current")}
                  strokeWidth={2.25}
                />
              )}
            </button>
          </div>
        </div>

        <div className={discoverRequestCardCarouselBodyClass}>
          <div className="mt-2.5 w-full text-left">
            <h3 className={discoverRequestCardCarouselTitleClass}>{title}</h3>
            <p className={discoverRequestCardCarouselDescriptionClass}>
              {description || "\u00A0"}
            </p>
          </div>

          <div className={discoverRequestCardCarouselMetaRowClass}>
            {detailLine ? (
              <span className="inline-flex items-center gap-1.5">
                {row.service_type === "cleaning" ? (
                  <Home className="h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <Users className="h-4 w-4 shrink-0" aria-hidden />
                )}
                {detailLine}
              </span>
            ) : null}
            {scheduleLine ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 shrink-0" aria-hidden />
                {scheduleLine}
              </span>
            ) : null}
          </div>

          <div className={discoverRequestCardCarouselPosterRowClass}>
            <ClientPoster row={row} clientName={clientName} />
            {postedLabel ? (
              <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                {postedLabel}
              </span>
            ) : null}
          </div>
        </div>

        <div className={discoverRequestCardCarouselFooterClass}>
          <div className={discoverRequestCardCarouselFooterBudgetClass}>
            {budget ? (
              <>
                <p className="text-xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                  {budget}
                </p>
                <p className="text-xs font-semibold text-muted-foreground">
                  {row.budget_rate_type === "fixed" ? "Fixed budget" : "Total budget"}
                </p>
              </>
            ) : null}
          </div>
          <div className={discoverRequestCardCarouselFooterActionClass}>
            <div className="flex items-center gap-1.5">
              {onDismiss ? (
                <button
                  type="button"
                  className={dismissOpenHelpRequestBtnClass}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss();
                  }}
                  aria-label="Remove from open requests"
                >
                  <X className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                </button>
              ) : null}
              {accepted ? (
                <div className={acceptRequestPendingCarouselClass}>Accepted · Pending</div>
              ) : (
                <button
                  type="button"
                  className={acceptRequestBtnCarouselClass}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAccept();
                  }}
                  disabled={accepting}
                  aria-label="Accept request"
                >
                  {accepting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
                  )}
                  {t("discover.acceptRequest")}
                </button>
              )}
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article {...articleProps}>
      <div className="flex gap-2.5">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
            categoryIconCircleClass(row.service_type),
          )}
        >
          <CategoryIcon serviceType={row.service_type} className="h-5 w-5" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:gap-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-1.5">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "text-sm font-black uppercase tracking-[0.12em] sm:text-base",
                    categoryAccentClass(row.service_type),
                  )}
                >
                  {categoryLabel}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <WhenBadge whenTimeframe={row.when_timeframe} />
                <button
                  type="button"
                  className={cn(
                    saveOpenHelpRequestBtnClass,
                    saved ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                  )}
                  aria-label={saved ? "Remove from saved requests" : "Save request"}
                  disabled={saveBusy || !onToggleSave}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSave?.();
                  }}
                >
                  {saveBusy ? (
                    <Loader2 className={cn(saveOpenHelpRequestIconClass, "animate-spin")} aria-hidden />
                  ) : (
                    <Bookmark
                      className={cn(saveOpenHelpRequestIconClass, saved && "fill-current")}
                      strokeWidth={2.25}
                    />
                  )}
                </button>
              </div>
            </div>

            <div className="mt-1">
              <h3 className="text-lg font-bold leading-snug text-foreground sm:text-xl">
                {title}
              </h3>
              {description ? (
                <p className="mt-1 line-clamp-2 text-[15px] leading-snug text-muted-foreground sm:text-base">
                  {description}
                </p>
              ) : null}
            </div>

            {(detailLine || scheduleLine) ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted-foreground sm:text-[15px]">
              {detailLine ? (
                <span className="inline-flex items-center gap-1.5">
                  {row.service_type === "cleaning" ? (
                    <Home className="h-4 w-4 shrink-0" aria-hidden />
                  ) : (
                    <Users className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  {detailLine}
                </span>
              ) : null}
              {scheduleLine ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4 shrink-0" aria-hidden />
                  {scheduleLine}
                </span>
              ) : null}
            </div>
            ) : null}

            <div className="mt-auto flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 pt-2">
              <ClientPoster row={row} clientName={clientName} />
              {postedLabel ? (
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                  {postedLabel}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-end justify-between gap-2 pt-2 sm:w-[8rem] sm:shrink-0 sm:flex-col sm:items-end sm:justify-between sm:pt-0 md:pl-3">
          <div className="text-right">
            {budget ? (
              <>
                <p className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                  {budget}
                </p>
                <p className="text-xs font-semibold text-muted-foreground">
                  {row.budget_rate_type === "fixed" ? "Fixed budget" : "Total budget"}
                </p>
              </>
            ) : null}
          </div>

          {accepted ? (
            <div className="flex items-center gap-1.5 sm:w-full sm:flex-col sm:items-stretch">
              {onDismiss ? (
                <button
                  type="button"
                  className={cn(dismissOpenHelpRequestBtnClass, "sm:w-full")}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss();
                  }}
                  aria-label="Remove from open requests"
                >
                  <X className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                </button>
              ) : null}
              <div className="rounded-2xl bg-zinc-100 px-3 py-2 text-center text-xs font-black uppercase tracking-[0.14em] text-zinc-500 dark:bg-zinc-700/80 dark:text-zinc-400 sm:w-full">
                Accepted · Pending
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:w-full sm:flex-col sm:items-stretch">
              {onDismiss ? (
                <button
                  type="button"
                  className={cn(dismissOpenHelpRequestBtnClass, "sm:w-full")}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss();
                  }}
                  aria-label="Remove from open requests"
                >
                  <X className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                </button>
              ) : null}
              <button
                type="button"
                className={acceptRequestBtnClass}
                onClick={(e) => {
                  e.stopPropagation();
                  onAccept();
                }}
                disabled={accepting}
                aria-label="Accept request"
              >
                {accepting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
                )}
                {t("discover.acceptRequest")}
              </button>
            </div>
          )}
          </div>
        </div>
      </div>
    </article>
  );
}

const viewRequestBtnClass = cn(
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2",
  "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20",
  "hover:bg-emerald-600 active:bg-emerald-700 active:scale-[0.99]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "text-xs font-black uppercase tracking-[0.14em] sm:w-full sm:px-4 sm:py-2",
);

const viewRequestBtnCarouselClass = cn(
  "inline-flex h-10 min-w-[9.5rem] shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5",
  "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20",
  "hover:bg-emerald-600 active:bg-emerald-700 active:scale-[0.99]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "text-[11px] font-black uppercase tracking-[0.12em]",
);

export function DiscoverMyOpenRequestCard({
  row,
  acceptedCount = 0,
  acceptedHelpers = [],
  onOpen,
  className,
  layout = "default",
}: {
  row: DiscoverOpenHelpRequestRow;
  acceptedCount?: number;
  acceptedHelpers?: AcceptedHelperProfile[];
  onOpen: () => void;
  className?: string;
  layout?: "default" | "carousel";
}) {
  const { t } = useTranslation();
  const title = openHelpRequestTitle(row);
  const description = openHelpRequestDescription(row);
  const detailLine = openHelpRequestDetailLine(row);
  const scheduleLine = openHelpRequestScheduleLine(row);
  const budget = formatOpenHelpRequestBudget(row);
  const categoryLabel = serviceCategoryTitle(row.service_type).toUpperCase();
  const postedLabel = timeAgo(row.created_at);
  const uploadedImageUrls = useMemo(
    () => jobAttachmentImageUrls({ service_details: row.service_details ?? undefined }),
    [row.service_details],
  );
  const uploadedImageUrl = uploadedImageUrls[0] ?? null;
  const [imageLightboxOpen, setImageLightboxOpen] = useState(false);

  const imageLightbox =
    uploadedImageUrls.length > 0 ? (
      <ImageLightboxModal
        images={uploadedImageUrls}
        initialIndex={0}
        isOpen={imageLightboxOpen}
        onClose={() => setImageLightboxOpen(false)}
      />
    ) : null;

  const shellClass = cn(
    layout === "carousel" ? discoverRequestCardCarouselShellClass : "flex flex-col",
    "rounded-[18px]",
    layout === "carousel" ? "p-3.5" : "p-3",
    DISCOVER_OPEN_HELP_REQUEST_CARD_SURFACE,
    "cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    DISCOVER_OPEN_HELP_REQUEST_CARD_HOVER,
    className,
  );

  const articleProps = {
    role: "button" as const,
    tabIndex: 0,
    onClick: onOpen,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen();
      }
    },
    className: shellClass,
  };

  if (layout === "carousel") {
    return (
      <>
      <article {...articleProps}>
        <div className="flex w-full items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                categoryIconCircleClass(row.service_type),
              )}
            >
              <CategoryIcon serviceType={row.service_type} className="h-4 w-4" />
            </div>
            <span
              className={cn(
                "truncate text-sm font-black uppercase tracking-[0.12em]",
                categoryAccentClass(row.service_type),
              )}
            >
              {categoryLabel}
            </span>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <MyRequestAcceptedCountBadge
              acceptedCount={acceptedCount}
              acceptedHelpers={acceptedHelpers}
              size="carousel"
            />
            <WhenBadge whenTimeframe={row.when_timeframe} className="shrink-0" />
          </div>
        </div>

        <div className={discoverRequestCardCarouselBodyClass}>
          <div className="mt-2.5 flex w-full items-start gap-3">
            {uploadedImageUrl ? (
              <MyRequestUploadedImageButton
                imageUrl={uploadedImageUrl}
                onOpen={() => setImageLightboxOpen(true)}
              />
            ) : null}
            <div className="min-w-0 flex-1 text-left">
              <h3 className={discoverRequestCardCarouselTitleClass}>{title}</h3>
              <p className={discoverRequestCardCarouselDescriptionClass}>
                {description || "\u00A0"}
              </p>
            </div>
          </div>

          <div className={discoverMyRequestMetaRowClass}>
            {row.location_city ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className={discoverMyRequestMetaIconClass} aria-hidden />
                {row.location_city}
              </span>
            ) : null}
            {detailLine ? (
              <span className="inline-flex items-center gap-1.5">
                {row.service_type === "cleaning" ? (
                  <Home className={discoverMyRequestMetaIconClass} aria-hidden />
                ) : (
                  <Users className={discoverMyRequestMetaIconClass} aria-hidden />
                )}
                {detailLine}
              </span>
            ) : null}
            {scheduleLine ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className={discoverMyRequestMetaIconClass} aria-hidden />
                {scheduleLine}
              </span>
            ) : null}
          </div>

          <div className={discoverRequestCardCarouselPosterRowClass} aria-hidden />
        </div>

        <div className={discoverRequestCardCarouselFooterClass}>
          <div className={cn(discoverRequestCardCarouselFooterBudgetClass, "justify-end gap-0.5")}>
            {budget ? (
              <>
                <p className="text-xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                  {budget}
                </p>
                <p className="text-xs font-semibold text-muted-foreground">
                  {row.budget_rate_type === "fixed" ? "Fixed budget" : "Total budget"}
                </p>
              </>
            ) : null}
            {postedLabel ? (
              <span className={myRequestPostedBadgeClass}>{postedLabel}</span>
            ) : null}
          </div>
          <div className={discoverRequestCardCarouselFooterActionClass}>
            <button
              type="button"
              className={viewRequestBtnCarouselClass}
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              aria-label="View your request"
            >
              <ChevronRight className="h-4 w-4 rtl-flip-icon" strokeWidth={3} aria-hidden />
              {t("discover.viewRequest")}
            </button>
          </div>
        </div>
      </article>
      {imageLightbox}
      </>
    );
  }

  const hasWhenBadge = Boolean(openHelpRequestWhenBadgeLabel(row.when_timeframe));

  return (
    <>
    <article {...articleProps}>
      <div className="flex gap-2.5">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
            categoryIconCircleClass(row.service_type),
          )}
        >
          <CategoryIcon serviceType={row.service_type} className="h-5 w-5" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:gap-3">
          <div
            className={cn(
              "relative flex min-w-0 flex-1 flex-col",
              uploadedImageUrl
                ? hasWhenBadge
                  ? "pr-[5.5rem] sm:pr-36"
                  : "pr-[4.75rem] sm:pr-24"
                : hasWhenBadge
                  ? "pr-24 sm:pr-28"
                  : "pr-11",
            )}
          >
            <div className="pointer-events-none absolute right-0 top-0 z-[1] flex flex-col items-end gap-1.5">
              <div className="pointer-events-auto flex items-center gap-1.5">
                <WhenBadge whenTimeframe={row.when_timeframe} />
                <MyRequestAcceptedCountBadge
                  acceptedCount={acceptedCount}
                  acceptedHelpers={acceptedHelpers}
                  size="default"
                />
              </div>
              {uploadedImageUrl ? (
                <MyRequestUploadedImageButton
                  imageUrl={uploadedImageUrl}
                  onOpen={() => setImageLightboxOpen(true)}
                />
              ) : null}
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "text-sm font-black uppercase tracking-[0.12em] sm:text-base",
                  categoryAccentClass(row.service_type),
                )}
              >
                {categoryLabel}
              </span>
            </div>

            <div className="mt-1">
              <h3 className="text-lg font-bold leading-snug text-foreground sm:text-xl">
                {title}
              </h3>
              {description ? (
                <p className="mt-1 line-clamp-2 text-[15px] leading-snug text-muted-foreground sm:text-base">
                  {description}
                </p>
              ) : null}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[15px] text-muted-foreground sm:text-base">
              {row.location_city ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className={discoverMyRequestMetaIconClass} aria-hidden />
                  {row.location_city}
                </span>
              ) : null}
              {detailLine ? (
                <span className="inline-flex items-center gap-1.5">
                  {row.service_type === "cleaning" ? (
                    <Home className={discoverMyRequestMetaIconClass} aria-hidden />
                  ) : (
                    <Users className={discoverMyRequestMetaIconClass} aria-hidden />
                  )}
                  {detailLine}
                </span>
              ) : null}
              {scheduleLine ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className={discoverMyRequestMetaIconClass} aria-hidden />
                  {scheduleLine}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-end justify-between gap-2 pt-2 sm:w-[8rem] sm:shrink-0 sm:flex-col sm:items-end sm:justify-between sm:pt-0 md:pl-3">
            <div className="text-right">
              {budget ? (
                <>
                  <p className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                    {budget}
                  </p>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {row.budget_rate_type === "fixed" ? "Fixed budget" : "Total budget"}
                  </p>
                </>
              ) : null}
            </div>

            <button
              type="button"
              className={viewRequestBtnClass}
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              aria-label="View your request"
            >
              <ChevronRight className="h-4 w-4 rtl-flip-icon" strokeWidth={3} aria-hidden />
              {t("discover.viewRequest")}
            </button>
          </div>
        </div>
      </div>
      {postedLabel ? (
        <span className={cn("mt-2.5", myRequestPostedBadgeClass)}>{postedLabel}</span>
      ) : null}
    </article>
    {imageLightbox}
    </>
  );
}

export function DiscoverMyLiveHelpCard({
  row,
  otherPartyName,
  otherPartyLabel = "Helper",
  onOpen,
  className,
  layout = "default",
}: {
  row: Pick<
    DiscoverOpenHelpRequestRow,
    | "service_type"
    | "location_city"
    | "created_at"
    | "notes"
    | "ai_generated_copy"
    | "when_timeframe"
    | "budget_min"
    | "budget_max"
    | "budget_rate_type"
    | "service_details"
  >;
  otherPartyName: string;
  otherPartyLabel?: string;
  onOpen: () => void;
  className?: string;
  layout?: "default" | "carousel";
}) {
  const { t } = useTranslation();
  const title = openHelpRequestTitle(row);
  const description = openHelpRequestDescription(row);
  const budget = formatOpenHelpRequestBudget(row);
  const categoryLabel = serviceCategoryTitle(row.service_type).toUpperCase();
  const postedLabel = timeAgo(row.created_at);
  const uploadedImageUrls = useMemo(
    () => jobAttachmentImageUrls({ service_details: row.service_details ?? undefined }),
    [row.service_details],
  );
  const uploadedImageUrl = uploadedImageUrls[0] ?? null;
  const [imageLightboxOpen, setImageLightboxOpen] = useState(false);

  const imageLightbox =
    uploadedImageUrls.length > 0 ? (
      <ImageLightboxModal
        images={uploadedImageUrls}
        initialIndex={0}
        isOpen={imageLightboxOpen}
        onClose={() => setImageLightboxOpen(false)}
      />
    ) : null;

  const liveBadge = (
    <span
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300"
      aria-label={t("discover.liveHelp")}
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
        <span className="absolute inset-0 rounded-full bg-emerald-500/70 motion-safe:animate-ping motion-reduce:hidden" />
        <span className="relative h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
      </span>
      Live
    </span>
  );

  const shellClass = cn(
    layout === "carousel" ? discoverRequestCardCarouselShellClass : "flex flex-col",
    "rounded-[18px]",
    layout === "carousel" ? "p-3.5" : "p-3",
    DISCOVER_OPEN_HELP_REQUEST_CARD_SURFACE,
    "cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    DISCOVER_OPEN_HELP_REQUEST_CARD_HOVER,
    className,
  );

  const articleProps = {
    role: "button" as const,
    tabIndex: 0,
    onClick: onOpen,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen();
      }
    },
    className: shellClass,
  };

  if (layout === "carousel") {
    return (
      <>
      <article {...articleProps}>
        <div className="flex w-full items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                categoryIconCircleClass(row.service_type),
              )}
            >
              <CategoryIcon serviceType={row.service_type} className="h-4 w-4" />
            </div>
            <span
              className={cn(
                "truncate text-sm font-black uppercase tracking-[0.12em]",
                categoryAccentClass(row.service_type),
              )}
            >
              {categoryLabel}
            </span>
          </div>
          {liveBadge}
        </div>

        <div className={discoverRequestCardCarouselBodyClass}>
          <div className="mt-2.5 flex w-full items-start gap-3">
            {uploadedImageUrl ? (
              <MyRequestUploadedImageButton
                imageUrl={uploadedImageUrl}
                onOpen={() => setImageLightboxOpen(true)}
              />
            ) : null}
            <div className="min-w-0 flex-1 text-left">
              <h3 className={discoverRequestCardCarouselTitleClass}>{title}</h3>
              <p className={discoverRequestCardCarouselDescriptionClass}>
                {description || "\u00A0"}
              </p>
            </div>
          </div>

          <div className={discoverRequestCardCarouselMetaRowClass}>
            {row.location_city ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                {row.location_city}
              </span>
            ) : null}
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Users className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{otherPartyLabel}</span>{" "}
                {otherPartyName}
              </span>
            </span>
          </div>

          <div className={discoverRequestCardCarouselPosterRowClass} aria-hidden />
        </div>

        <div className={discoverRequestCardCarouselFooterClass}>
          <div className={cn(discoverRequestCardCarouselFooterBudgetClass, "justify-end gap-0.5")}>
            {budget ? (
              <>
                <p className="text-xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                  {budget}
                </p>
                <p className="text-xs font-semibold text-muted-foreground">
                  {row.budget_rate_type === "fixed" ? "Fixed budget" : "Total budget"}
                </p>
              </>
            ) : null}
            {postedLabel ? (
              <span className={myRequestPostedBadgeClass}>{postedLabel}</span>
            ) : null}
          </div>
          <div className={discoverRequestCardCarouselFooterActionClass}>
            <button
              type="button"
              className={viewRequestBtnCarouselClass}
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              aria-label={t("discover.viewLive")}
            >
              <ChevronRight className="h-4 w-4 rtl-flip-icon" strokeWidth={3} aria-hidden />
              {t("discover.viewLive")}
            </button>
          </div>
        </div>
      </article>
      {imageLightbox}
      </>
    );
  }

  return (
    <>
    <article {...articleProps}>
      <div className="flex gap-2.5">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
            categoryIconCircleClass(row.service_type),
          )}
        >
          <CategoryIcon serviceType={row.service_type} className="h-5 w-5" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:gap-3">
          <div
            className={cn(
              "relative flex min-w-0 flex-1 flex-col",
              uploadedImageUrl ? "pe-[4.75rem] sm:pe-24" : "pe-16 sm:pe-[4.5rem]",
            )}
          >
            <div className="pointer-events-none absolute end-0 top-0 z-[1] flex flex-col items-end gap-1.5">
              <span
                className="pointer-events-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300 sm:h-10"
                aria-label={t("discover.liveHelp")}
              >
                <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                  <span className="absolute inset-0 rounded-full bg-emerald-500/70 motion-safe:animate-ping motion-reduce:hidden" />
                  <span className="relative h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                </span>
                Live
              </span>
              {uploadedImageUrl ? (
                <MyRequestUploadedImageButton
                  imageUrl={uploadedImageUrl}
                  onOpen={() => setImageLightboxOpen(true)}
                />
              ) : null}
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "text-sm font-black uppercase tracking-[0.12em] sm:text-base",
                  categoryAccentClass(row.service_type),
                )}
              >
                {categoryLabel}
              </span>
            </div>

            <div className="mt-1">
              <h3 className="text-lg font-bold leading-snug text-foreground sm:text-xl">
                {title}
              </h3>
              {description ? (
                <p className="mt-1 line-clamp-2 text-[15px] leading-snug text-muted-foreground sm:text-base">
                  {description}
                </p>
              ) : null}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted-foreground sm:text-[15px]">
              {row.location_city ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                  {row.location_city}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4 shrink-0" aria-hidden />
                <span>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{otherPartyLabel}</span>{" "}
                  {otherPartyName}
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-end justify-between gap-2 pt-2 sm:w-[8rem] sm:shrink-0 sm:flex-col sm:items-end sm:justify-between sm:pt-0 md:pl-3">
            <div className="text-right">
              {budget ? (
                <>
                  <p className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                    {budget}
                  </p>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {row.budget_rate_type === "fixed" ? "Fixed budget" : "Total budget"}
                  </p>
                </>
              ) : null}
            </div>

            <button
              type="button"
              className={viewRequestBtnClass}
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              aria-label={t("discover.viewLive")}
            >
              <ChevronRight className="h-4 w-4 rtl-flip-icon" strokeWidth={3} aria-hidden />
              {t("discover.viewLive")}
            </button>
          </div>
        </div>
      </div>
      {postedLabel ? (
        <span className={cn("mt-2.5", myRequestPostedBadgeClass)}>{postedLabel}</span>
      ) : null}
    </article>
    {imageLightbox}
    </>
  );
}

export function DiscoverOpenHelpRequestsSeeMoreButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-transparent bg-zinc-50 text-sm font-bold text-foreground transition-colors hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800",
        className,
      )}
    >
      {t("discover.seeMoreRequests")}
      <ChevronRight className="h-4 w-4 rtl-flip-icon" aria-hidden />
    </button>
  );
}
