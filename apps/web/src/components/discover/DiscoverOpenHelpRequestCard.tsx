import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Baby,
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
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { avatarUrl } from "@/lib/imageTransform";
import { supabase } from "@/lib/supabase";
import type { DiscoverOpenHelpRequestRow } from "@/hooks/data/useDiscoverOpenHelpRequests";
import {
  categoryAccentClass,
  categoryIconCircleClass,
  formatOpenHelpRequestBudget,
  isUrgentWhen,
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

function firstJobRequestImage(
  serviceDetails: Record<string, unknown> | null | undefined,
): string | null {
  const imgs = serviceDetails?.images;
  if (!Array.isArray(imgs)) return null;
  const found = imgs.find(
    (u): u is string => typeof u === "string" && u.trim().length > 0,
  );
  return found ?? null;
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
      <span className="relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border/60 bg-muted">
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
      <span className="truncate text-base font-semibold text-foreground">{clientName}</span>
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
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-black uppercase tracking-[0.1em]",
        whenBadgeToneClass(whenTimeframe),
        isUrgentWhen(whenTimeframe) && "ring-1 ring-red-500/25",
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
  className?: string;
};

const acceptRequestBtnClass = cn(
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2",
  "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20",
  "hover:bg-emerald-600 active:bg-emerald-700 active:scale-[0.99]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "disabled:pointer-events-none disabled:opacity-60",
  "text-xs font-black uppercase tracking-[0.14em] sm:w-full sm:px-4 sm:py-2",
);

export function DiscoverOpenHelpRequestCard({
  row,
  onAccept,
  onOpen,
  accepted = false,
  accepting = false,
  saved = false,
  saveBusy = false,
  onToggleSave,
  className,
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

  return (
    <article
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen ? () => onOpen() : undefined}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
      className={cn(
        "flex flex-col rounded-[18px] border border-transparent bg-zinc-50 p-3 shadow-none",
        "dark:bg-zinc-900/95",
        onOpen &&
          "cursor-pointer transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
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
                    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted/60 sm:h-10 sm:w-10",
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
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  ) : (
                    <Bookmark
                      className={cn("h-5 w-5 sm:h-[1.35rem] sm:w-[1.35rem]", saved && "fill-current")}
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

            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted-foreground sm:text-[15px]">
              {row.location_city ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                  {row.location_city}
                </span>
              ) : null}
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

            <div className="mt-auto pt-2">
              <ClientPoster row={row} clientName={clientName} />
            </div>
          </div>

          <div className="flex items-end justify-between gap-2 border-t border-border/40 pt-2 sm:w-[8rem] sm:shrink-0 sm:flex-col sm:items-end sm:justify-between sm:border-t-0 sm:pt-0 md:border-l md:border-border/40 md:pl-3">
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
            {postedLabel ? (
              <span className="mt-1 inline-flex rounded-lg bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {postedLabel}
              </span>
            ) : null}
          </div>

          {accepted ? (
            <div className="rounded-2xl bg-zinc-100 px-3 py-2 text-center text-xs font-black uppercase tracking-[0.14em] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 sm:w-full">
              Accepted · Pending
            </div>
          ) : (
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

export function DiscoverMyOpenRequestCard({
  row,
  acceptedCount = 0,
  onOpen,
  className,
}: {
  row: DiscoverOpenHelpRequestRow;
  acceptedCount?: number;
  onOpen: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const title = openHelpRequestTitle(row);
  const description = openHelpRequestDescription(row);
  const detailLine = openHelpRequestDetailLine(row);
  const scheduleLine = openHelpRequestScheduleLine(row);
  const budget = formatOpenHelpRequestBudget(row);
  const categoryLabel = serviceCategoryTitle(row.service_type).toUpperCase();
  const postedLabel = timeAgo(row.created_at);
  const uploadedImageUrl = firstJobRequestImage(row.service_details ?? null);
  const hasWhenBadge = Boolean(openHelpRequestWhenBadgeLabel(row.when_timeframe));

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "flex flex-col rounded-[18px] border border-transparent bg-zinc-50 p-3 shadow-none",
        "dark:bg-zinc-900/95",
        "cursor-pointer transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
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
                  ? "pr-28 sm:pr-32"
                  : "pr-14 sm:pr-16"
                : hasWhenBadge
                  ? "pr-24 sm:pr-28"
                  : "pr-11",
            )}
          >
            <div className="pointer-events-none absolute right-0 top-0 z-[1] flex flex-col items-end gap-1.5">
              <div className="pointer-events-auto flex items-center gap-1.5">
                <WhenBadge whenTimeframe={row.when_timeframe} />
                <span
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-black tabular-nums sm:h-10",
                    acceptedCount > 0
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-zinc-200/80 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
                  )}
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
              {uploadedImageUrl ? (
                <img
                  src={uploadedImageUrl}
                  alt=""
                  className="h-11 w-11 rounded-xl object-cover ring-1 ring-black/5 dark:ring-white/10 sm:h-12 sm:w-12"
                  loading="lazy"
                  decoding="async"
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
          </div>

          <div className="flex items-end justify-between gap-2 border-t border-border/40 pt-2 sm:w-[8rem] sm:shrink-0 sm:flex-col sm:items-end sm:justify-between sm:border-t-0 sm:pt-0 md:border-l md:border-border/40 md:pl-3">
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
              {postedLabel ? (
                <span className="mt-1 inline-flex rounded-lg bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {postedLabel}
                </span>
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
    </article>
  );
}

export function DiscoverMyLiveHelpCard({
  row,
  otherPartyName,
  otherPartyLabel = "Helper",
  onOpen,
  className,
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
  >;
  otherPartyName: string;
  otherPartyLabel?: string;
  onOpen: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const title = openHelpRequestTitle(row);
  const description = openHelpRequestDescription(row);
  const budget = formatOpenHelpRequestBudget(row);
  const categoryLabel = serviceCategoryTitle(row.service_type).toUpperCase();
  const postedLabel = timeAgo(row.created_at);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "flex flex-col rounded-[18px] border border-transparent bg-zinc-50 p-3 shadow-none",
        "dark:bg-zinc-900/95",
        "cursor-pointer transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
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
          <div className="relative flex min-w-0 flex-1 flex-col pe-16 sm:pe-[4.5rem]">
            <div className="pointer-events-none absolute end-0 top-0 z-[1]">
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

          <div className="flex items-end justify-between gap-2 border-t border-border/40 pt-2 sm:w-[8rem] sm:shrink-0 sm:flex-col sm:items-end sm:justify-between sm:border-t-0 sm:pt-0 md:border-l md:border-border/40 md:pl-3">
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
              {postedLabel ? (
                <span className="mt-1 inline-flex rounded-lg bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {postedLabel}
                </span>
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
    </article>
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
