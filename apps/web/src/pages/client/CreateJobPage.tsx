import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { apiPost } from "@/lib/api";
import { getCityFromLocation } from "@/lib/location";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Baby, 
  Clock, 
  MapPin, 
  DollarSign, 
  Heart, 
  ArrowLeft, 
  ArrowRight,
  Loader2,
  Sparkles,
  Navigation,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";

const CARE_TYPES = [
  { id: "occasional", label: "One-time / Occasional", icon: "🎯" },
  { id: "part_time", label: "Part-time", icon: "⏰" },
  { id: "full_time", label: "Full-time", icon: "💼" },
];

const CHILDREN_COUNTS = [
  { value: 1, label: "1 child" },
  { value: 2, label: "2 children" },
  { value: 3, label: "3 children" },
  { value: 4, label: "4+ children" },
];

const AGE_GROUPS = [
  { id: "newborn", label: "Newborn (0-6 mo)", icon: "👶" },
  { id: "infant", label: "Infant (6-12 mo)", icon: "🍼" },
  { id: "toddler", label: "Toddler (1-3 yr)", icon: "🧸" },
  { id: "preschool", label: "Preschool (3-5 yr)", icon: "🎨" },
  { id: "school_age", label: "School Age (5+ yr)", icon: "📚" },
  { id: "mixed", label: "Mixed Ages", icon: "👨‍👩‍👧‍👦" },
];

const SHIFT_OPTIONS = [
  { id: "up_to_4", label: "Up to 4 hours" },
  { id: "4_8", label: "4-8 hours" },
  { id: "full_day", label: "Full day" },
  { id: "night", label: "Night shift" },
];

const REQUIREMENTS = [
  { id: "first_aid", label: "First Aid Certified", icon: "🩹" },
  { id: "newborn", label: "Newborn Experience", icon: "👶" },
  { id: "special_needs", label: "Special Needs Experience", icon: "💜" },
];

const STORAGE_KEY = "create_job_form_data";
const MIN_BUDGET = 20;
const MAX_BUDGET = 200;
const BUDGET_STEP = 5;

interface JobData {
  care_type: string;
  children_count: number;
  children_age_group: string;
  location_city: string;
  shift_hours: string;
  requirements: string[];
  budget_min: number | null;
  budget_max: number | null;
}

export default function CreateJobPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
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
        const hasData = savedJobData.care_type || 
          savedJobData.location_city || 
          savedJobData.shift_hours ||
          (savedJobData.budget_min !== null) ||
          (savedJobData.budget_max !== null) ||
          (savedJobData.requirements && savedJobData.requirements.length > 0);
        
        if (hasData) {
          return {
            care_type: savedJobData.care_type || "",
            children_count: savedJobData.children_count || 1,
            children_age_group: savedJobData.children_age_group || "",
            location_city: savedJobData.location_city || "",
            shift_hours: savedJobData.shift_hours || "",
            requirements: savedJobData.requirements || [],
            budget_min: savedJobData.budget_min ?? null,
            budget_max: savedJobData.budget_max ?? null,
          } as JobData;
        }
      }
    } catch (error) {
      console.error("Error loading saved form data:", error);
    }
    // Return defaults if no saved data
    return {
      care_type: "",
      children_count: 1,
      children_age_group: "",
      location_city: "",
      shift_hours: "",
      requirements: [],
      budget_min: null,
      budget_max: null,
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

  const totalSteps = 6;

  function updateField<K extends keyof JobData>(field: K, value: JobData[K]) {
    setJobData((prev) => ({ ...prev, [field]: value }));
  }

  function toggleRequirement(req: string) {
    setJobData((prev) => ({
      ...prev,
      requirements: prev.requirements.includes(req)
        ? prev.requirements.filter((r) => r !== req)
        : [...prev.requirements, req],
    }));
  }

  function canProceed(): boolean {
    switch (step) {
      case 1: return !!jobData.care_type;
      case 2: return jobData.children_count > 0;
      case 3: return !!jobData.children_age_group;
      case 4: return !!jobData.location_city;
      case 5: return !!jobData.shift_hours;
      case 6: return true;
      default: return false;
    }
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
      navigate(`/client/jobs/${result.job_id}/confirmed`);
    } catch (err) {
      console.error("[CreateJobPage] Error creating job:", err);
      setError(err instanceof Error ? err.message : "Failed to create job");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen gradient-mesh p-4 pb-32 md:pb-24">
      <div className="max-w-lg mx-auto pt-8">
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

        <Card className="border-0 shadow-xl animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {step === 1 && <><Baby className="w-5 h-5 text-primary" /> Type of Care</>}
              {step === 2 && <><Heart className="w-5 h-5 text-primary" /> How Many Children?</>}
              {step === 3 && <><Sparkles className="w-5 h-5 text-primary" /> Age Group</>}
              {step === 4 && <><MapPin className="w-5 h-5 text-primary" /> Location</>}
              {step === 5 && <><Clock className="w-5 h-5 text-primary" /> Duration</>}
              {step === 6 && <><DollarSign className="w-5 h-5 text-primary" /> Budget & Requirements</>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="p-3 mb-4 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Step 1: Care Type */}
            {step === 1 && (
              <div className="grid gap-3">
                {CARE_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => { updateField("care_type", type.id); setStep(2); }}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
                      jobData.care_type === type.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <span className="text-2xl">{type.icon}</span>
                    <span className="font-medium">{type.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Step 2: Children Count */}
            {step === 2 && (
              <div className="grid grid-cols-2 gap-3">
                {CHILDREN_COUNTS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { updateField("children_count", opt.value); setStep(3); }}
                    className={cn(
                      "p-6 rounded-xl border-2 transition-all text-center",
                      jobData.children_count === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <span className="text-3xl font-bold text-primary">{opt.value === 4 ? "4+" : opt.value}</span>
                    <p className="text-sm text-muted-foreground mt-1">{opt.label}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Step 3: Age Group */}
            {step === 3 && (
              <div className="grid grid-cols-2 gap-3">
                {AGE_GROUPS.map((age) => (
                  <button
                    key={age.id}
                    onClick={() => { updateField("children_age_group", age.id); setStep(4); }}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-all text-center",
                      jobData.children_age_group === age.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <span className="text-2xl">{age.icon}</span>
                    <p className="text-sm font-medium mt-2">{age.label}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Step 4: Location */}
            {step === 4 && (
              <div className="space-y-4">
                {/* Show saved location option if available */}
                {profile?.city && !jobData.location_city && (
                  <div className="p-4 rounded-lg border-2 border-primary/20 bg-primary/5">
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
                      ? "We'll match you with nannies in your area"
                      : "Click the GPS icon to automatically detect your location"}
                  </p>
                </div>
              </div>
            )}

            {/* Step 5: Shift Duration */}
            {step === 5 && (
              <div className="grid grid-cols-2 gap-3">
                {SHIFT_OPTIONS.map((shift) => (
                  <button
                    key={shift.id}
                    onClick={() => { updateField("shift_hours", shift.id); setStep(6); }}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-all text-center",
                      jobData.shift_hours === shift.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <Clock className="w-6 h-6 mx-auto mb-2 text-primary" />
                    <p className="font-medium">{shift.label}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Step 6: Budget & Requirements */}
            {step === 6 && (
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-medium mb-4 block">
                    Hourly Budget Range (optional)
                  </label>
                  
                  {/* Budget Range Slider */}
                  <div className="space-y-6">
                    {/* Min Budget Slider */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Minimum Rate</span>
                        <span className="text-2xl font-bold text-primary">
                          ₪{jobData.budget_min || MIN_BUDGET}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="range"
                          min={MIN_BUDGET}
                          max={jobData.budget_max || MAX_BUDGET}
                          step={BUDGET_STEP}
                          value={jobData.budget_min || MIN_BUDGET}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            if (!jobData.budget_max || value <= jobData.budget_max) {
                              updateField("budget_min", value);
                            }
                          }}
                          className="w-full h-3 bg-muted rounded-lg appearance-none cursor-pointer slider"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>₪{MIN_BUDGET}</span>
                          <span>₪{jobData.budget_max || MAX_BUDGET}</span>
                        </div>
                      </div>
                    </div>

                    {/* Max Budget Slider */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Maximum Rate</span>
                        <span className="text-2xl font-bold text-primary">
                          ₪{jobData.budget_max || MAX_BUDGET}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="range"
                          min={jobData.budget_min || MIN_BUDGET}
                          max={MAX_BUDGET}
                          step={BUDGET_STEP}
                          value={jobData.budget_max || MAX_BUDGET}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            if (!jobData.budget_min || value >= jobData.budget_min) {
                              updateField("budget_max", value);
                            }
                          }}
                          className="w-full h-3 bg-muted rounded-lg appearance-none cursor-pointer slider"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>₪{jobData.budget_min || MIN_BUDGET}</span>
                          <span>₪{MAX_BUDGET}</span>
                        </div>
                      </div>
                    </div>

                    {/* Budget Summary */}
                    <div className="pt-2 pb-1 text-center">
                      <p className="text-sm text-muted-foreground">
                        Range: <span className="font-semibold text-foreground">₪{jobData.budget_min || MIN_BUDGET}</span> - <span className="font-semibold text-foreground">₪{jobData.budget_max || MAX_BUDGET}</span> per hour
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          updateField("budget_min", null);
                          updateField("budget_max", null);
                        }}
                        className="mt-2 text-xs"
                      >
                        Clear budget
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-3 block">
                    Special Requirements (optional)
                  </label>
                  <div className="grid gap-2">
                    {REQUIREMENTS.map((req) => (
                      <button
                        key={req.id}
                        onClick={() => toggleRequirement(req.id)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left",
                          jobData.requirements.includes(req.id)
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <span>{req.icon}</span>
                        <span className="text-sm font-medium">{req.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
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
              
              {step < 6 && step !== 1 && step !== 2 && step !== 3 && step !== 5 && (
                <Button 
                  onClick={() => setStep(step + 1)}
                  disabled={!canProceed()}
                  className="flex-1"
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}

              {step === 6 && (
                <Button 
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Finding Nannies...
                    </>
                  ) : (
                    <>
                      Find My Nanny
                      <Sparkles className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

