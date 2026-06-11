import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { CalendarDays, Clock, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { fetchAcceptedRequestCount } from "@/lib/fetchAcceptedJobRequestsForFeed";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MobileSnapBottomSheet } from "@/components/ui/MobileSnapBottomSheet";
import { SimpleCalendar } from "@/components/SimpleCalendar";
import {
  discoverMobileSheetBottomOffset,
  useIsMobileViewport,
} from "@/lib/discoverSheetDialog";
import { cn, noFieldSpinnerClass } from "@/lib/utils";
import {
  COMMUNITY_FEED_WHEN_OPTIONS,
  DEFAULT_COMMUNITY_FEED_ADVANCED_FILTERS,
  countActiveFeedModalFilters,
  type CommunityFeedAdvancedFilters,
  type CommunityFeedWhenFilter,
} from "@/lib/communityFeedFilters";

const WHEN_OPTION_LABEL_KEYS: Record<CommunityFeedWhenFilter, string> = {
  any: "feed.filters.whenAny",
  now: "feed.filters.whenNow",
  today: "feed.filters.whenToday",
  tomorrow: "feed.filters.whenTomorrow",
  this_week: "feed.filters.whenThisWeek",
  custom: "feed.filters.whenCustom",
};

type CommunityFeedFilterDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: CommunityFeedAdvancedFilters;
  onApply: (filters: CommunityFeedAdvancedFilters) => void;
  viewerUserId?: string | null;
  commentedFilterActive?: boolean;
  onCommentedFilterChange?: (active: boolean) => void;
  acceptedFilterActive?: boolean;
  onAcceptedFilterChange?: (active: boolean) => void;
  onAuthorFilterChange?: (authorId: string | null) => void;
};

async function fetchCommentedOwnPostCount(viewerUserId: string): Promise<number> {
  const { data: ownPosts, error: ownErr } = await supabase
    .from("profile_posts")
    .select("id")
    .eq("author_id", viewerUserId);
  if (ownErr) throw ownErr;

  const ownIds = (ownPosts ?? []).map((p) => p.id as string);
  if (ownIds.length === 0) return 0;

  const { data: commentRows, error } = await supabase
    .from("profile_post_comments")
    .select("post_id")
    .in("post_id", ownIds);
  if (error) throw error;
  return new Set((commentRows ?? []).map((r) => r.post_id as string)).size;
}

type FilterDialogDraft = {
  advanced: CommunityFeedAdvancedFilters;
  commentedOnly: boolean;
  acceptedOnly: boolean;
};

export function CommunityFeedFilterButton({
  filters,
  onClick,
  commentedFilterActive = false,
  acceptedFilterActive = false,
  className,
}: {
  filters: CommunityFeedAdvancedFilters;
  onClick: () => void;
  commentedFilterActive?: boolean;
  acceptedFilterActive?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const activeCount = countActiveFeedModalFilters(filters, {
    commented: commentedFilterActive,
    accepted: acceptedFilterActive,
  });

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative inline-flex shrink-0 items-center gap-2 rounded-full border-0 px-4 py-2 text-xs font-black uppercase tracking-wide transition-all sm:text-[13px]",
        activeCount > 0
          ? "bg-orange-600 text-white shadow-md shadow-orange-900/15"
          : "bg-background text-foreground hover:bg-muted/50",
        className,
      )}
      aria-label={t("feed.filters.filterPosts")}
    >
      <SlidersHorizontal className="h-[18px] w-[18px] shrink-0" strokeWidth={2.25} />
      {t("feed.filters.filter")}
      {activeCount > 0 ? (
        <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white/20 px-1.5 text-[10px] font-black tabular-nums">
          {activeCount}
        </span>
      ) : null}
    </button>
  );
}

function FilterCheckboxRow({
  checked,
  onChange,
  label,
  count,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
        checked
          ? "border-orange-500/50 bg-orange-500/10"
          : "border-border/60 bg-background hover:bg-muted/40",
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
          checked
            ? "border-orange-600 bg-orange-600 text-white"
            : "border-input bg-background",
        )}
        aria-hidden
      >
        {checked ? (
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
            <path
              d="M2.5 6.2 4.8 8.5 9.5 3.8"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">{label}</span>
      {typeof count === "number" && count > 0 ? (
        <span
          className={cn(
            "inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-black tabular-nums",
            checked
              ? "bg-orange-600/15 text-orange-700 dark:text-orange-300"
              : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function parseStoredFilterDate(value: string | null): Date | null {
  if (!value) return null;
  try {
    const parsed = parseISO(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

function CustomWhenRangeField({
  label,
  dateValue,
  timeValue,
  onDateChange,
  onTimeChange,
}: {
  label: string;
  dateValue: string | null;
  timeValue: string | null;
  onDateChange: (value: string | null) => void;
  onTimeChange: (value: string | null) => void;
}) {
  const { t } = useTranslation();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const selectedDate = parseStoredFilterDate(dateValue);

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
        <Dialog open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="flex h-11 w-full items-center gap-2 rounded-xl border border-input bg-background px-3.5 text-left text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted/40 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20"
            >
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className={cn(!selectedDate && "text-muted-foreground")}>
                {selectedDate
                  ? format(selectedDate, "EEEE, MMMM d, yyyy")
                  : t("feed.filters.pickDate")}
              </span>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t("feed.filters.dateLabel", { label })}</DialogTitle>
            </DialogHeader>
            <SimpleCalendar
              selectedDate={selectedDate}
              onDateSelect={(date) => {
                onDateChange(format(date, "yyyy-MM-dd"));
                setDatePickerOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>

        <div className="relative sm:w-36">
          <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="time"
            value={timeValue ?? ""}
            onChange={(e) => onTimeChange(e.target.value || null)}
            className={cn(
              "h-11 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-sm font-medium text-foreground outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20",
              noFieldSpinnerClass,
            )}
          />
        </div>
      </div>
    </div>
  );
}

function CommunityFeedFilterFormBody({
  draft,
  updateAdvanced,
  setDraft,
  viewerUserId,
  commentedOwnCount,
  acceptedRequestCount,
}: {
  draft: FilterDialogDraft;
  updateAdvanced: (patch: Partial<CommunityFeedAdvancedFilters>) => void;
  setDraft: Dispatch<SetStateAction<FilterDialogDraft>>;
  viewerUserId?: string | null;
  commentedOwnCount: number;
  acceptedRequestCount: number;
}) {
  const { t } = useTranslation();

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
      <div className="space-y-2">
        <p className="text-[13px] font-bold text-foreground">{t("feed.filters.when")}</p>
        <div className="flex flex-wrap gap-2">
          {COMMUNITY_FEED_WHEN_OPTIONS.map((opt) => {
            const selected = draft.advanced.when === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  updateAdvanced({
                    when: opt.id,
                    ...(opt.id !== "custom"
                      ? {
                          customWhenFromDate: null,
                          customWhenFromTime: null,
                          customWhenToDate: null,
                          customWhenToTime: null,
                        }
                      : {}),
                  })
                }
                className={cn(
                  "h-9 rounded-full border px-3.5 text-xs font-semibold transition-all active:scale-95",
                  selected
                    ? opt.id === "now"
                      ? "border-red-600 bg-red-600 text-white"
                      : "border-emerald-600 bg-emerald-600 text-white"
                    : opt.id === "now"
                      ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                      : "border-border bg-background text-foreground hover:bg-muted/50",
                )}
              >
                {t(WHEN_OPTION_LABEL_KEYS[opt.id])}
              </button>
            );
          })}
        </div>
        {draft.advanced.when === "custom" ? (
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
            <CustomWhenRangeField
              label={t("feed.filters.from")}
              dateValue={draft.advanced.customWhenFromDate}
              timeValue={draft.advanced.customWhenFromTime}
              onDateChange={(value) => updateAdvanced({ customWhenFromDate: value })}
              onTimeChange={(value) => updateAdvanced({ customWhenFromTime: value })}
            />
            <CustomWhenRangeField
              label={t("feed.filters.to")}
              dateValue={draft.advanced.customWhenToDate}
              timeValue={draft.advanced.customWhenToTime}
              onDateChange={(value) => updateAdvanced({ customWhenToDate: value })}
              onTimeChange={(value) => updateAdvanced({ customWhenToTime: value })}
            />
            <p className="text-[11px] font-medium text-muted-foreground">
              {t("feed.filters.customWhenHint")}
            </p>
          </div>
        ) : null}
        <p className="text-[11px] font-medium text-muted-foreground">
          {t("feed.filters.whenAppliesHint")}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-[13px] font-bold text-foreground">{t("feed.filters.budgetRate")}</p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            placeholder={t("feed.filters.budgetFrom")}
            value={draft.advanced.budgetMin ?? ""}
            onChange={(e) =>
              updateAdvanced({
                budgetMin: e.target.value ? Number(e.target.value) : null,
              })
            }
            className={cn(
              "h-11 flex-1 rounded-xl border border-input bg-background",
              noFieldSpinnerClass,
            )}
          />
          <span className="shrink-0 text-sm font-bold text-muted-foreground">–</span>
          <Input
            type="number"
            min={0}
            placeholder={t("feed.filters.budgetTo")}
            value={draft.advanced.budgetMax ?? ""}
            onChange={(e) =>
              updateAdvanced({
                budgetMax: e.target.value ? Number(e.target.value) : null,
              })
            }
            className={cn(
              "h-11 flex-1 rounded-xl border border-input bg-background",
              noFieldSpinnerClass,
            )}
          />
        </div>
      </div>

      <div className="space-y-2">
        {viewerUserId ? (
          <>
            <FilterCheckboxRow
              checked={draft.commentedOnly}
              onChange={(checked) =>
                setDraft((prev) => ({
                  ...prev,
                  commentedOnly: checked,
                  acceptedOnly: checked ? false : prev.acceptedOnly,
                }))
              }
              label={t("feed.filters.commented")}
              count={commentedOwnCount}
            />
            <FilterCheckboxRow
              checked={draft.acceptedOnly}
              onChange={(checked) =>
                setDraft((prev) => ({
                  ...prev,
                  acceptedOnly: checked,
                  commentedOnly: checked ? false : prev.commentedOnly,
                }))
              }
              label={t("feed.filters.acceptedTab")}
              count={acceptedRequestCount}
            />
          </>
        ) : null}
        <FilterCheckboxRow
          checked={draft.advanced.myPostsOnly}
          onChange={(checked) => updateAdvanced({ myPostsOnly: checked })}
          label={t("feed.filters.myPosts")}
        />
        <FilterCheckboxRow
          checked={draft.advanced.favoriteProfilesOnly}
          onChange={(checked) => updateAdvanced({ favoriteProfilesOnly: checked })}
          label={t("feed.filters.favoriteProfilePosts")}
        />
      </div>
    </div>
  );
}

function CommunityFeedFilterFormFooter({
  onClear,
  onApply,
}: {
  onClear: () => void;
  onApply: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex shrink-0 gap-2 bg-background px-5 py-4">
      <Button type="button" variant="ghost" className="flex-1" onClick={onClear}>
        {t("feed.filters.clear")}
      </Button>
      <Button
        type="button"
        className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
        onClick={onApply}
      >
        {t("feed.filters.apply")}
      </Button>
    </div>
  );
}

export function CommunityFeedFilterDialog({
  open,
  onOpenChange,
  filters,
  onApply,
  viewerUserId,
  commentedFilterActive = false,
  onCommentedFilterChange,
  acceptedFilterActive = false,
  onAcceptedFilterChange,
  onAuthorFilterChange,
}: CommunityFeedFilterDialogProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobileViewport();
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const [draft, setDraft] = useState<FilterDialogDraft>({
    advanced: filters,
    commentedOnly: false,
    acceptedOnly: false,
  });

  const { data: commentedOwnCount = 0 } = useQuery({
    queryKey: ["community", "commentedOwnPostCount", viewerUserId],
    queryFn: () => fetchCommentedOwnPostCount(viewerUserId!),
    enabled: Boolean(viewerUserId),
    staleTime: 30_000,
  });

  const { data: acceptedRequestCount = 0 } = useQuery({
    queryKey: ["community", "acceptedRequestCount", viewerUserId],
    queryFn: () => fetchAcceptedRequestCount(viewerUserId!),
    enabled: Boolean(viewerUserId),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (open) {
      setSheetExpanded(true);
      setDraft({
        advanced: filters,
        commentedOnly: commentedFilterActive,
        acceptedOnly: acceptedFilterActive,
      });
    }
  }, [open, filters, commentedFilterActive, acceptedFilterActive]);

  function updateAdvanced(patch: Partial<CommunityFeedAdvancedFilters>) {
    setDraft((prev) => ({ ...prev, advanced: { ...prev.advanced, ...patch } }));
  }

  function handleApply() {
    onApply(draft.advanced);
    if (draft.commentedOnly || draft.acceptedOnly) {
      onAuthorFilterChange?.(null);
    }
    onCommentedFilterChange?.(draft.commentedOnly);
    onAcceptedFilterChange?.(draft.acceptedOnly);
    onOpenChange(false);
  }

  function handleClear() {
    setDraft({
      advanced: DEFAULT_COMMUNITY_FEED_ADVANCED_FILTERS,
      commentedOnly: false,
      acceptedOnly: false,
    });
    onApply(DEFAULT_COMMUNITY_FEED_ADVANCED_FILTERS);
    onCommentedFilterChange?.(false);
    onAcceptedFilterChange?.(false);
    onOpenChange(false);
  }

  const formBody = (
    <CommunityFeedFilterFormBody
      draft={draft}
      updateAdvanced={updateAdvanced}
      setDraft={setDraft}
      viewerUserId={viewerUserId}
      commentedOwnCount={commentedOwnCount}
      acceptedRequestCount={acceptedRequestCount}
    />
  );

  const formFooter = (
    <CommunityFeedFilterFormFooter onClear={handleClear} onApply={handleApply} />
  );

  if (isMobile) {
    if (!open) return null;

    return (
      <MobileSnapBottomSheet
        expanded={sheetExpanded}
        onExpandedChange={(next) => {
          setSheetExpanded(next);
          if (!next) onOpenChange(false);
        }}
        onDismiss={() => onOpenChange(false)}
        bottomOffsetClass={discoverMobileSheetBottomOffset}
        className="z-[130]"
        maxHeight="min(90dvh, 640px)"
        ariaLabel={t("feed.filters.filterPosts")}
        collapsed={
          <div className="flex w-full flex-col bg-background px-5 pb-2 pt-3">
            <div
              aria-hidden
              className="mx-auto mb-3 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/35"
            />
            <p className="text-base font-bold text-foreground">{t("feed.filters.filterPosts")}</p>
          </div>
        }
      >
        <div className="flex min-h-0 flex-col bg-background">
          {formBody}
          {formFooter}
        </div>
      </MobileSnapBottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,640px)] max-w-md flex-col gap-0 overflow-hidden border-0 p-0 shadow-none sm:rounded-2xl">
        <DialogHeader className="shrink-0 px-5 py-4 text-left">
          <DialogTitle className="text-base font-bold">{t("feed.filters.filterPosts")}</DialogTitle>
        </DialogHeader>
        {formBody}
        {formFooter}
      </DialogContent>
    </Dialog>
  );
}
