import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, Clock, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SimpleCalendar } from "@/components/SimpleCalendar";
import { cn, noFieldSpinnerClass } from "@/lib/utils";
import {
  COMMUNITY_FEED_WHEN_OPTIONS,
  DEFAULT_COMMUNITY_FEED_ADVANCED_FILTERS,
  countActiveAdvancedFilters,
  type CommunityFeedAdvancedFilters,
} from "@/lib/communityFeedFilters";

type CommunityFeedFilterDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: CommunityFeedAdvancedFilters;
  onApply: (filters: CommunityFeedAdvancedFilters) => void;
};

export function CommunityFeedFilterButton({
  filters,
  onClick,
  className,
}: {
  filters: CommunityFeedAdvancedFilters;
  onClick: () => void;
  className?: string;
}) {
  const activeCount = countActiveAdvancedFilters(filters);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wide transition-all sm:text-[13px]",
        activeCount > 0
          ? "border-transparent bg-orange-600 text-white shadow-md shadow-orange-900/15"
          : "border-border/60 bg-background text-foreground hover:bg-muted/50",
        className,
      )}
      aria-label="Filter posts"
    >
      <SlidersHorizontal className="h-[18px] w-[18px] shrink-0" strokeWidth={2.25} />
      Filter
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
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
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
      <span className="text-sm font-semibold text-foreground">{label}</span>
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
                  : "Pick a date"}
              </span>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{label} date</DialogTitle>
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

export function CommunityFeedFilterDialog({
  open,
  onOpenChange,
  filters,
  onApply,
}: CommunityFeedFilterDialogProps) {
  const [draft, setDraft] = useState(filters);

  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  function updateDraft(patch: Partial<CommunityFeedAdvancedFilters>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function handleApply() {
    onApply(draft);
    onOpenChange(false);
  }

  function handleClear() {
    setDraft(DEFAULT_COMMUNITY_FEED_ADVANCED_FILTERS);
    onApply(DEFAULT_COMMUNITY_FEED_ADVANCED_FILTERS);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,640px)] max-w-md flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4 text-left">
          <DialogTitle className="text-base font-bold">Filter posts</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="space-y-2">
            <p className="text-[13px] font-bold text-foreground">When</p>
            <div className="flex flex-wrap gap-2">
              {COMMUNITY_FEED_WHEN_OPTIONS.map((opt) => {
                const selected = draft.when === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      updateDraft({
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
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {draft.when === "custom" ? (
              <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
                <CustomWhenRangeField
                  label="From"
                  dateValue={draft.customWhenFromDate}
                  timeValue={draft.customWhenFromTime}
                  onDateChange={(value) => updateDraft({ customWhenFromDate: value })}
                  onTimeChange={(value) => updateDraft({ customWhenFromTime: value })}
                />
                <CustomWhenRangeField
                  label="To"
                  dateValue={draft.customWhenToDate}
                  timeValue={draft.customWhenToTime}
                  onDateChange={(value) => updateDraft({ customWhenToDate: value })}
                  onTimeChange={(value) => updateDraft({ customWhenToTime: value })}
                />
                <p className="text-[11px] font-medium text-muted-foreground">
                  Leave either side empty to filter with only a start or end time.
                </p>
              </div>
            ) : null}
            <p className="text-[11px] font-medium text-muted-foreground">
              Applies to request posts with a timeframe. Today includes urgent Now posts.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-[13px] font-bold text-foreground">Budget / rate (₪)</p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                placeholder="From"
                value={draft.budgetMin ?? ""}
                onChange={(e) =>
                  updateDraft({
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
                placeholder="To"
                value={draft.budgetMax ?? ""}
                onChange={(e) =>
                  updateDraft({
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
            <FilterCheckboxRow
              checked={draft.myPostsOnly}
              onChange={(checked) => updateDraft({ myPostsOnly: checked })}
              label="My posts"
            />
            <FilterCheckboxRow
              checked={draft.favoriteProfilesOnly}
              onChange={(checked) => updateDraft({ favoriteProfilesOnly: checked })}
              label="Favorite profile posts"
            />
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-border/60 bg-background px-5 py-4">
          <Button type="button" variant="ghost" className="flex-1" onClick={handleClear}>
            Clear
          </Button>
          <Button
            type="button"
            className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
            onClick={handleApply}
          >
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
