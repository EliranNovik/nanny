import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "@/lib/api";
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
  Sparkles
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
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [jobData, setJobData] = useState<JobData>({
    care_type: "",
    children_count: 1,
    children_age_group: "",
    location_city: "",
    shift_hours: "",
    requirements: [],
    budget_min: null,
    budget_max: null,
  });

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
      navigate(`/client/jobs/${result.job_id}/confirmed`);
    } catch (err) {
      console.error("[CreateJobPage] Error creating job:", err);
      setError(err instanceof Error ? err.message : "Failed to create job");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen gradient-mesh p-4 pb-24">
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
                <Input
                  placeholder="Enter your city"
                  value={jobData.location_city}
                  onChange={(e) => updateField("location_city", e.target.value)}
                  className="text-lg h-14"
                  autoFocus
                />
                <p className="text-sm text-muted-foreground">
                  We'll match you with nannies in your area
                </p>
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
                  <label className="text-sm font-medium mb-3 block">
                    Hourly Budget Range (optional)
                  </label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      placeholder="Min ₪"
                      value={jobData.budget_min || ""}
                      onChange={(e) => updateField("budget_min", e.target.value ? Number(e.target.value) : null)}
                      className="text-center"
                    />
                    <span className="text-muted-foreground">—</span>
                    <Input
                      type="number"
                      placeholder="Max ₪"
                      value={jobData.budget_max || ""}
                      onChange={(e) => updateField("budget_max", e.target.value ? Number(e.target.value) : null)}
                      className="text-center"
                    />
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

