import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { apiPost } from "@/lib/api";
import { getCityFromLocation } from "@/lib/location";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DualLocationPicker } from "@/components/DualLocationPicker";
import { CreateJobCityAutocomplete } from "@/components/CreateJobCityAutocomplete";
import {
  Heart,
  ChevronRight,
  Loader2,
  Lightbulb,
  Sparkles,
  Check,
  Baby,
  Wrench,
  Calendar,
  Timer,
  Repeat,
  Hourglass,
  Watch,
  History as HistoryIcon,
  Sun,
  Home,
  Building2,
  Trees,
  User,
  Users,
  UserPlus,
  Dumbbell,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SERVICE_CATEGORIES,
  isServiceCategoryId,
  serviceCategoryLabel,
  type ServiceCategoryId,
} from "@/lib/serviceCategories";
import { useLiveJobCounts } from "@/hooks/data/useLiveJobCounts";

/** Step 2+ list tiles — white surfaces, emerald selection (matches availability wizard) */
const JOB_CHOICE_IDLE =
  "border-2 border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:border-white/[0.12] dark:bg-white/[0.04] dark:shadow-none";
const JOB_CHOICE_HOVER =
  "hover:border-emerald-400/50 hover:shadow-[0_8px_24px_-12px_rgba(16,185,129,0.2)] dark:hover:border-emerald-400/35";
const JOB_CHOICE_SELECTED =
  "border-2 border-emerald-500/80 bg-white shadow-[0_12px_40px_-16px_rgba(16,185,129,0.35)] ring-1 ring-emerald-500/25 dark:border-emerald-400/60 dark:bg-white/[0.04] dark:ring-emerald-400/20";

const SERVICE_TYPES = SERVICE_CATEGORIES.map((c) => ({
  id: c.id,
  label: c.label,
  description: c.description,
  imageSrc: c.imageSrc,
}));

// Step 2: Care Frequency
const CARE_FREQUENCIES = [
  {
    id: "one_time",
    label: "One time",
    icon: <Calendar className="w-8 h-8 text-primary" />,
  },
  {
    id: "part_time",
    label: "Part time",
    icon: <Timer className="w-8 h-8 text-emerald-500" />,
  },
  {
    id: "regularly",
    label: "Regularly",
    icon: <Repeat className="w-8 h-8 text-indigo-500" />,
  },
];

// Step 4: Time Duration
const TIME_DURATIONS = [
  {
    id: "1_2_hours",
    label: "1-2 hours",
    icon: <Hourglass className="w-8 h-8 text-amber-500" />,
  },
  {
    id: "3_4_hours",
    label: "3-4 hours",
    icon: <Watch className="w-8 h-8 text-emerald-500" />,
  },
  {
    id: "5_6_hours",
    label: "5-6 hours",
    icon: <HistoryIcon className="w-8 h-8 text-blue-500" />,
  },
  {
    id: "full_day",
    label: "Full day",
    icon: <Sun className="w-8 h-8 text-orange-500" />,
  },
];

// Step 5: Service-specific options
const CLEANING_TYPES = [
  {
    id: "house",
    label: "House cleaning",
    icon: <Home className="w-8 h-8 text-primary" />,
  },
  {
    id: "office",
    label: "Office cleaning",
    icon: <Building2 className="w-8 h-8 text-slate-500" />,
  },
  {
    id: "garden",
    label: "Garden (outdoor)",
    icon: <Trees className="w-8 h-8 text-emerald-600" />,
  },
];

const COOKING_PEOPLE_COUNTS = [
  {
    id: "1_4",
    label: "1-4 people",
    icon: <User className="w-8 h-8 text-primary" />,
  },
  {
    id: "4_6",
    label: "4-6 people",
    icon: <Users className="w-8 h-8 text-primary" />,
  },
  {
    id: "6_10",
    label: "6-10 people",
    icon: <Users className="w-8 h-8 text-primary" />,
  },
  {
    id: "10_plus",
    label: "10+ people",
    icon: <UserPlus className="w-8 h-8 text-primary" />,
  },
];

const NANNY_KIDS_COUNTS = [
  {
    id: "1_2",
    label: "1-2 kids",
    icon: <Baby className="w-8 h-8 text-primary" />,
  },
  {
    id: "2_4",
    label: "2-4 kids",
    icon: <Baby className="w-8 h-8 text-primary" />,
  },
  {
    id: "4_6",
    label: "4-6 kids",
    icon: <Users className="w-8 h-8 text-primary" />,
  },
  {
    id: "8_plus",
    label: "8+ kids",
    icon: <UserPlus className="w-8 h-8 text-primary" />,
  },
];

const OTHER_HELP_TYPES = [
  {
    id: "technical",
    label: "Technical",
    icon: <Wrench className="w-8 h-8 text-slate-600" />,
  },
  {
    id: "heavy_lifting",
    label: "Heavy lifting",
    icon: <Dumbbell className="w-8 h-8 text-slate-800" />,
  },
  {
    id: "caregiving",
    label: "Caregiving (Olders)",
    icon: <Heart className="w-8 h-8 text-red-500" />,
  },
];

const STORAGE_KEY = "create_job_form_data";

const TOTAL_STEPS = 5;

/** Mobile hero + desktop tip card — aligned with post-availability wizard copy style */
const CREATE_JOB_STEP_TIPS: readonly string[] = [
  "Pick the category that best matches what you need — you can post another request anytime.",
  "One-time is for a single visit; part-time and regular suit ongoing or repeating help.",
  "Pick your city from the suggestions (or GPS). Free text alone won’t unlock the next step.",
  "Choose a duration that fits the visit; helpers use it to decide if they can commit.",
  "Specific details get faster, better matches — add anything that clarifies the task.",
];

interface JobData {
  service_type: string;
  care_frequency: string;
  location_city: string;
  /** Set when city comes from Places/GPS/profile — required to leave step 3 */
  location_city_confirmed: boolean;
  time_duration: string;
  service_details: {
    // For cleaning
    cleaning_type?: string;
    // For cooking
    people_count?: string;
    // For pickup_delivery
    from_address?: string;
    from_lat?: number;
    from_lng?: number;
    to_address?: string;
    to_lat?: number;
    to_lng?: number;
    // For nanny
    kids_count?: string;
    // For other_help
    other_type?: string;
    description?: string;
  };
}

export default function CreateJobPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const appliedServiceFromUrl = useRef(false);
  const { addToast } = useToast();
  // Lazy initializer for step - only runs once
  const [step, setStep] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const savedStep = parsed.step;
        if (savedStep && savedStep > 0) {
          return savedStep;
        }
      }
    } catch (error) {
      console.error("Error loading saved step:", error);
    }
    return 1;
  });

  // Lazy initializer for jobData - only runs once
  const [jobData, setJobData] = useState<JobData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const { step: _, ...savedJobData } = parsed;

        // Validate that we have meaningful data
        const hasData =
          savedJobData.service_type ||
          savedJobData.location_city ||
          savedJobData.time_duration ||
          savedJobData.care_frequency ||
          (savedJobData.service_details &&
            Object.keys(savedJobData.service_details).length > 0);

        if (hasData) {
          const loc = savedJobData.location_city || "";
          return {
            service_type: savedJobData.service_type || "",
            care_frequency: savedJobData.care_frequency || "",
            location_city: loc,
            location_city_confirmed:
              typeof savedJobData.location_city_confirmed === "boolean"
                ? savedJobData.location_city_confirmed
                : !!loc,
            time_duration: savedJobData.time_duration || "",
            service_details: savedJobData.service_details || {},
          } as JobData;
        }
      }
    } catch (error) {
      console.error("Error loading saved form data:", error);
    }
    // Return defaults if no saved data
    return {
      service_type: "",
      care_frequency: "",
      location_city: "",
      location_city_confirmed: false,
      time_duration: "",
      service_details: {},
    };
  });

  const { data: liveCounts = {} } = useLiveJobCounts();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [gettingLocation, setGettingLocation] = useState(false);
  const [savedLocationShown, setSavedLocationShown] = useState(false);

  // Track previous values to only save when they actually change
  const prevStepRef = useRef<number | null>(null);
  const prevJobDataRef = useRef<string | null>(null);
  const isInitialMountRef = useRef(true);

  // Save to localStorage only when values actually change (not on mount)
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevStepRef.current = step;
      prevJobDataRef.current = JSON.stringify(jobData);
      return;
    }

    const currentDataStr = JSON.stringify(jobData);
    const stepChanged = prevStepRef.current !== step;
    const dataChanged = prevJobDataRef.current !== currentDataStr;

    // Only save if something actually changed
    if (!stepChanged && !dataChanged) return;

    // Update refs
    prevStepRef.current = step;
    prevJobDataRef.current = currentDataStr;

    // Small delay to batch rapid changes
    const timeoutId = setTimeout(() => {
      const dataToSave = {
        ...jobData,
        step,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [jobData, step]);

  // Show saved location when reaching step 3 and auto-apply it if no location is set
  const [savedLocationDismissed, setSavedLocationDismissed] = useState(false);

  useEffect(() => {
    if (
      step === 3 &&
      profile?.city &&
      !savedLocationShown &&
      !jobData.location_city &&
      !savedLocationDismissed
    ) {
      setJobData((prev) => ({
        ...prev,
        location_city: profile.city!,
        location_city_confirmed: true,
      }));
      setSavedLocationShown(true);
    }
  }, [step, profile?.city, savedLocationShown, jobData.location_city, savedLocationDismissed]);

  // Deep link: ?service=cleaning skips to step 2 with type preselected
  useEffect(() => {
    if (appliedServiceFromUrl.current) return;
    const raw = searchParams.get("service");
    if (!raw || !isServiceCategoryId(raw)) return;
    appliedServiceFromUrl.current = true;
    setJobData((prev) => ({ ...prev, service_type: raw }));
    setStep(2);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const categoryId: ServiceCategoryId | null =
    jobData.service_type && isServiceCategoryId(jobData.service_type)
      ? jobData.service_type
      : null;

  const categoryImageSrc = useMemo(
    () =>
      categoryId
        ? SERVICE_CATEGORIES.find((c) => c.id === categoryId)?.imageSrc
        : undefined,
    [categoryId],
  );

  const categoryLabel = categoryId ? serviceCategoryLabel(categoryId) : "";

  /** Step 1 = choosing category — no hero image or category name in header */
  const showCategoryHero = Boolean(categoryImageSrc && step > 1);

  const shellTitle = useMemo(() => {
    switch (step) {
      case 1: return "Type of help";
      case 2: return "Type of Care";
      case 3: return "Location";
      case 4: return "Time Duration";
      case 5: return "Service Details";
      default: return categoryLabel || "Post your request";
    }
  }, [step, categoryLabel]);

  const stepTip =
    step >= 1 && step <= TOTAL_STEPS
      ? (CREATE_JOB_STEP_TIPS[step - 1] ?? "")
      : "";

  const selectLocationCity = useCallback((city: string) => {
    setJobData((prev) => ({
      ...prev,
      location_city: city.trim(),
      location_city_confirmed: true,
    }));
  }, []);

  const invalidateLocationCity = useCallback(() => {
    setJobData((prev) => ({
      ...prev,
      location_city: "",
      location_city_confirmed: false,
    }));
  }, []);

  const handleHeaderBack = useCallback(() => {
    if (step > 1) setStep((s: number) => s - 1);
    else navigate("/client/home");
  }, [navigate, step]);

  /** Mobile hero: glass pills — shared by Back / Next / Post now (md:hidden block only) */
  const mobileHeroPillClass =
    "mt-0.5 h-10 shrink-0 gap-1.5 rounded-full border border-white/30 bg-white/15 px-4 text-sm font-semibold text-white backdrop-blur-md hover:bg-white/25 disabled:opacity-40 sm:h-11 sm:px-[1.125rem] sm:text-[0.9375rem]";

  /** Mobile plain header (no category image) */
  const mobilePlainHeaderPillClass =
    "mt-0.5 h-11 shrink-0 gap-1.5 rounded-full border border-border/70 bg-background/95 px-4 text-base font-semibold shadow-sm backdrop-blur-sm hover:bg-muted/60 dark:border-white/15 dark:bg-background/90";

  /** Post now — high-contrast orange CTA */
  const postNowOrangeBase =
    "gap-1.5 border border-orange-400/90 bg-gradient-to-r from-orange-500 to-orange-600 font-bold text-white shadow-lg shadow-orange-950/35 ring-1 ring-orange-300/50 transition hover:from-orange-500 hover:to-orange-500 hover:brightness-105 hover:shadow-orange-900/40 focus-visible:ring-orange-500/60 dark:border-orange-400/70 dark:from-orange-500 dark:to-orange-600 dark:ring-orange-400/30";

  function canProceed(): boolean {
    switch (step) {
      case 1:
        return !!jobData.service_type;
      case 2:
        return !!jobData.care_frequency;
      case 3:
        return (
          !!jobData.location_city.trim() && jobData.location_city_confirmed
        );
      case 4:
        return !!jobData.time_duration;
      case 5: {
        // Check service-specific details based on service_type
        if (jobData.service_type === "cleaning") {
          return !!jobData.service_details.cleaning_type;
        } else if (jobData.service_type === "cooking") {
          return !!jobData.service_details.people_count;
        } else if (jobData.service_type === "pickup_delivery") {
          return (
            !!jobData.service_details.from_address &&
            !!jobData.service_details.to_address
          );
        } else if (jobData.service_type === "nanny") {
          return !!jobData.service_details.kids_count;
        } else if (jobData.service_type === "other_help") {
          return !!jobData.service_details.other_type;
        }
        return false;
      }
      default:
        return false;
    }
  }

  function updateField<K extends keyof JobData>(field: K, value: JobData[K]) {
    setJobData((prev) => ({ ...prev, [field]: value }));
  }

  function updateServiceDetail<K extends keyof JobData["service_details"]>(
    field: K,
    value: JobData["service_details"][K],
  ) {
    setJobData((prev) => ({
      ...prev,
      service_details: { ...prev.service_details, [field]: value },
    }));
  }

  async function handleGetLocation() {
    setGettingLocation(true);
    try {
      const cityName = await getCityFromLocation();
      setJobData((prev) => ({
        ...prev,
        location_city: cityName,
        location_city_confirmed: true,
      }));
      addToast({
        title: "Location found",
        description: `Your location has been set to ${cityName}`,
        variant: "success",
      });
    } catch (error: any) {
      console.error("Error getting location:", error);
      addToast({
        title: "Location error",
        description: error.message || "Failed to get your location",
        variant: "error",
      });
    } finally {
      setGettingLocation(false);
    }
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");

    try {
      console.log("[CreateJobPage] Submitting job request:", jobData);
      const { location_city_confirmed: _confirmed, ...jobPayload } = jobData;
      const result = await apiPost<{ job_id: string; confirm_ends_at: string }>(
        "/api/jobs",
        {
          ...jobPayload,
          confirm_window_seconds: 90,
        },
      );
      console.log("[CreateJobPage] Job created successfully:", result);
      // Clear localStorage after successful submission
      localStorage.removeItem(STORAGE_KEY);
      // Pass job details via state for immediate display
      navigate(`/client/jobs/${result.job_id}/live`, {
        state: {
          job: {
            id: result.job_id,
            service_type: jobData.service_type,
            service_details: jobData.service_details,
            location_city: jobData.location_city,
            time_duration: jobData.time_duration,
            care_frequency: jobData.care_frequency,
          },
        },
      });
    } catch (err) {
      console.error("[CreateJobPage] Error creating job:", err);
      setError(err instanceof Error ? err.message : "Failed to create job");
      setLoading(false);
    }
  }

  /** Mobile fixed banner: flush below notch — app chrome hidden on /client/create (see BottomNav + index.css). */
  const mobileFixedBannerTopClass = "top-[env(safe-area-inset-top,0px)]";

  return (
    <div
      data-create-job-no-mobile-header=""
      className="min-h-screen bg-slate-50/50 dark:bg-background pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-0 md:pt-7"
    >
      {/* Mobile: fixed top banner (stays visible while page scrolls) */}
      <div className="md:hidden">
        {showCategoryHero ? (
          <>
            <div
              className={cn(
                "fixed inset-x-0 z-20 w-full",
                mobileFixedBannerTopClass,
              )}
            >
              <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2">
                <div className="relative aspect-[16/9] min-h-[6rem] max-h-[9rem] w-full overflow-hidden sm:max-h-[10rem]">
                  <img
                    src={categoryImageSrc}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div
                    className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/35 to-black/60"
                    aria-hidden
                  />
                  <div className="absolute inset-x-0 top-0 grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-1 px-2 pb-3 pt-2 sm:gap-2 sm:px-3 sm:pb-4">
                    <div className="flex justify-start">
                      {step === 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={mobileHeroPillClass}
                          onClick={handleHeaderBack}
                          aria-label="Back"
                        >
                          <ChevronLeft className="h-5 w-5 shrink-0" />
                          Back
                        </Button>
                      ) : (
                        <div className={cn(mobileHeroPillClass, "opacity-0 pointer-events-none")}>
                          <ChevronLeft className="h-5 w-5 shrink-0" />
                          Back
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 max-w-[min(100%,18rem)] justify-self-center pt-0.5 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80 sm:text-[11px]">
                        Post your request
                      </p>
                      <h1 className="text-lg font-black leading-snug tracking-tight text-white drop-shadow-md sm:text-xl">
                        {shellTitle}
                      </h1>
                    </div>
                    <div className="flex justify-end">
                      <div className={cn(mobileHeroPillClass, "opacity-0 pointer-events-none")}>
                        Next
                        <ChevronRight className="h-5 w-5 shrink-0" />
                      </div>
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-1">
                    <div className="flex gap-1" aria-hidden>
                      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            "h-1 flex-1 rounded-full transition-colors",
                            i < step ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-white/25",
                          )}
                        />
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            </div>
            {/* Reserve space so content starts below fixed banner */}
            <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2" aria-hidden>
              <div className="aspect-[16/9] min-h-[6rem] max-h-[9rem] w-full sm:max-h-[10rem]" />
            </div>
          </>
        ) : (
          <>
            <div
              className={cn(
                "fixed inset-x-0 z-20 border-b border-border/50 bg-slate-50/95 backdrop-blur-sm dark:bg-background/95",
                mobileFixedBannerTopClass,
              )}
            >
              <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-1 px-3 py-2.5 sm:px-4">
                <div className="flex justify-start">
                  {step === 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={mobilePlainHeaderPillClass}
                      onClick={handleHeaderBack}
                      aria-label="Back"
                    >
                      <ChevronLeft className="h-5 w-5 shrink-0" />
                      Back
                    </Button>
                  ) : (
                    <div className={cn(mobilePlainHeaderPillClass, "opacity-0 pointer-events-none")}>
                      <ChevronLeft className="h-5 w-5 shrink-0" />
                      Back
                    </div>
                  )}
                </div>
                <div className="min-w-0 max-w-[min(100%,18rem)] justify-self-center text-center">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    Post your request
                  </p>
                  <h1 className="text-lg font-black leading-snug tracking-tight text-foreground sm:text-[1.35rem]">
                    {shellTitle}
                  </h1>
                </div>
                <div className="flex justify-end">
                  <div className={cn(mobilePlainHeaderPillClass, "opacity-0 pointer-events-none")}>
                    Next
                    <ChevronRight className="h-5 w-5 shrink-0" />
                  </div>
                </div>
              </div>
              <div className="px-3 pb-1.5 sm:px-4">
                <div className="flex gap-1" aria-hidden>
                  {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1 flex-1 rounded-full transition-colors",
                        i < step
                          ? "bg-emerald-500"
                          : "bg-emerald-500/15 dark:bg-emerald-400/10",
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="h-[5.5rem] shrink-0 sm:h-[5.75rem]" aria-hidden />
          </>
        )}
      </div>

      <div className="app-desktop-shell mx-auto flex w-full max-w-lg flex-col gap-6 px-4 pb-8 pt-2 md:pt-0">
        <div className="hidden items-start justify-between gap-4 md:flex">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Post your request
            </p>
            <h1 className="text-xl font-black leading-snug tracking-tight text-foreground sm:text-[1.35rem]">
              {shellTitle}
            </h1>
          </div>
          <div className="flex shrink-0 items-start gap-3">
            {showCategoryHero ? (
              <div
                className={cn(
                  "relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-md sm:h-24 sm:w-24",
                  "dark:border-white/15 dark:bg-white/[0.06]",
                )}
                aria-hidden
              >
                <img
                  src={categoryImageSrc ?? ""}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="hidden md:block">
          <div className="flex gap-1" aria-hidden>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i < step
                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                    : "bg-emerald-500/15 dark:bg-emerald-400/10",
                )}
              />
            ))}
          </div>
        </div>

        {stepTip ? (
          <div
            className={cn(
              "hidden gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:border-white/[0.12] dark:bg-white/[0.04] dark:shadow-none",
              "md:flex",
            )}
            role="note"
          >
            <Lightbulb
              className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
            <p className="text-sm leading-snug text-slate-700 dark:text-slate-200">
              {stepTip}
            </p>
          </div>
        ) : null}

        <div className="animate-fade-in">
          <div>
            {error && (
              <div className="p-3 mb-4 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Step 1: Service Type — image tiles; 2 columns on mobile for larger tap targets */}
            {step === 1 && (
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 md:gap-3">
                {SERVICE_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      updateField("service_type", type.id);
                      setStep(2);
                    }}
                    className={cn(
                      "group relative aspect-square w-full shrink-0 overflow-hidden rounded-2xl text-left outline-none",
                      "shadow-md transition-[transform,box-shadow] duration-200 hover:shadow-lg active:scale-[0.97]",
                      "focus-visible:ring-2 focus-visible:ring-emerald-500/65 focus-visible:ring-inset",
                      jobData.service_type === type.id &&
                      "ring-2 ring-emerald-500 ring-offset-1 ring-offset-background md:ring-offset-2",
                    )}
                  >
                    <img
                      src={type.imageSrc}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover transition-[transform,filter] duration-200 group-hover:scale-105 group-active:scale-[0.98] group-active:brightness-110"
                    />
                    {liveCounts[type.id] > 0 && (
                      <div className="absolute right-1.5 top-1.5 z-[10] flex h-6 items-center gap-1.5 rounded-full bg-red-500 pl-1.5 pr-2.5 text-[10px] font-black uppercase tracking-tight text-white shadow-[0_4px_12px_rgba(239,68,68,0.45)] ring-1.5 ring-white animate-in zoom-in-50 duration-300">
                        <div className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
                          <div className="absolute inset-0 animate-ping rounded-full bg-white/70" />
                          <div className="relative block h-1.5 w-1.5 rounded-full bg-white" />
                        </div>
                        <span className="truncate">
                          {liveCounts[type.id]} Live Now
                        </span>
                      </div>
                    )}
                    <div
                      className="pointer-events-none absolute inset-0 z-[1] bg-black/25 transition-opacity duration-200 group-active:bg-black/15"
                      aria-hidden
                    />
                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-black via-black/90 to-transparent pt-20 pb-1 px-1 sm:pt-28 sm:pb-2 sm:px-2 md:pt-32"
                      aria-hidden
                    />
                    <div className="absolute inset-x-0 bottom-0 z-[2] flex flex-col items-center justify-end px-1.5 pb-4 pt-8 text-center sm:px-2 sm:pb-6 sm:pt-10 md:pb-8 md:pt-12">
                      <span className="text-lg font-black leading-tight tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] max-md:line-clamp-2 sm:text-base md:text-lg lg:text-xl">
                        {type.label}
                      </span>
                      {type.description ? (
                        <span className="mt-1.5 max-w-[98%] text-[13px] font-bold leading-snug text-white/95 [text-shadow:0_1px_8px_rgba(0,0,0,0.6)] max-md:line-clamp-2 sm:mt-1 sm:text-[11px] md:text-xs">
                          {type.description}
                        </span>
                      ) : null}
                    </div>
                    <ChevronRight
                      className="pointer-events-none absolute bottom-2 right-2 z-[3] h-4 w-4 text-white/95 drop-shadow-md sm:bottom-2 sm:right-2 sm:h-5 sm:w-5"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Step 2: Care Frequency */}
            {step === 2 && (
              <div className="grid gap-3">
                {CARE_FREQUENCIES.map((freq) => (
                  <button
                    key={freq.id}
                    onClick={() => {
                      updateField("care_frequency", freq.id);
                      setStep(3);
                    }}
                    className={cn(
                      "flex items-center gap-4 rounded-2xl p-4 text-left transition-all group shadow-sm",
                      JOB_CHOICE_IDLE,
                      jobData.care_frequency === freq.id
                        ? JOB_CHOICE_SELECTED
                        : JOB_CHOICE_HOVER,
                    )}
                  >
                    <div className="flex-shrink-0">{freq.icon}</div>
                    <span className="font-bold text-base">{freq.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Step 3: Location */}
            {step === 3 && (
              <div className="space-y-4">
                {/* Saved location banner — shown when we've auto-filled from profile */}
                {savedLocationShown && !savedLocationDismissed && profile?.city && jobData.location_city === profile.city && (
                  <div className="flex items-center gap-3 rounded-2xl border-2 border-emerald-400/60 bg-emerald-50/80 p-3.5 dark:border-emerald-500/40 dark:bg-emerald-500/10">
                    <Check className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                        Using your saved location
                      </p>
                      <p className="text-xs text-emerald-700/70 dark:text-emerald-300/70">
                        {profile.city}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-xs text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-500/20 h-7 px-2"
                      onClick={() => {
                        setSavedLocationDismissed(true);
                        setJobData((prev) => ({
                          ...prev,
                          location_city: "",
                          location_city_confirmed: false,
                        }));
                      }}
                    >
                      Change
                    </Button>
                  </div>
                )}

                {/* Location input — shown when user chose to change or no profile city */}
                {(!savedLocationShown || savedLocationDismissed || jobData.location_city !== profile?.city) && (
                  <CreateJobCityAutocomplete
                    confirmedCity={jobData.location_city}
                    isConfirmed={jobData.location_city_confirmed}
                    onPickCity={selectLocationCity}
                    onInvalidateSelection={invalidateLocationCity}
                    gpsLoading={gettingLocation}
                    onGpsClick={handleGetLocation}
                  />
                )}
              </div>
            )}

            {/* Step 4: Time Duration */}
            {step === 4 && (
              <div className="grid grid-cols-2 gap-3">
                {TIME_DURATIONS.map((duration) => (
                  <button
                    key={duration.id}
                    onClick={() => {
                      updateField("time_duration", duration.id);
                      setStep(5);
                    }}
                    className={cn(
                      "group flex flex-col items-center justify-center gap-2 rounded-2xl p-4 text-center shadow-sm transition-all",
                      JOB_CHOICE_IDLE,
                      jobData.time_duration === duration.id
                        ? JOB_CHOICE_SELECTED
                        : JOB_CHOICE_HOVER,
                    )}
                  >
                    <div className="flex-shrink-0 mb-1">{duration.icon}</div>
                    <p className="font-bold text-xs">{duration.label}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Step 5: Service-Specific Details */}
            {step === 5 && (
              <div className="space-y-4">
                {/* Cleaning Type */}
                {jobData.service_type === "cleaning" && (
                  <div className="space-y-4">
                    <div className="grid gap-3">
                      <label className="ml-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                        Type of cleaning
                      </label>
                      {CLEANING_TYPES.map((type) => (
                        <button
                          key={type.id}
                          onClick={() =>
                            updateServiceDetail("cleaning_type", type.id)
                          }
                          className={cn(
                            "group flex items-center gap-4 rounded-2xl p-4 text-left shadow-sm transition-all",
                            JOB_CHOICE_IDLE,
                            jobData.service_details.cleaning_type === type.id
                              ? JOB_CHOICE_SELECTED
                              : JOB_CHOICE_HOVER,
                          )}
                        >
                          <div className="flex-shrink-0">{type.icon}</div>
                          <span className="font-bold text-base">
                            {type.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cooking People Count */}
                {jobData.service_type === "cooking" && (
                  <div className="space-y-4">
                    <div className="grid gap-3">
                      <label className="ml-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                        How many people?
                      </label>
                      {COOKING_PEOPLE_COUNTS.map((count) => (
                        <button
                          key={count.id}
                          onClick={() =>
                            updateServiceDetail("people_count", count.id)
                          }
                          className={cn(
                            "group flex items-center gap-4 rounded-2xl p-4 text-left shadow-sm transition-all",
                            JOB_CHOICE_IDLE,
                            jobData.service_details.people_count === count.id
                              ? JOB_CHOICE_SELECTED
                              : JOB_CHOICE_HOVER,
                          )}
                        >
                          <div className="flex-shrink-0">{count.icon}</div>
                          <span className="font-bold text-base">
                            {count.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pickup/Delivery Addresses */}
                {jobData.service_type === "pickup_delivery" && (
                  <div className="space-y-4">
                    <DualLocationPicker
                      fromLabel="📍 Pick from location"
                      toLabel="🎯 Deliver to location"
                      fromValue={{
                        address: jobData.service_details.from_address || "",
                        lat: jobData.service_details.from_lat,
                        lng: jobData.service_details.from_lng,
                      }}
                      toValue={{
                        address: jobData.service_details.to_address || "",
                        lat: jobData.service_details.to_lat,
                        lng: jobData.service_details.to_lng,
                      }}
                      onFromChange={(value) => {
                        updateServiceDetail("from_address", value.address);
                        updateServiceDetail("from_lat", value.lat);
                        updateServiceDetail("from_lng", value.lng);
                      }}
                      onToChange={(value) => {
                        updateServiceDetail("to_address", value.address);
                        updateServiceDetail("to_lat", value.lat);
                        updateServiceDetail("to_lng", value.lng);
                      }}
                      fromPlaceholder="Enter pickup address"
                      toPlaceholder="Enter delivery address"
                    />
                  </div>
                )}

                {/* Nanny Kids Count */}
                {jobData.service_type === "nanny" && (
                  <div className="space-y-4">
                    <div className="grid gap-3">
                      <label className="ml-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                        How many kids?
                      </label>
                      {NANNY_KIDS_COUNTS.map((count) => (
                        <button
                          key={count.id}
                          onClick={() =>
                            updateServiceDetail("kids_count", count.id)
                          }
                          className={cn(
                            "group flex items-center gap-4 rounded-2xl p-4 text-left shadow-sm transition-all",
                            JOB_CHOICE_IDLE,
                            jobData.service_details.kids_count === count.id
                              ? JOB_CHOICE_SELECTED
                              : JOB_CHOICE_HOVER,
                          )}
                        >
                          <div className="flex-shrink-0">{count.icon}</div>
                          <span className="font-bold text-base">
                            {count.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Other Help Type */}
                {jobData.service_type === "other_help" && (
                  <div className="space-y-4">
                    <div className="grid gap-3">
                      <label className="ml-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                        Type of help
                      </label>
                      {OTHER_HELP_TYPES.map((type) => (
                        <button
                          key={type.id}
                          onClick={() =>
                            updateServiceDetail("other_type", type.id)
                          }
                          className={cn(
                            "group flex items-center gap-4 rounded-2xl p-4 text-left shadow-sm transition-all",
                            JOB_CHOICE_IDLE,
                            jobData.service_details.other_type === type.id
                              ? JOB_CHOICE_SELECTED
                              : JOB_CHOICE_HOVER,
                          )}
                        >
                          <div className="flex-shrink-0">{type.icon}</div>
                          <span className="font-bold text-base">
                            {type.label}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        Additional details (optional)
                      </label>
                      <Input
                        placeholder="Describe what you need help with..."
                        value={jobData.service_details.description || ""}
                        onChange={(e) =>
                          updateServiceDetail("description", e.target.value)
                        }
                        className="h-14 border-slate-200/90 bg-white text-lg dark:border-white/[0.12] dark:bg-white/[0.04]"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Navigation Actions (Steps 2-5 only) */}
            {step > 1 && (
              <div className="mt-10 flex flex-col gap-3 pb-8 px-1 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Button
                  type="button"
                  className={cn(
                    "h-16 w-full text-lg font-black transition-all shadow-xl active:scale-[0.98]",
                    step === TOTAL_STEPS
                      ? postNowOrangeBase
                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-950/20 border-b-4 border-emerald-800 active:border-b-0 active:translate-y-[2px]"
                  )}
                  onClick={step === TOTAL_STEPS ? handleSubmit : () => setStep((s: number) => s + 1)}
                  disabled={loading || !canProceed()}
                >
                  {step === TOTAL_STEPS ? (
                    loading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    ) : (
                      <>
                        Post My Request Now
                        <Sparkles className="ml-2 h-6 w-6 text-white" />
                      </>
                    )
                  ) : (
                    <>
                      Next Step
                      <ChevronRight className="ml-2 h-6 w-6" />
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="h-14 w-full text-lg font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 active:scale-[0.98]"
                  onClick={handleHeaderBack}
                >
                  <ChevronLeft className="mr-2 h-5 w-5" /> Back
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
