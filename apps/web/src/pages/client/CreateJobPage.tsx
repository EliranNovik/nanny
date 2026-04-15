import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { apiPost } from "@/lib/api";
import { getCityFromLocation } from "@/lib/location";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DualLocationPicker } from "@/components/DualLocationPicker";
import {
  Clock,
  MapPin,
  Heart,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  Loader2,
  Lightbulb,
  Sparkles,
  Navigation,
  Check,
  Truck,
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
  Soup,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SERVICE_CATEGORIES,
  isServiceCategoryId,
  serviceCategoryLabel,
  type ServiceCategoryId,
} from "@/lib/serviceCategories";

const SERVICE_TYPE_ICONS: Record<ServiceCategoryId, ReactNode> = {
  cleaning: (
    <Sparkles className="h-8 w-8 text-orange-600 dark:text-orange-400" />
  ),
  cooking: <Soup className="h-8 w-8 text-amber-700 dark:text-amber-400" />,
  pickup_delivery: <Truck className="h-8 w-8 text-sky-600 dark:text-sky-400" />,
  nanny: <Baby className="h-8 w-8 text-pink-600 dark:text-pink-400" />,
  other_help: (
    <Wrench className="h-8 w-8 text-violet-700 dark:text-violet-400" />
  ),
};

/** Step 1 + list tiles — white surfaces, emerald selection (matches availability wizard) */
const JOB_CHOICE_IDLE =
  "border-2 border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:border-white/[0.12] dark:bg-white/[0.04] dark:shadow-none";
const JOB_CHOICE_HOVER =
  "hover:border-emerald-400/50 hover:shadow-[0_8px_24px_-12px_rgba(16,185,129,0.2)] dark:hover:border-emerald-400/35";
const JOB_CHOICE_SELECTED =
  "border-2 border-emerald-500/80 bg-white shadow-[0_12px_40px_-16px_rgba(16,185,129,0.35)] ring-1 ring-emerald-500/25 dark:border-emerald-400/60 dark:bg-white/[0.04] dark:ring-emerald-400/20";

const SERVICE_TYPE_STEP1_STYLE: Record<
  ServiceCategoryId,
  { idle: string; selected: string; subtitle: string; arrow: string }
> = {
  cleaning: {
    idle: JOB_CHOICE_IDLE,
    selected: JOB_CHOICE_SELECTED,
    subtitle: "text-slate-500 dark:text-slate-400",
    arrow: "text-emerald-600 dark:text-emerald-400",
  },
  cooking: {
    idle: JOB_CHOICE_IDLE,
    selected: JOB_CHOICE_SELECTED,
    subtitle: "text-slate-500 dark:text-slate-400",
    arrow: "text-emerald-600 dark:text-emerald-400",
  },
  pickup_delivery: {
    idle: JOB_CHOICE_IDLE,
    selected: JOB_CHOICE_SELECTED,
    subtitle: "text-slate-500 dark:text-slate-400",
    arrow: "text-emerald-600 dark:text-emerald-400",
  },
  nanny: {
    idle: JOB_CHOICE_IDLE,
    selected: JOB_CHOICE_SELECTED,
    subtitle: "text-slate-500 dark:text-slate-400",
    arrow: "text-emerald-600 dark:text-emerald-400",
  },
  other_help: {
    idle: JOB_CHOICE_IDLE,
    selected: JOB_CHOICE_SELECTED,
    subtitle: "text-slate-500 dark:text-slate-400",
    arrow: "text-emerald-600 dark:text-emerald-400",
  },
};

const SERVICE_TYPES = SERVICE_CATEGORIES.map((c) => ({
  id: c.id,
  label: c.label,
  description: c.description,
  icon: SERVICE_TYPE_ICONS[c.id],
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
  "Helpers match by city — use GPS or type yours so the right people see the job.",
  "Choose a duration that fits the visit; helpers use it to decide if they can commit.",
  "Specific details get faster, better matches — add anything that clarifies the task.",
];

interface JobData {
  service_type: string;
  care_frequency: string;
  location_city: string;
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
          return {
            service_type: savedJobData.service_type || "",
            care_frequency: savedJobData.care_frequency || "",
            location_city: savedJobData.location_city || "",
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
      time_duration: "",
      service_details: {},
    };
  });

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
      // Auto-fill the saved location so the user can see it is already set
      updateField("location_city", profile.city);
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

  const stepTip =
    step >= 1 && step <= TOTAL_STEPS
      ? (CREATE_JOB_STEP_TIPS[step - 1] ?? "")
      : "";

  const handleHeaderBack = useCallback(() => {
    if (step > 1) setStep((s: number) => s - 1);
    else navigate("/client/home");
  }, [navigate, step]);

  function canProceed(): boolean {
    switch (step) {
      case 1:
        return !!jobData.service_type;
      case 2:
        return !!jobData.care_frequency;
      case 3:
        return !!jobData.location_city;
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
      updateField("location_city", cityName);
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
      const result = await apiPost<{ job_id: string; confirm_ends_at: string }>(
        "/api/jobs",
        {
          ...jobData,
          confirm_window_seconds: 90,
        },
      );
      console.log("[CreateJobPage] Job created successfully:", result);
      // Clear localStorage after successful submission
      localStorage.removeItem(STORAGE_KEY);
      // Pass job details via state for immediate display
      navigate(`/client/jobs/${result.job_id}/confirmed`, {
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

  const shellTitle = categoryLabel || "Type of help";

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-background pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-0 md:pt-7">
      {/* Mobile: full-bleed hero when a service category is selected */}
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
                  aria-label={step > 1 ? "Back" : "Back to home"}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/80">
                    Post your request
                  </p>
                  <h1 className="text-xl font-black leading-snug tracking-tight text-white drop-shadow-md">
                    {shellTitle}
                  </h1>
                </div>
              </div>
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
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[min(68%,17.5rem)] bg-gradient-to-t from-black/95 via-black/60 to-transparent md:hidden"
                aria-hidden
              />
              <div
                className="absolute inset-x-0 bottom-0 z-10 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:hidden"
                role="status"
                aria-live="polite"
              >
                <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
                  Step {step} of {TOTAL_STEPS}
                </p>
                <div className="flex gap-1.5" aria-hidden>
                  {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1 flex-1 rounded-full transition-colors",
                        i < step ? "bg-emerald-500" : "bg-white/25",
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
              aria-label="Back to home"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Post your request
              </p>
              <h1 className="text-xl font-black leading-snug tracking-tight text-foreground sm:text-[1.35rem]">
                {shellTitle}
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
            aria-label={step > 1 ? "Back" : "Back to home"}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Post your request
            </p>
            <h1 className="text-xl font-black leading-snug tracking-tight text-foreground sm:text-[1.35rem]">
              {shellTitle}
            </h1>
          </div>
          {categoryImageSrc ? (
            <div
              className={cn(
                "relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-md sm:h-28 sm:w-28",
                "dark:border-white/15 dark:bg-white/[0.06]",
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
          className={cn(
            "flex gap-1.5",
            categoryImageSrc ? "hidden md:flex" : "flex",
          )}
          aria-hidden
        >
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

        {stepTip ? (
          <div
            className={cn(
              "gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:border-white/[0.12] dark:bg-white/[0.04] dark:shadow-none",
              categoryImageSrc ? "hidden md:flex" : "flex",
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
          <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
            {step === 1 && (
              <>
                <Sparkles className="w-5 h-5 text-primary shrink-0" /> Type of
                Help
              </>
            )}
            {step === 2 && (
              <>
                <Clock className="w-5 h-5 text-primary shrink-0" /> Type of Care
              </>
            )}
            {step === 3 && (
              <>
                <MapPin className="w-5 h-5 text-primary shrink-0" /> Location
              </>
            )}
            {step === 4 && (
              <>
                <Clock className="w-5 h-5 text-primary shrink-0" /> Time
                Duration
              </>
            )}
            {step === 5 && (
              <>
                <Heart className="w-5 h-5 text-primary shrink-0" /> Service
                Details
              </>
            )}
          </h2>
          <div>
            {error && (
              <div className="p-3 mb-4 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Step 1: Service Type */}
            {step === 1 && (
              <div className="grid gap-3">
                {SERVICE_TYPES.map((type) => {
                  const st = SERVICE_TYPE_STEP1_STYLE[type.id];
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => {
                        updateField("service_type", type.id);
                        setStep(2);
                      }}
                      className={cn(
                        "flex items-center gap-4 rounded-2xl p-4 text-left transition-all",
                        "group relative overflow-hidden",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        st.idle,
                        jobData.service_type === type.id
                          ? st.selected
                          : cn(
                              JOB_CHOICE_HOVER,
                              "active:scale-[0.99] motion-reduce:active:scale-100",
                            ),
                      )}
                    >
                      <div className="flex-shrink-0 rounded-xl bg-slate-50 p-1 shadow-inner dark:bg-white/10">
                        {type.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block text-base font-bold leading-none text-foreground">
                          {type.label}
                        </span>
                        {type.description && (
                          <span
                            className={cn("mt-1 block text-xs", st.subtitle)}
                          >
                            {type.description}
                          </span>
                        )}
                      </div>
                      <ArrowRight
                        className={cn(
                          "h-4 w-4 shrink-0 transition-all duration-300",
                          st.arrow,
                          jobData.service_type === type.id
                            ? "translate-x-0 opacity-100"
                            : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100",
                        )}
                      />
                    </button>
                  );
                })}
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
                        updateField("location_city", "");
                      }}
                    >
                      Change
                    </Button>
                  </div>
                )}

                {/* Location input — shown when user chose to change or no profile city */}
                {(!savedLocationShown || savedLocationDismissed || jobData.location_city !== profile?.city) && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter your city"
                        value={jobData.location_city}
                        onChange={(e) =>
                          updateField("location_city", e.target.value)
                        }
                        className="h-14 flex-1 border-slate-200/90 bg-white text-lg dark:border-white/[0.12] dark:bg-white/[0.04]"
                        autoFocus
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleGetLocation}
                        disabled={gettingLocation}
                        className="h-14 w-14"
                        title="Get location using GPS"
                      >
                        {gettingLocation ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Navigation className="w-5 h-5" />
                        )}
                      </Button>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      We&apos;ll match you with helpers in your area.
                    </p>
                  </div>
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

            {/* Navigation — inline on desktop, hidden on mobile (sticky bar handles it) */}
            <div className="hidden md:flex gap-3 mt-6">
              {step > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                  className="flex-1"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}

              {step < 5 && step !== 1 && step !== 2 && step !== 4 && (
                <Button
                  onClick={() => setStep(step + 1)}
                  disabled={!canProceed()}
                  className="flex-1"
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}

              {step === 5 && (
                <Button
                  onClick={handleSubmit}
                  disabled={loading || !canProceed()}
                  className="flex-1"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Finding Helpers...
                    </>
                  ) : (
                    <>
                      Find Helper
                      <Sparkles className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky mobile CTA bar — always visible at bottom on small screens */}
      <div className="fixed bottom-0 inset-x-0 z-30 md:hidden bg-background/95 backdrop-blur-sm border-t border-border/50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="flex gap-3 max-w-lg mx-auto">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              className="w-14 shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}

          {/* Primary action */}
          {step < 5 && step !== 1 && step !== 2 && step !== 4 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex-1"
              size="lg"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : step === 5 ? (
            <Button
              onClick={handleSubmit}
              disabled={loading || !canProceed()}
              className="flex-1"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Finding Helpers...
                </>
              ) : (
                <>
                  Find Helper
                  <Sparkles className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            // Steps 1, 2, 4 auto-advance on selection — show a disabled placeholder
            <Button
              disabled
              className="flex-1 opacity-40"
              size="lg"
            >
              Select an option above
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
