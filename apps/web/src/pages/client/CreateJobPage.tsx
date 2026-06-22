import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { useKycGate } from "@/context/KycGateContext";
import { needsKycVerification } from "@/lib/kyc";
import { useToast } from "@/components/ui/toast";
import { apiPost } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { getCityFromLocation } from "@/lib/location";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SimpleCalendar } from "@/components/SimpleCalendar";
import { DualLocationPicker } from "@/components/DualLocationPicker";
import { CreateJobCityAutocomplete } from "@/components/CreateJobCityAutocomplete";
import type { CityPlaceSelection } from "@/lib/cityPlace";
import {
  buildCustomWhenAtIso,
  computeJobStartAtFromWhen,
} from "@/lib/createJobWhen";
import {
  REQUEST_HELP_WHEN_OPTIONS,
  requestHelpWhenOptionButtonClass,
  type RequestHelpTimeframe,
} from "@/lib/requestHelpWhen";
import { format } from "date-fns";
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
  Clock,
  CalendarDays,
  ImagePlus,
  X,
  Scissors,
  GraduationCap,
  ShoppingCart,
  PawPrint,
  FileText,
  PartyPopper,
  Palette,
  Truck,
  HeartHandshake,
  ChefHat,
  LayoutGrid,
} from "lucide-react";
import { HeaderBackChevron } from "@/components/HeaderBackChevron";
import { cn } from "@/lib/utils";
import {
  SERVICE_CATEGORIES,
  OTHER_HELP_SUBCATEGORIES,
  isServiceCategoryId,
  type ServiceCategoryId,
} from "@/lib/serviceCategories";
import { useLiveJobCounts } from "@/hooks/data/useLiveJobCounts";

/** Step 2+ list tiles — white surfaces, emerald selection (matches availability wizard) */
const JOB_CHOICE_IDLE =
  "border-2 border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:border-transparent dark:bg-white/[0.06] dark:shadow-none";
const JOB_CHOICE_HOVER =
  "hover:border-emerald-400/50 hover:shadow-[0_8px_24px_-12px_rgba(16,185,129,0.2)] dark:hover:bg-white/[0.1]";
const JOB_CHOICE_SELECTED =
  "border-2 border-transparent bg-emerald-600 text-white shadow-[0_12px_40px_-16px_rgba(16,185,129,0.45)] [&_svg]:text-white dark:border-transparent dark:bg-emerald-600 dark:text-white";

const SERVICE_TYPES = SERVICE_CATEGORIES.map((c) => ({
  id: c.id,
  label: c.label,
  description: c.description,
  imageSrc: c.imageSrc,
}));

/** Step 1 main category tiles — colored boxes with icons (no image backgrounds). */
const SERVICE_TYPE_META: Record<
  string,
  { icon: JSX.Element; idle: string; selected: string; iconWrap: string }
> = {
  cleaning: {
    icon: <Sparkles className="h-7 w-7" />,
    idle: "bg-sky-50 text-sky-950 dark:bg-sky-500/10 dark:text-sky-50",
    selected: "bg-sky-600 text-white [&_svg]:text-white",
    iconWrap: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  },
  cooking: {
    icon: <ChefHat className="h-7 w-7" />,
    idle: "bg-amber-50 text-amber-950 dark:bg-amber-500/10 dark:text-amber-50",
    selected: "bg-amber-500 text-white [&_svg]:text-white",
    iconWrap: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  },
  pickup_delivery: {
    icon: <Truck className="h-7 w-7" />,
    idle: "bg-indigo-50 text-indigo-950 dark:bg-indigo-500/10 dark:text-indigo-50",
    selected: "bg-indigo-600 text-white [&_svg]:text-white",
    iconWrap: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300",
  },
  nanny: {
    icon: <Baby className="h-7 w-7" />,
    idle: "bg-rose-50 text-rose-950 dark:bg-rose-500/10 dark:text-rose-50",
    selected: "bg-rose-500 text-white [&_svg]:text-white",
    iconWrap: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  },
  technical_help: {
    icon: <Wrench className="h-7 w-7" />,
    idle: "bg-slate-100 text-slate-900 dark:bg-slate-500/10 dark:text-slate-50",
    selected: "bg-slate-700 text-white [&_svg]:text-white",
    iconWrap: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  },
  other_help: {
    icon: <LayoutGrid className="h-7 w-7" />,
    idle: "bg-emerald-50 text-emerald-950 dark:bg-emerald-500/10 dark:text-emerald-50",
    selected: "bg-emerald-600 text-white [&_svg]:text-white",
    iconWrap: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  },
};

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

const OTHER_HELP_ICONS: Record<string, JSX.Element> = {
  beauty_personal_care: <Scissors className="w-8 h-8 text-pink-500" />,
  heavy_lifting_moving: <Truck className="w-8 h-8 text-slate-700" />,
  coaching_lessons: <GraduationCap className="w-8 h-8 text-indigo-500" />,
  shopping_errands: <ShoppingCart className="w-8 h-8 text-emerald-600" />,
  pet_help: <PawPrint className="w-8 h-8 text-amber-600" />,
  elderly_help: <Heart className="w-8 h-8 text-red-500" />,
  paperwork_bureaucracy: <FileText className="w-8 h-8 text-blue-500" />,
  event_help: <PartyPopper className="w-8 h-8 text-fuchsia-500" />,
  home_maintenance: <Home className="w-8 h-8 text-orange-500" />,
  digital_creative: <Palette className="w-8 h-8 text-violet-500" />,
  religious_community: <HeartHandshake className="w-8 h-8 text-teal-600" />,
};

const OTHER_HELP_TYPES = OTHER_HELP_SUBCATEGORIES.map((sub) => ({
  id: sub.id,
  label: sub.label,
  icon: OTHER_HELP_ICONS[sub.id] ?? (
    <Wrench className="w-8 h-8 text-slate-600" />
  ),
}));

const STORAGE_KEY = "create_job_form_data";

const TOTAL_STEPS = 9;

const MAX_CREATE_JOB_MEDIA = 5;

const noFieldSpinnerClass =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

type CreateJobMediaDraft = {
  id: string;
  file: File;
  previewUrl: string;
  kind: "image" | "video";
};

interface JobData {
  service_type: string;
  care_frequency: string;
  location_city: string;
  /** Set when city comes from Places/GPS/profile — required to leave step 3 */
  location_city_confirmed: boolean;
  time_duration: string;
  budget_amount: string;
  budget_rate_type: "per_hour" | "fixed";
  when_timeframe: RequestHelpTimeframe | "";
  custom_when_date: string | null;
  custom_when_time: string;
  additional_notes: string;
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

function filterCreateJobMediaFiles(files: File[]): File[] {
  return files.filter(
    (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
  );
}

function revokeCreateJobMediaUrls(items: CreateJobMediaDraft[]) {
  for (const item of items) {
    URL.revokeObjectURL(item.previewUrl);
  }
}

function parseStoredCustomWhenDate(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export default function CreateJobPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const { openKycRequiredDialog } = useKycGate();
  const appliedServiceFromUrl = useRef(false);
  const { addToast } = useToast();
  const { t } = useTranslation();
  /** When `other_help` is picked on step 1, show its subcategory grid first. */
  const [otherHelpSubOpen, setOtherHelpSubOpen] = useState(false);
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
            budget_amount: savedJobData.budget_amount || "",
            budget_rate_type:
              savedJobData.budget_rate_type === "fixed" ? "fixed" : "per_hour",
            when_timeframe: savedJobData.when_timeframe || "",
            custom_when_date: parseStoredCustomWhenDate(
              savedJobData.custom_when_date,
            ),
            custom_when_time: savedJobData.custom_when_time || "",
            additional_notes: savedJobData.additional_notes || "",
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
      budget_amount: "",
      budget_rate_type: "per_hour",
      when_timeframe: "",
      custom_when_date: null,
      custom_when_time: "",
      additional_notes: "",
      service_details: {},
    };
  });

  const { data: liveCounts = {} } = useLiveJobCounts();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [gettingLocation, setGettingLocation] = useState(false);
  const [savedLocationShown, setSavedLocationShown] = useState(false);
  const [composeMedia, setComposeMedia] = useState<CreateJobMediaDraft[]>([]);
  const [customWhenDatePickerOpen, setCustomWhenDatePickerOpen] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const composeMediaRef = useRef(composeMedia);
  composeMediaRef.current = composeMedia;

  const customWhenDate = useMemo(() => {
    if (!jobData.custom_when_date) return null;
    const [year, month, day] = jobData.custom_when_date
      .split("-")
      .map((part) => parseInt(part, 10));
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }
    return new Date(year, month - 1, day);
  }, [jobData.custom_when_date]);

  useEffect(() => {
    return () => {
      revokeCreateJobMediaUrls(composeMediaRef.current);
    };
  }, []);

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
    if (raw === "other_help") {
      setStep(1);
      setOtherHelpSubOpen(true);
    } else {
      setStep(2);
    }
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

  const categoryLabel = categoryId ? t(`feed.categories.${categoryId}`) : "";

  /** Step 1 = choosing category — no hero image or category name in header */
  const showCategoryHero = Boolean(categoryImageSrc && step > 1);

  const shellTitle = useMemo(() => {
    if (step >= 1 && step <= TOTAL_STEPS) {
      return t(`createJob.titles.step${step}`);
    }
    return categoryLabel || t("createJob.titles.default");
  }, [step, categoryLabel, t]);

  const stepTip =
    step >= 1 && step <= TOTAL_STEPS
      ? t(`createJob.tips.${step}`)
      : "";

  const selectLocationCity = useCallback((selection: CityPlaceSelection) => {
    setJobData((prev) => ({
      ...prev,
      location_city: selection.label.trim(),
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
    if (step === 1 && otherHelpSubOpen) {
      setOtherHelpSubOpen(false);
      return;
    }
    if (step > 1) setStep((s: number) => s - 1);
    else navigate("/client/home");
  }, [navigate, step, otherHelpSubOpen]);

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
      case 5:
        return true;
      case 6:
        if (!jobData.when_timeframe) return false;
        if (jobData.when_timeframe === "custom") {
          return !!jobData.custom_when_date && !!jobData.custom_when_time.trim();
        }
        return true;
      case 7:
      case 8:
        return true;
      case 9: {
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
        } else if (jobData.service_type === "technical_help") {
          return true;
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
        title: t("createJob.toast.locationFound"),
        description: t("createJob.toast.locationSet", { city: cityName }),
        variant: "success",
      });
    } catch (error: any) {
      console.error("Error getting location:", error);
      addToast({
        title: t("createJob.toast.locationError"),
        description: error.message || t("createJob.toast.locationFailed"),
        variant: "error",
      });
    } finally {
      setGettingLocation(false);
    }
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

  function handleMediaPick(files: FileList | File[]) {
    const list = filterCreateJobMediaFiles(Array.from(files));
    if (list.length === 0) return;
    setComposeMedia((prev) => {
      const room = MAX_CREATE_JOB_MEDIA - prev.length;
      if (room <= 0) return prev;
      const next = list.slice(0, room).map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        kind: (file.type.startsWith("video/") ? "video" : "image") as
          | "image"
          | "video",
      }));
      return [...prev, ...next];
    });
  }

  function removeComposeMedia(id: string) {
    setComposeMedia((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  }

  function setCustomWhenDate(date: Date | null) {
    setJobData((prev) => ({
      ...prev,
      custom_when_date: date ? format(date, "yyyy-MM-dd") : null,
    }));
  }

  async function handleSubmit() {
    if (needsKycVerification(profile)) {
      openKycRequiredDialog("start_request");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const uploadedImages: string[] = [];
      if (user?.id && composeMedia.length > 0) {
        for (const item of composeMedia) {
          const fileExt = item.file.name.split(".").pop() || (item.kind === "video" ? "mp4" : "jpg");
          const filePath = `${user.id}/${crypto.randomUUID()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from("job-images")
            .upload(filePath, item.file, {
              contentType: item.file.type || undefined,
            });
          if (uploadError) throw uploadError;
          const {
            data: { publicUrl },
          } = supabase.storage.from("job-images").getPublicUrl(filePath);
          uploadedImages.push(publicUrl);
        }
      }

      const budgetParsed = parseInt(jobData.budget_amount, 10);
      const hasBudget =
        jobData.budget_amount.trim() !== "" &&
        Number.isFinite(budgetParsed) &&
        budgetParsed > 0;

      const customWhenAtIso =
        jobData.when_timeframe === "custom" && customWhenDate
          ? buildCustomWhenAtIso(customWhenDate, jobData.custom_when_time)
          : null;

      const whenTimeframe = jobData.when_timeframe as RequestHelpTimeframe;
      const startAt = whenTimeframe
        ? computeJobStartAtFromWhen(whenTimeframe, customWhenAtIso)
        : undefined;

      const { location_city_confirmed: _confirmed, ...restJobData } = jobData;
      const serviceDetails = {
        ...restJobData.service_details,
        ...(uploadedImages.length > 0 ? { images: uploadedImages } : {}),
      };

      const jobPayload = {
        service_type: restJobData.service_type,
        care_frequency: restJobData.care_frequency,
        time_duration: restJobData.time_duration,
        location_city: restJobData.location_city,
        service_details: serviceDetails,
        when_timeframe: whenTimeframe || undefined,
        custom_when_at: customWhenAtIso ?? undefined,
        start_at: startAt,
        budget_min: hasBudget ? budgetParsed : null,
        budget_max:
          hasBudget && restJobData.budget_rate_type === "fixed"
            ? budgetParsed
            : null,
        budget_rate_type: hasBudget ? restJobData.budget_rate_type : null,
        notes: restJobData.additional_notes.trim() || null,
        confirm_window_seconds: 90,
      };

      console.log("[CreateJobPage] Submitting job request:", jobPayload);
      const result = await apiPost<{ job_id: string; confirm_ends_at: string }>(
        "/api/jobs",
        jobPayload,
      );
      console.log("[CreateJobPage] Job created successfully:", result);
      revokeCreateJobMediaUrls(composeMedia);
      setComposeMedia([]);
      localStorage.removeItem(STORAGE_KEY);
      navigate(`/client/jobs/${result.job_id}/live`, {
        state: {
          job: {
            id: result.job_id,
            service_type: jobData.service_type,
            service_details: serviceDetails,
            location_city: jobData.location_city,
            time_duration: jobData.time_duration,
            care_frequency: jobData.care_frequency,
            when_timeframe: whenTimeframe || null,
            custom_when_at: customWhenAtIso,
            budget_min: jobPayload.budget_min,
            budget_max: jobPayload.budget_max,
            budget_rate_type: jobPayload.budget_rate_type,
            notes: jobPayload.notes,
          },
        },
      });
    } catch (err) {
      console.error("[CreateJobPage] Error creating job:", err);
      const message = err instanceof Error ? err.message : "Failed to create job";
      if (message.toLowerCase().includes("verify")) {
        openKycRequiredDialog("start_request");
      }
      setError(message);
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
                          aria-label={t("createJob.nav.back")}
                        >
                          <HeaderBackChevron />
                          {t("createJob.nav.back")}
                        </Button>
                      ) : (
                        <div className={cn(mobileHeroPillClass, "opacity-0 pointer-events-none")}>
                          <HeaderBackChevron />
                          {t("createJob.nav.back")}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 max-w-[min(100%,18rem)] justify-self-center pt-0.5 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80 sm:text-[11px]">
                        {t("createJob.eyebrow")}
                      </p>
                      <h1 className="text-lg font-black leading-snug tracking-tight text-white drop-shadow-md sm:text-xl">
                        {shellTitle}
                      </h1>
                    </div>
                    <div className="flex justify-end">
                      <div className={cn(mobileHeroPillClass, "opacity-0 pointer-events-none")}>
                        {t("createJob.nav.next")}
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
                      aria-label={t("createJob.nav.back")}
                    >
                      <HeaderBackChevron />
                      {t("createJob.nav.back")}
                    </Button>
                  ) : (
                    <div className={cn(mobilePlainHeaderPillClass, "opacity-0 pointer-events-none")}>
                      <HeaderBackChevron />
                      {t("createJob.nav.back")}
                    </div>
                  )}
                </div>
                <div className="min-w-0 max-w-[min(100%,18rem)] justify-self-center text-center">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {t("createJob.eyebrow")}
                  </p>
                  <h1 className="text-lg font-black leading-snug tracking-tight text-foreground sm:text-[1.35rem]">
                    {shellTitle}
                  </h1>
                </div>
                <div className="flex justify-end">
                  <div className={cn(mobilePlainHeaderPillClass, "opacity-0 pointer-events-none")}>
                    {t("createJob.nav.next")}
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

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pb-8 pt-2 md:pt-0">
        <div className="hidden items-start justify-between gap-4 md:flex">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              {t("createJob.eyebrow")}
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

            {/* Step 1 (Other help): pick a subcategory first, before the rest of the flow */}
            {step === 1 && otherHelpSubOpen && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  {OTHER_HELP_TYPES.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => {
                        updateServiceDetail("other_type", type.id);
                        setStep(2);
                      }}
                      className={cn(
                        "group flex h-full flex-col items-center justify-start gap-2 rounded-2xl p-3.5 text-center shadow-sm transition-all",
                        JOB_CHOICE_IDLE,
                        jobData.service_details.other_type === type.id
                          ? JOB_CHOICE_SELECTED
                          : JOB_CHOICE_HOVER,
                      )}
                    >
                      <div className="flex-shrink-0">{type.icon}</div>
                      <span className="text-base font-bold leading-snug">
                        {t(`otherHelpSubcategories.${type.id}`)}
                      </span>
                    </button>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  className="h-14 w-full text-lg font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 active:scale-[0.98]"
                  onClick={() => setOtherHelpSubOpen(false)}
                >
                  <HeaderBackChevron className="mr-2" /> {t("createJob.nav.back")}
                </Button>
              </div>
            )}

            {/* Step 1: Service Type — colored boxes with icons; 2 columns on mobile */}
            {step === 1 && !otherHelpSubOpen && (
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 md:gap-3">
                {SERVICE_TYPES.map((type) => {
                  const meta = SERVICE_TYPE_META[type.id] ?? SERVICE_TYPE_META.other_help;
                  const selected = jobData.service_type === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => {
                        updateField("service_type", type.id);
                        if (type.id === "other_help") {
                          setOtherHelpSubOpen(true);
                        } else {
                          setStep(2);
                        }
                      }}
                      className={cn(
                        "group relative flex aspect-square w-full shrink-0 flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl p-3 text-center outline-none",
                        "shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.97]",
                        "focus-visible:ring-2 focus-visible:ring-emerald-500/65 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        selected ? meta.selected : meta.idle,
                      )}
                    >
                      {liveCounts[type.id] > 0 && (
                        <div className="absolute right-1.5 top-1.5 z-[10] flex h-6 items-center gap-1.5 rounded-full bg-red-500 pl-1.5 pr-2.5 text-[10px] font-black uppercase tracking-tight text-white shadow-[0_4px_12px_rgba(239,68,68,0.45)] ring-1.5 ring-white animate-in zoom-in-50 duration-300">
                          <div className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
                            <div className="absolute inset-0 animate-ping rounded-full bg-white/70" />
                            <div className="relative block h-1.5 w-1.5 rounded-full bg-white" />
                          </div>
                          <span className="truncate">
                            {t("createJob.liveNow", { count: liveCounts[type.id] })}
                          </span>
                        </div>
                      )}
                      <div
                        className={cn(
                          "flex h-14 w-14 items-center justify-center rounded-2xl transition-colors",
                          selected ? "bg-white/20 text-white" : meta.iconWrap,
                        )}
                      >
                        {meta.icon}
                      </div>
                      <div className="space-y-0.5 px-1">
                        <div className="text-base font-black leading-tight tracking-tight sm:text-[15px] md:text-base lg:text-lg">
                          {t(`feed.categories.${type.id}`)}
                        </div>
                        <div
                          className={cn(
                            "text-[12px] font-semibold leading-snug",
                            selected ? "text-white/85" : "opacity-70",
                          )}
                        >
                          {t(`createJob.serviceDescriptions.${type.id}`)}
                        </div>
                      </div>
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
                    <span className="font-bold text-lg">
                      {t(`createJob.careFrequency.${freq.id}`)}
                    </span>
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
                        {t("createJob.savedLocation.title")}
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
                      {t("createJob.savedLocation.change")}
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
                    <p className="font-bold text-sm">
                      {t(`createJob.timeDuration.${duration.id}`)}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {/* Step 5: Budget (optional) */}
            {step === 5 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("createJob.budget.optionalHint")}
                </p>
                <div className="space-y-1.5">
                  <label className="ml-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                    {t("createJob.budget.label")}
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                        ₪
                      </span>
                      <input
                        type="number"
                        placeholder="200"
                        value={jobData.budget_amount}
                        onChange={(e) => updateField("budget_amount", e.target.value)}
                        className={cn(
                          "h-14 w-full rounded-2xl border border-slate-200/90 bg-white pl-8 pr-4 text-lg font-medium text-foreground outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 dark:border-white/[0.12] dark:bg-white/[0.04]",
                          noFieldSpinnerClass,
                        )}
                      />
                    </div>
                    <select
                      value={jobData.budget_rate_type}
                      onChange={(e) =>
                        updateField(
                          "budget_rate_type",
                          e.target.value as JobData["budget_rate_type"],
                        )
                      }
                      className="h-14 w-36 rounded-2xl border border-slate-200/90 bg-white px-3.5 text-base font-medium text-foreground outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 dark:border-white/[0.12] dark:bg-white/[0.04]"
                    >
                      <option value="per_hour">{t("createJob.budget.perHour")}</option>
                      <option value="fixed">{t("createJob.budget.fixed")}</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 6: When */}
            {step === 6 && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {REQUEST_HELP_WHEN_OPTIONS.map((opt) => {
                    const isSel = jobData.when_timeframe === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          updateField("when_timeframe", opt.id);
                          if (opt.id !== "custom") {
                            setCustomWhenDate(null);
                            updateField("custom_when_time", "");
                            setCustomWhenDatePickerOpen(false);
                          }
                        }}
                        className={cn(
                          "h-11 rounded-xl border px-4 text-sm font-semibold transition-all active:scale-95",
                          requestHelpWhenOptionButtonClass(isSel, opt.id),
                        )}
                      >
                        {t(`createJob.when.options.${opt.id}`)}
                      </button>
                    );
                  })}
                </div>
                {jobData.when_timeframe === "custom" ? (
                  <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-[1fr_auto]">
                    <Dialog
                      open={customWhenDatePickerOpen}
                      onOpenChange={setCustomWhenDatePickerOpen}
                    >
                      <DialogTrigger asChild>
                        <button
                          type="button"
                          className="flex h-14 w-full items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-3.5 text-left text-base font-medium text-foreground outline-none transition-colors hover:bg-slate-50 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 dark:border-white/[0.12] dark:bg-white/[0.04] dark:hover:bg-white/[0.06]"
                        >
                          <CalendarDays className="h-5 w-5 shrink-0 text-muted-foreground" />
                          <span className={cn(!customWhenDate && "text-muted-foreground")}>
                            {customWhenDate
                              ? format(customWhenDate, "EEEE, MMMM d, yyyy")
                              : t("createJob.when.pickDate")}
                          </span>
                        </button>
                      </DialogTrigger>
                      <DialogContent className="max-w-sm">
                        <DialogHeader>
                          <DialogTitle>{t("createJob.when.dialogTitle")}</DialogTitle>
                        </DialogHeader>
                        <SimpleCalendar
                          selectedDate={customWhenDate}
                          onDateSelect={(date) => {
                            setCustomWhenDate(date);
                            setCustomWhenDatePickerOpen(false);
                          }}
                        />
                      </DialogContent>
                    </Dialog>
                    <div className="relative sm:w-40">
                      <Clock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="time"
                        value={jobData.custom_when_time}
                        onChange={(e) => updateField("custom_when_time", e.target.value)}
                        className={cn(
                          "h-14 w-full rounded-2xl border border-slate-200/90 bg-white pl-11 pr-3.5 text-base font-medium text-foreground outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 dark:border-white/[0.12] dark:bg-white/[0.04]",
                          noFieldSpinnerClass,
                        )}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Step 7: Additional details (optional) */}
            {step === 7 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t("createJob.additional.hint")}
                </p>
                <Textarea
                  placeholder={t("createJob.additional.placeholder")}
                  value={jobData.additional_notes}
                  onChange={(e) => updateField("additional_notes", e.target.value)}
                  className="min-h-[140px] resize-none rounded-2xl border-slate-200/90 bg-white text-base dark:border-white/[0.12] dark:bg-white/[0.04]"
                />
              </div>
            )}

            {/* Step 8: Media (optional) */}
            {step === 8 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("createJob.media.hint")}
                </p>
                <input
                  ref={mediaInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/mp4,video/webm,video/quicktime,video/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) handleMediaPick(e.target.files);
                    e.target.value = "";
                  }}
                />
                {composeMedia.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {composeMedia.map((item) => (
                      <div
                        key={item.id}
                        className="relative aspect-square overflow-hidden rounded-2xl border border-slate-200/90 bg-muted/30 dark:border-white/[0.12]"
                      >
                        {item.kind === "image" ? (
                          <img
                            src={item.previewUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <video
                            src={item.previewUrl}
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => removeComposeMedia(item.id)}
                          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm"
                          aria-label={t("createJob.media.removeAria")}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                {composeMedia.length < MAX_CREATE_JOB_MEDIA ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 w-full gap-2 rounded-2xl border-dashed text-base font-semibold"
                    onClick={() => mediaInputRef.current?.click()}
                  >
                    <ImagePlus className="h-5 w-5" />
                    {t("createJob.media.addButton")}
                  </Button>
                ) : null}
              </div>
            )}

            {/* Step 9: Service-Specific Details */}
            {step === 9 && (
              <div className="space-y-4">
                {/* Cleaning Type */}
                {jobData.service_type === "cleaning" && (
                  <div className="space-y-4">
                    <div className="grid gap-3">
                      <label className="ml-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                        {t("createJob.cleaning.label")}
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
                          <span className="font-bold text-lg">
                            {t(`createJob.cleaning.${type.id}`)}
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
                        {t("createJob.cooking.label")}
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
                          <span className="font-bold text-lg">
                            {t(`createJob.cooking.${count.id}`)}
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
                      fromLabel={t("createJob.pickup.fromLabel")}
                      toLabel={t("createJob.pickup.toLabel")}
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
                      fromPlaceholder={t("createJob.pickup.fromPlaceholder")}
                      toPlaceholder={t("createJob.pickup.toPlaceholder")}
                    />
                  </div>
                )}

                {/* Nanny Kids Count */}
                {jobData.service_type === "nanny" && (
                  <div className="space-y-4">
                    <div className="grid gap-3">
                      <label className="ml-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                        {t("createJob.nanny.label")}
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
                          <span className="font-bold text-lg">
                            {t(`createJob.nanny.${count.id}`)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Technical Help — free-form description */}
                {jobData.service_type === "technical_help" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {t("createJob.technical.label")}
                    </label>
                    <Textarea
                      placeholder={t("createJob.technical.placeholder")}
                      value={jobData.service_details.description || ""}
                      onChange={(e) =>
                        updateServiceDetail("description", e.target.value)
                      }
                      className="min-h-[140px] resize-none rounded-2xl border-slate-200/90 bg-white text-base dark:border-white/[0.12] dark:bg-white/[0.04]"
                    />
                  </div>
                )}

                {/* Other Help: subcategory already chosen on step 1 — show it + extra details */}
                {jobData.service_type === "other_help" && (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <label className="ml-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                        {t("createJob.otherHelp.label")}
                      </label>
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded-2xl p-4 shadow-sm",
                          JOB_CHOICE_IDLE,
                        )}
                      >
                        <div className="flex-shrink-0">
                          {
                            OTHER_HELP_TYPES.find(
                              (x) => x.id === jobData.service_details.other_type,
                            )?.icon
                          }
                        </div>
                        <span className="flex-1 text-base font-bold leading-snug">
                          {jobData.service_details.other_type
                            ? t(
                                `otherHelpSubcategories.${jobData.service_details.other_type}`,
                              )
                            : ""}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                          onClick={() => {
                            setStep(1);
                            setOtherHelpSubOpen(true);
                          }}
                        >
                          {t("createJob.savedLocation.change")}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {t("createJob.otherHelp.additionalDetailsLabel")}
                      </label>
                      <Input
                        placeholder={t("createJob.otherHelp.additionalDetailsPlaceholder")}
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

            {/* Bottom Navigation Actions (Steps 2-9 only) */}
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
                        {t("createJob.nav.submit")}
                        <Sparkles className="ml-2 h-6 w-6 text-white" />
                      </>
                    )
                  ) : step === 5 || step === 7 || step === 8 ? (
                    <>
                      {step === 5 && !jobData.budget_amount.trim()
                        ? t("createJob.nav.skip")
                        : step === 7 && !jobData.additional_notes.trim()
                          ? t("createJob.nav.skip")
                          : step === 8 && composeMedia.length === 0
                            ? t("createJob.nav.skip")
                            : t("createJob.nav.next")}
                      <ChevronRight className="ml-2 h-6 w-6" />
                    </>
                  ) : (
                    <>
                      {t("createJob.nav.next")}
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
                  <HeaderBackChevron className="mr-2" /> {t("createJob.nav.back")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
