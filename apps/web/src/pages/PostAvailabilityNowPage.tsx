import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronLeft, ImagePlus, Lightbulb, X } from "lucide-react";
import {
  AVAILABILITY_STATUS_OPTIONS,
  QUICK_DETAILS_OPTIONS,
  PRICE_RANGE_MAX,
  PRICE_RANGE_MIN,
} from "@/lib/availabilityPosts";
import { publishCommunityAvailabilityPulse } from "@/lib/publishCommunityAvailabilityPulse";
import {
  isServiceCategoryId,
  SERVICE_CATEGORIES,
  serviceCategoryLabel,
  type ServiceCategoryId,
} from "@/lib/serviceCategories";
import { cn } from "@/lib/utils";

const STATUS_EMPTY = "__status_empty__";
const QUICK_EMPTY = "__quick_empty__";
const PRICE_EMPTY = "__price_empty__";

/** Preset hourly bands within slider bounds */
const PRICE_BAND_OPTIONS: { id: string; label: string; min: number; max: number }[] = [
  { id: "skip", label: "Don’t show a rate", min: 0, max: 0 },
  { id: "30_50", label: "₪30–₪50/h", min: 30, max: 50 },
  { id: "40_70", label: "₪40–₪70/h", min: 40, max: 70 },
  { id: "50_90", label: "₪50–₪90/h", min: 50, max: 90 },
  { id: "70_120", label: "₪70–₪120/h", min: 70, max: 120 },
];

const STEPS = 6;

/** Short hint shown on the hero overlay (mobile) and in a compact card (desktop). */
const STEP_TIPS: readonly string[] = [
  "Shorter windows feel more urgent; longer ones stay visible for browsers who check later.",
  "Pick the shape that best matches this offer — you can post again anytime.",
  "A rate hint sets expectations; skip if you’d rather agree on pay in chat.",
  "Neighborhood or city helps nearby clients find you — leave blank if you’re flexible.",
  "One friendly, specific line stands out in the feed — you’ve got 120 characters.",
  "A real photo builds trust; skip if you prefer to stay more private.",
];

/** Minimal tap targets — no grey fills; hairline border + emerald accent when selected */
function choiceCardClass(selected: boolean) {
  return cn(
    "relative w-full overflow-hidden rounded-2xl px-5 py-4 text-left transition-[transform,box-shadow,border-color] duration-200 active:scale-[0.99]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]",
    "hover:border-emerald-400/50 hover:shadow-[0_8px_24px_-12px_rgba(16,185,129,0.2)]",
    "dark:border-white/[0.12] dark:bg-white/[0.04] dark:shadow-none dark:hover:border-emerald-400/35",
    selected &&
      "border-emerald-500/80 shadow-[0_12px_40px_-16px_rgba(16,185,129,0.35)] ring-1 ring-emerald-500/25 dark:border-emerald-400/60 dark:ring-emerald-400/20",
    selected &&
      "before:absolute before:inset-y-3 before:left-0 before:w-[3px] before:rounded-full before:bg-emerald-500 before:content-[''] dark:before:bg-emerald-400"
  );
}

export default function PostAvailabilityNowPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get("category");
  const category: ServiceCategoryId | null =
    categoryParam && isServiceCategoryId(categoryParam) ? categoryParam : null;

  const { user, profile } = useAuth();
  const { addToast } = useToast();

  const [step, setStep] = useState(0);
  const [availabilityStatusId, setAvailabilityStatusId] = useState(STATUS_EMPTY);
  const [quickDetailsId, setQuickDetailsId] = useState(QUICK_EMPTY);
  const [priceBandId, setPriceBandId] = useState(PRICE_EMPTY);
  const [areaTag, setAreaTag] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const categoryLabel = category ? serviceCategoryLabel(category) : "";
  const categoryImageSrc = useMemo(
    () => (category ? SERVICE_CATEGORIES.find((c) => c.id === category)?.imageSrc : undefined),
    [category]
  );

  const stepTip = STEP_TIPS[step] ?? "";

  const priceRangeFromBand = useMemo(() => {
    if (priceBandId === PRICE_EMPTY || priceBandId === "skip") return null;
    const band = PRICE_BAND_OPTIONS.find((b) => b.id === priceBandId);
    if (!band || band.id === "skip") return null;
    return { min: band.min, max: band.max };
  }, [priceBandId]);

  const goNext = useCallback(() => {
    setStep((s) => Math.min(s + 1, STEPS - 1));
  }, []);

  const goBack = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const handleHeaderBack = useCallback(() => {
    if (step > 0) goBack();
    else setSearchParams({}, { replace: true });
  }, [goBack, setSearchParams, step]);

  const handlePublish = async () => {
    if (!user?.id || !profile || !category) return;
    const noteTrim = note.trim();
    if (noteTrim.length > 120) {
      addToast({ title: "Note is too long (max 120 characters)", variant: "warning" });
      return;
    }
    if (availabilityStatusId === STATUS_EMPTY || quickDetailsId === QUICK_EMPTY || priceBandId === PRICE_EMPTY) {
      addToast({ title: "Complete all steps", variant: "warning" });
      return;
    }
    setSubmitting(true);
    try {
      const result = await publishCommunityAvailabilityPulse({
        userId: user.id,
        category,
        availabilityStatusId: availabilityStatusId === STATUS_EMPTY ? "" : availabilityStatusId,
        quickDetailsId: quickDetailsId === QUICK_EMPTY ? "" : quickDetailsId,
        priceRange: priceRangeFromBand,
        areaTag,
        note: noteTrim,
        imageFile: files[0] ?? null,
      });
      if (!result.ok) {
        addToast({
          title: "Could not publish",
          description: result.error.message,
          variant: "error",
        });
        return;
      }
      addToast({ title: "Your availability is live", variant: "success" });
      navigate("/availability", { replace: true });
    } catch (e) {
      addToast({
        title: "Could not publish",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!category) {
    return (
      <div className="min-h-screen gradient-mesh pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[2.625rem] md:pt-7">
        <div className="app-desktop-shell mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pb-8">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-full"
              onClick={() => navigate("/availability")}
              aria-label="Back to availability"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Post availability
              </p>
              <h1 className="text-xl font-black tracking-tight text-foreground">Choose a category</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">What kind of work are you offering? You can fill in the details next.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {SERVICE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSearchParams({ category: cat.id }, { replace: true })}
                className={cn(
                  "group relative aspect-square w-full overflow-hidden rounded-2xl text-left outline-none",
                  "shadow-md transition-[transform,box-shadow] duration-200 hover:shadow-lg active:scale-[0.97]",
                  "focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-inset"
                )}
                aria-label={`Offer ${cat.label}`}
              >
                <img
                  src={cat.imageSrc}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="pointer-events-none absolute inset-0 bg-black/40" aria-hidden />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 pb-3 pt-12">
                  <span className="block text-center text-sm font-bold leading-tight text-white drop-shadow-sm sm:text-base">
                    {cat.label}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            <Link
              to="/availability"
              className="font-medium text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
            >
              Manage existing posts
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-mesh pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-0 md:pt-7">
      {/* Mobile: full-bleed hero — image to top edge; back + titles on image */}
      <div className="md:hidden">
        {categoryImageSrc ? (
          <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2">
            <div className="relative aspect-[5/4] min-h-[12rem] w-full overflow-hidden">
              <img
                src={categoryImageSrc}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div
                className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/35 to-black/60"
                aria-hidden
              />
              <div
                className="absolute inset-x-0 top-0 flex items-start gap-3 px-4 pb-6"
                style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-0.5 shrink-0 rounded-full border border-white/25 bg-black/35 text-white backdrop-blur-md hover:bg-black/45 hover:text-white"
                  onClick={handleHeaderBack}
                  aria-label={step > 0 ? "Back" : "Change category"}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/80">
                    Post availability
                  </p>
                  <h1 className="text-xl font-black leading-snug tracking-tight text-white drop-shadow-md">
                    {categoryLabel}
                  </h1>
                </div>
              </div>
              {/* Step tip — frosted overlay on image (mobile only) */}
              {stepTip ? (
                <div
                  className="absolute inset-x-0 z-10 px-4 md:hidden"
                  style={{ bottom: "clamp(5.75rem, 24vw, 7.75rem)" }}
                >
                  <div
                    className="flex gap-2.5 rounded-2xl border border-white/20 bg-black/50 px-3.5 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.4)] ring-1 ring-emerald-500/25 backdrop-blur-md"
                    role="note"
                  >
                    <Lightbulb
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300"
                      aria-hidden
                    />
                    <p className="text-[13px] leading-snug text-white/95 [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">
                      {stepTip}
                    </p>
                  </div>
                </div>
              ) : null}
              {/* Dark wash behind tip + step strip */}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[min(68%,17.5rem)] bg-gradient-to-t from-black/95 via-black/60 to-transparent md:hidden"
                aria-hidden
              />
              {/* Step label + green indication — pinned to image bottom (mobile only) */}
              <div
                className="absolute inset-x-0 bottom-0 z-10 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:hidden"
                role="status"
                aria-live="polite"
              >
                <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
                  Step {step + 1} of {STEPS}
                </p>
                <div className="flex gap-1.5" aria-hidden>
                  {Array.from({ length: STEPS }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1 flex-1 rounded-full transition-colors",
                        i <= step ? "bg-emerald-500" : "bg-white/25"
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="flex items-start gap-3 px-4"
            style={{ paddingTop: "max(2.625rem, env(safe-area-inset-top))" }}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mt-0.5 shrink-0 rounded-full"
              onClick={handleHeaderBack}
              aria-label={step > 0 ? "Back" : "Change category"}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Post availability
              </p>
              <h1 className="text-xl font-black leading-snug tracking-tight text-foreground sm:text-[1.35rem]">
                {categoryLabel}
              </h1>
            </div>
          </div>
        )}
      </div>

      <div className="app-desktop-shell mx-auto flex w-full max-w-lg flex-col gap-6 px-4 pb-8 pt-5 md:pt-0">
        <div className="hidden items-start gap-3 md:flex">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-0.5 shrink-0 rounded-full"
            onClick={handleHeaderBack}
            aria-label={step > 0 ? "Back" : "Change category"}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Post availability
            </p>
            <h1 className="text-xl font-black leading-snug tracking-tight text-foreground sm:text-[1.35rem]">
              {categoryLabel}
            </h1>
          </div>
          {categoryImageSrc ? (
            <div
              className={cn(
                "relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-100 shadow-md sm:h-28 sm:w-28",
                "dark:border-white/15 dark:bg-white/[0.06]"
              )}
              aria-hidden
            >
              <img
                src={categoryImageSrc}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}
        </div>

        <div
          className={cn("flex gap-1.5", categoryImageSrc ? "hidden md:flex" : "flex")}
          aria-hidden
        >
          {Array.from({ length: STEPS }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= step ? "bg-emerald-500" : "bg-emerald-500/15 dark:bg-emerald-400/10"
              )}
            />
          ))}
        </div>

        {stepTip ? (
          <div
            className="hidden gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-3 dark:border-emerald-400/20 dark:bg-emerald-500/[0.06] md:flex"
            role="note"
          >
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <p className="text-sm leading-snug text-slate-700 dark:text-slate-200">{stepTip}</p>
          </div>
        ) : null}

        <div className="space-y-6 pt-1">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">When are you available?</Label>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  How long your pulse stays visible (2h / 24h / 48h). Tap to continue.
                </p>
              </div>
              <div className="flex flex-col gap-2.5" role="listbox" aria-label="Availability window">
                {AVAILABILITY_STATUS_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    role="option"
                    aria-selected={availabilityStatusId === o.id}
                    onClick={() => {
                      setAvailabilityStatusId(o.id);
                      setStep(1);
                    }}
                    className={choiceCardClass(availabilityStatusId === o.id)}
                  >
                    <span className="block text-base font-semibold text-foreground">{o.label}</span>
                    <span className="mt-1 block text-sm font-medium text-slate-500 dark:text-slate-400">
                      {o.hours}h on the board
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">What kind of work?</Label>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Pick one — tap to continue.</p>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" role="listbox" aria-label="Job shape">
                {QUICK_DETAILS_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    role="option"
                    aria-selected={quickDetailsId === o.id}
                    onClick={() => {
                      setQuickDetailsId(o.id);
                      setStep(2);
                    }}
                    className={cn(choiceCardClass(quickDetailsId === o.id), "min-h-[4.5rem] sm:min-h-[5rem]")}
                  >
                    <span className="block text-[15px] font-semibold leading-snug text-foreground">{o.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">Hourly rate hint</Label>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  ₪min–₪max/h · range {PRICE_RANGE_MIN}–{PRICE_RANGE_MAX}
                </p>
              </div>
              <div className="flex flex-col gap-2.5" role="listbox" aria-label="Rate hint">
                {PRICE_BAND_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    role="option"
                    aria-selected={priceBandId === o.id}
                    onClick={() => {
                      setPriceBandId(o.id);
                      setStep(3);
                    }}
                    className={choiceCardClass(priceBandId === o.id)}
                  >
                    <span className="block text-base font-semibold text-foreground">{o.label}</span>
                    {o.id !== "skip" && (
                      <span className="mt-1 block text-sm font-medium text-slate-500 dark:text-slate-400">
                        Shown on your live pulse
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="area-tag" className="text-base font-semibold">
                  Area (optional)
                </Label>
                <p className="text-sm text-slate-500 dark:text-slate-400">Neighborhood or area — max 40 characters.</p>
              </div>
              <Input
                id="area-tag"
                value={areaTag}
                onChange={(e) => setAreaTag(e.target.value)}
                placeholder="e.g. North Tel Aviv"
                maxLength={40}
                className="h-12 rounded-xl"
              />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="offer-note" className="text-base font-semibold">
                  Short note (optional)
                </Label>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">One line — max 120 characters</p>
              </div>
              <Textarea
                id="offer-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="One line — max 120 characters"
                rows={4}
                maxLength={120}
                className="resize-none rounded-xl"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">{note.length}/120</p>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <div>
                <Label className="text-base font-semibold">Photo (optional)</Label>
                <p className="text-sm text-slate-500 dark:text-slate-400">One image helps you stand out.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-xl"
                  onClick={() => document.getElementById("post-now-files")?.click()}
                >
                  <ImagePlus className="h-4 w-4" />
                  Add photo
                </Button>
                <input
                  id="post-now-files"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setFiles(f ? [f] : []);
                    e.target.value = "";
                  }}
                />
              </div>
              {files.length > 0 && (
                <ul className="flex flex-wrap gap-2 text-xs">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-white px-2 py-1 dark:border-white/10 dark:bg-white/[0.06]"
                    >
                      <span className="max-w-[180px] truncate">{f.name}</span>
                      <button
                        type="button"
                        className="rounded-full p-0.5 hover:bg-background"
                        onClick={() => setFiles([])}
                        aria-label="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          {step >= 3 && step < STEPS - 1 && (
            <Button
              type="button"
              className="h-12 rounded-xl bg-emerald-600 font-semibold hover:bg-emerald-700"
              onClick={goNext}
            >
              Next
            </Button>
          )}
          {step === STEPS - 1 && (
            <Button
              type="button"
              className="h-12 rounded-xl bg-emerald-600 font-semibold hover:bg-emerald-700"
              disabled={submitting}
              onClick={() => void handlePublish()}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Publishing…
                </>
              ) : (
                "Publish availability"
              )}
            </Button>
          )}
        </div>

        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          <Link to="/availability" className="font-medium text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400">
            Manage existing posts
          </Link>
        </p>
      </div>
    </div>
  );
}
