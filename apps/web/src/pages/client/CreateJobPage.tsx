import { useState, useEffect, useRef, type ReactNode } from "react";
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
  Loader2,
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
  Soup
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SERVICE_CATEGORIES, isServiceCategoryId } from "@/lib/serviceCategories";

const SERVICE_TYPE_ICONS: Record<string, ReactNode> = {
  cleaning: <Sparkles className="w-8 h-8 text-primary" />,
  cooking: <Soup className="w-8 h-8 text-orange-500" />,
  pickup_delivery: <Truck className="w-8 h-8 text-blue-500" />,
  nanny: <Baby className="w-8 h-8 text-pink-500" />,
  other_help: <Wrench className="w-8 h-8 text-slate-500" />,
};

const SERVICE_TYPES = SERVICE_CATEGORIES.map((c) => ({
  id: c.id,
  label: c.label,
  description: c.description,
  icon: SERVICE_TYPE_ICONS[c.id],
}));

// Step 2: Care Frequency
const CARE_FREQUENCIES = [
  { id: "one_time", label: "One time", icon: <Calendar className="w-8 h-8 text-primary" /> },
  { id: "part_time", label: "Part time", icon: <Timer className="w-8 h-8 text-emerald-500" /> },
  { id: "regularly", label: "Regularly", icon: <Repeat className="w-8 h-8 text-indigo-500" /> },
];

// Step 4: Time Duration
const TIME_DURATIONS = [
  { id: "1_2_hours", label: "1-2 hours", icon: <Hourglass className="w-8 h-8 text-amber-500" /> },
  { id: "3_4_hours", label: "3-4 hours", icon: <Watch className="w-8 h-8 text-emerald-500" /> },
  { id: "5_6_hours", label: "5-6 hours", icon: <HistoryIcon className="w-8 h-8 text-blue-500" /> },
  { id: "full_day", label: "Full day", icon: <Sun className="w-8 h-8 text-orange-500" /> },
];

// Step 5: Service-specific options
const CLEANING_TYPES = [
  { id: "house", label: "House cleaning", icon: <Home className="w-8 h-8 text-primary" /> },
  { id: "office", label: "Office cleaning", icon: <Building2 className="w-8 h-8 text-slate-500" /> },
  { id: "garden", label: "Garden (outdoor)", icon: <Trees className="w-8 h-8 text-emerald-600" /> },
];

const COOKING_PEOPLE_COUNTS = [
  { id: "1_4", label: "1-4 people", icon: <User className="w-8 h-8 text-primary" /> },
  { id: "4_6", label: "4-6 people", icon: <Users className="w-8 h-8 text-primary" /> },
  { id: "6_10", label: "6-10 people", icon: <Users className="w-8 h-8 text-primary" /> },
  { id: "10_plus", label: "10+ people", icon: <UserPlus className="w-8 h-8 text-primary" /> },
];

const NANNY_KIDS_COUNTS = [
  { id: "1_2", label: "1-2 kids", icon: <Baby className="w-8 h-8 text-primary" /> },
  { id: "2_4", label: "2-4 kids", icon: <Baby className="w-8 h-8 text-primary" /> },
  { id: "4_6", label: "4-6 kids", icon: <Users className="w-8 h-8 text-primary" /> },
  { id: "8_plus", label: "8+ kids", icon: <UserPlus className="w-8 h-8 text-primary" /> },
];

const OTHER_HELP_TYPES = [
  { id: "technical", label: "Technical", icon: <Wrench className="w-8 h-8 text-slate-600" /> },
  { id: "heavy_lifting", label: "Heavy lifting", icon: <Dumbbell className="w-8 h-8 text-slate-800" /> },
  { id: "caregiving", label: "Caregiving (Olders)", icon: <Heart className="w-8 h-8 text-red-500" /> },
];

const STORAGE_KEY = "create_job_form_data";

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
        const hasData = savedJobData.service_type ||
          savedJobData.location_city ||
          savedJobData.time_duration ||
          savedJobData.care_frequency ||
          (savedJobData.service_details && Object.keys(savedJobData.service_details).length > 0);

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

  // Show saved location when reaching step 4 (location step)
  useEffect(() => {
    if (step === 4 && profile?.city && !savedLocationShown && !jobData.location_city) {
      setSavedLocationShown(true);
    }
  }, [step, profile?.city, savedLocationShown, jobData.location_city]);

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

  const totalSteps = 5;

  function canProceed(): boolean {
    switch (step) {
      case 1: return !!jobData.service_type;
      case 2: return !!jobData.care_frequency;
      case 3: return !!jobData.location_city;
      case 4: return !!jobData.time_duration;
      case 5: {
        // Check service-specific details based on service_type
        if (jobData.service_type === "cleaning") {
          return !!jobData.service_details.cleaning_type;
        } else if (jobData.service_type === "cooking") {
          return !!jobData.service_details.people_count;
        } else if (jobData.service_type === "pickup_delivery") {
          return !!jobData.service_details.from_address && !!jobData.service_details.to_address;
        } else if (jobData.service_type === "nanny") {
          return !!jobData.service_details.kids_count;
        } else if (jobData.service_type === "other_help") {
          return !!jobData.service_details.other_type;
        }
        return false;
      }
      default: return false;
    }
  }

  function updateField<K extends keyof JobData>(field: K, value: JobData[K]) {
    setJobData((prev) => ({ ...prev, [field]: value }));
  }

  function updateServiceDetail<K extends keyof JobData["service_details"]>(
    field: K,
    value: JobData["service_details"][K]
  ) {
    setJobData((prev) => ({
      ...prev,
      service_details: { ...prev.service_details, [field]: value },
    }));
  }

  function handleUseSavedLocation() {
    if (profile?.city) {
      updateField("location_city", profile.city);
      addToast({
        title: "Location set",
        description: `Using your saved location: ${profile.city}`,
        variant: "success",
      });
    }
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
        }
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

  return (
    <div className="min-h-screen gradient-mesh pb-6 md:pb-8">
      <div className="app-desktop-shell pt-8">
        <div className="app-desktop-centered-wide">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Step {step} of {totalSteps}
            </span>
            <span className="text-sm font-medium text-primary">
              {Math.round((step / totalSteps) * 100)}%
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full gradient-primary transition-all duration-300"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        <div className="animate-fade-in">
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2 mb-6 text-foreground">
            {step === 1 && <><Sparkles className="w-5 h-5 text-primary shrink-0" /> Type of Help</>}
            {step === 2 && <><Clock className="w-5 h-5 text-primary shrink-0" /> Type of Care</>}
            {step === 3 && <><MapPin className="w-5 h-5 text-primary shrink-0" /> Location</>}
            {step === 4 && <><Clock className="w-5 h-5 text-primary shrink-0" /> Time Duration</>}
            {step === 5 && <><Heart className="w-5 h-5 text-primary shrink-0" /> Service Details</>}
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
                {SERVICE_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => { updateField("service_type", type.id); setStep(2); }}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left group relative overflow-hidden bg-card shadow-sm",
                      jobData.service_type === type.id
                        ? "border-primary bg-primary/10 shadow-lg shadow-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:border-primary/50 hover:bg-muted/30"
                    )}
                  >
                    <div className="flex-shrink-0">
                      {type.icon}
                    </div>
                    <div className="flex-1">
                      <span className="font-bold text-base block leading-none">{type.label}</span>
                      {type.description && <span className="text-xs text-muted-foreground mt-1 block">{type.description}</span>}
                    </div>
                    <ArrowRight className={cn(
                      "w-4 h-4 transition-all duration-300 opacity-0 -translate-x-2",
                      jobData.service_type === type.id ? "opacity-100 translate-x-0 text-primary" : "group-hover:opacity-100 group-hover:translate-x-0"
                    )} />
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
                    onClick={() => { updateField("care_frequency", freq.id); setStep(3); }}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left group bg-card shadow-sm",
                      jobData.care_frequency === freq.id
                        ? "border-primary bg-primary/10 shadow-lg shadow-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/30"
                    )}
                  >
                    <div className="flex-shrink-0">
                      {freq.icon}
                    </div>
                    <span className="font-bold text-base">{freq.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Step 3: Location */}
            {step === 3 && (
              <div className="space-y-4">
                {/* Show saved location option if available */}
                {profile?.city && !jobData.location_city && (
                  <div className="p-4 rounded-2xl border-2 border-primary/20 bg-card shadow-sm">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-sm mb-1">Use your saved location?</p>
                        <p className="text-sm text-muted-foreground mb-3">
                          We found a saved location: <span className="font-medium">{profile.city}</span>
                        </p>
                        <Button
                          onClick={handleUseSavedLocation}
                          size="sm"
                          className="w-full"
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Use {profile.city}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Location input */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter your city"
                      value={jobData.location_city}
                      onChange={(e) => updateField("location_city", e.target.value)}
                      className="text-lg h-14 flex-1"
                      autoFocus={!profile?.city || !!jobData.location_city}
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
                  <p className="text-sm text-muted-foreground">
                    {profile?.city && jobData.location_city !== profile.city
                      ? "We'll match you with helpers in your area"
                      : "Click the GPS icon to automatically detect your location"}
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Time Duration */}
            {step === 4 && (
              <div className="grid grid-cols-2 gap-3">
                {TIME_DURATIONS.map((duration) => (
                  <button
                    key={duration.id}
                    onClick={() => { updateField("time_duration", duration.id); setStep(5); }}
                    className={cn(
                      "p-4 rounded-2xl border-2 transition-all text-center flex flex-col items-center justify-center gap-2 group bg-card shadow-sm",
                      jobData.time_duration === duration.id
                        ? "border-primary bg-primary/10 shadow-lg shadow-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/30"
                    )}
                  >
                    <div className="flex-shrink-0 mb-1">
                      {duration.icon}
                    </div>
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
                      <label className="text-sm font-medium text-muted-foreground ml-1">Type of cleaning</label>
                      {CLEANING_TYPES.map((type) => (
                        <button
                          key={type.id}
                          onClick={() => updateServiceDetail("cleaning_type", type.id)}
                          className={cn(
                            "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left group bg-card shadow-sm",
                            jobData.service_details.cleaning_type === type.id
                              ? "border-primary bg-primary/10 shadow-lg shadow-primary/5"
                              : "border-border hover:border-primary/50 hover:bg-muted/30"
                          )}
                        >
                          <div className="flex-shrink-0">
                            {type.icon}
                          </div>
                          <span className="font-bold text-base">{type.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cooking People Count */}
                {jobData.service_type === "cooking" && (
                  <div className="space-y-4">
                    <div className="grid gap-3">
                      <label className="text-sm font-medium text-muted-foreground ml-1">How many people?</label>
                      {COOKING_PEOPLE_COUNTS.map((count) => (
                        <button
                          key={count.id}
                          onClick={() => updateServiceDetail("people_count", count.id)}
                          className={cn(
                            "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left group bg-card shadow-sm",
                            jobData.service_details.people_count === count.id
                              ? "border-primary bg-primary/10 shadow-lg shadow-primary/5"
                              : "border-border hover:border-primary/50 hover:bg-muted/30"
                          )}
                        >
                          <div className="flex-shrink-0">
                            {count.icon}
                          </div>
                          <span className="font-bold text-base">{count.label}</span>
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
                      <label className="text-sm font-medium text-muted-foreground ml-1">How many kids?</label>
                      {NANNY_KIDS_COUNTS.map((count) => (
                        <button
                          key={count.id}
                          onClick={() => updateServiceDetail("kids_count", count.id)}
                          className={cn(
                            "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left group bg-card shadow-sm",
                            jobData.service_details.kids_count === count.id
                              ? "border-primary bg-primary/10 shadow-lg shadow-primary/5"
                              : "border-border hover:border-primary/50 hover:bg-muted/30"
                          )}
                        >
                          <div className="flex-shrink-0">
                            {count.icon}
                          </div>
                          <span className="font-bold text-base">{count.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Other Help Type */}
                {jobData.service_type === "other_help" && (
                  <div className="space-y-4">
                    <div className="grid gap-3">
                      <label className="text-sm font-medium text-muted-foreground ml-1">Type of help</label>
                      {OTHER_HELP_TYPES.map((type) => (
                        <button
                          key={type.id}
                          onClick={() => updateServiceDetail("other_type", type.id)}
                          className={cn(
                            "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left group bg-card shadow-sm",
                            jobData.service_details.other_type === type.id
                              ? "border-primary bg-primary/10 shadow-lg shadow-primary/5"
                              : "border-border hover:border-primary/50 hover:bg-muted/30"
                          )}
                        >
                          <div className="flex-shrink-0">
                            {type.icon}
                          </div>
                          <span className="font-bold text-base">{type.label}</span>
                        </button>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Additional details (optional)</label>
                      <Input
                        placeholder="Describe what you need help with..."
                        value={jobData.service_details.description || ""}
                        onChange={(e) => updateServiceDetail("description", e.target.value)}
                        className="text-lg h-14"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 mt-6">
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
      </div>
    </div>
  );
}

