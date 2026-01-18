import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Save, 
  Bell,
  Globe,
  DollarSign,
  Baby,
  Heart,
  Shield,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FreelancerData {
  bio: string;
  languages: string[];
  has_first_aid: boolean;
  newborn_experience: boolean;
  special_needs_experience: boolean;
  max_children: number;
  hourly_rate_min: number | null;
  hourly_rate_max: number | null;
  available_now: boolean;
  availability_note: string;
}

type RateMode = "single" | "range";

const LANGUAGES = ["Hebrew", "English", "Russian", "Arabic", "French", "Spanish"];

export default function FreelancerProfilePage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rateMode, setRateMode] = useState<RateMode>("single");

  const [data, setData] = useState<FreelancerData>({
    bio: "",
    languages: [],
    has_first_aid: false,
    newborn_experience: false,
    special_needs_experience: false,
    max_children: 2,
    hourly_rate_min: null,
    hourly_rate_max: null,
    available_now: false,
    availability_note: "",
  });

  useEffect(() => {
    async function fetchProfile() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        console.log("[FreelancerProfilePage] Fetching freelancer profile for user", user.id);
        const { data: profile, error } = await supabase
          .from("freelancer_profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          console.error("[FreelancerProfilePage] Error fetching freelancer profile:", error);
          setLoading(false);
          return;
        }

        // If no freelancer_profiles entry exists, redirect to onboarding
        if (!profile) {
          console.log("[FreelancerProfilePage] No freelancer_profiles found, redirecting to onboarding");
          navigate("/onboarding", { replace: true });
          return;
        }

        // Profile exists, load data
        console.log("[FreelancerProfilePage] Profile loaded successfully");
        setData({
          bio: profile.bio || "",
          languages: profile.languages || [],
          has_first_aid: profile.has_first_aid,
          newborn_experience: profile.newborn_experience,
          special_needs_experience: profile.special_needs_experience,
          max_children: profile.max_children,
          hourly_rate_min: profile.hourly_rate_min,
          hourly_rate_max: profile.hourly_rate_max,
          available_now: profile.available_now,
          availability_note: profile.availability_note || "",
        });
        
        // Determine rate mode based on existing data
        if (profile.hourly_rate_min !== null && profile.hourly_rate_max !== null && profile.hourly_rate_min !== profile.hourly_rate_max) {
          setRateMode("range");
        } else {
          setRateMode("single");
        }
      } catch (err: any) {
        console.error("[FreelancerProfilePage] Exception fetching profile:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [user, navigate]);

  function updateField<K extends keyof FreelancerData>(field: K, value: FreelancerData[K]) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function toggleLanguage(lang: string) {
    setData((prev) => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter((l) => l !== lang)
        : [...prev.languages, lang],
    }));
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);

    try {
      console.log("[FreelancerProfilePage] Saving profile:", {
        user_id: user.id,
        available_now: data.available_now,
        max_children: data.max_children
      });

      const { error } = await supabase.from("freelancer_profiles").upsert({
        user_id: user.id,
        ...data,
      });

      if (error) {
        console.error("[FreelancerProfilePage] Error saving profile:", error);
        throw error;
      }

      console.log("[FreelancerProfilePage] Profile saved successfully");
      addToast({
        title: "Profile saved",
        description: "Your freelancer profile has been updated successfully",
        variant: "success",
      });
    } catch (err: any) {
      console.error("[FreelancerProfilePage] Failed to save:", err);
      const errorMessage = err?.message || "Failed to save profile. Please try again.";
      addToast({
        title: "Save failed",
        description: errorMessage,
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-mesh p-4 pb-24">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Your Profile</h1>
            <p className="text-muted-foreground">
              Complete your profile to get matched with families
            </p>
          </div>
          <Button 
            variant="outline"
            onClick={() => navigate("/freelancer/notifications")}
            className="gap-2"
          >
            <Bell className="w-4 h-4" />
            Notifications
          </Button>
        </div>

        <div className="space-y-6 animate-stagger">
          {/* Availability Toggle */}
          <Card className="border-0 shadow-lg overflow-hidden">
            <div className={cn(
              "p-6 transition-colors",
              data.available_now ? "bg-emerald-500/10" : "bg-muted"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center",
                    data.available_now ? "bg-emerald-500" : "bg-muted-foreground/20"
                  )}>
                    {data.available_now ? (
                      <CheckCircle2 className="w-6 h-6 text-white" />
                    ) : (
                      <Bell className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">
                      {data.available_now ? "You're Available!" : "Not Available"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {data.available_now 
                        ? "You'll receive job notifications"
                        : "Toggle on to receive job requests"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={data.available_now}
                  onCheckedChange={(checked) => updateField("available_now", checked)}
                />
              </div>
            </div>
          </Card>

          {/* About */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>About You</CardTitle>
              <CardDescription>Tell families about yourself</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="bio">Bio</Label>
                <textarea
                  id="bio"
                  className="mt-1.5 flex min-h-[100px] w-full rounded-lg border-2 border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Share your experience, what you love about childcare, etc."
                  value={data.bio}
                  onChange={(e) => updateField("bio", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Languages */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Languages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => toggleLanguage(lang)}
                    className={cn(
                      "px-4 py-2 rounded-full border-2 text-sm font-medium transition-all",
                      data.languages.includes(lang)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Experience */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Experience & Skills</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border-2 border-border">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-emerald-500" />
                  <div>
                    <p className="font-medium">First Aid Certified</p>
                    <p className="text-sm text-muted-foreground">CPR & First Aid training</p>
                  </div>
                </div>
                <Switch
                  checked={data.has_first_aid}
                  onCheckedChange={(checked) => updateField("has_first_aid", checked)}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border-2 border-border">
                <div className="flex items-center gap-3">
                  <Baby className="w-5 h-5 text-pink-500" />
                  <div>
                    <p className="font-medium">Newborn Experience</p>
                    <p className="text-sm text-muted-foreground">Care for 0-6 month olds</p>
                  </div>
                </div>
                <Switch
                  checked={data.newborn_experience}
                  onCheckedChange={(checked) => updateField("newborn_experience", checked)}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border-2 border-border">
                <div className="flex items-center gap-3">
                  <Heart className="w-5 h-5 text-purple-500" />
                  <div>
                    <p className="font-medium">Special Needs Experience</p>
                    <p className="text-sm text-muted-foreground">Experience with special needs children</p>
                  </div>
                </div>
                <Switch
                  checked={data.special_needs_experience}
                  onCheckedChange={(checked) => updateField("special_needs_experience", checked)}
                />
              </div>

              <div className="pt-2">
                <Label>Maximum Children</Label>
                <div className="flex gap-2 mt-2">
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      onClick={() => updateField("max_children", num)}
                      className={cn(
                        "w-12 h-12 rounded-lg border-2 font-semibold transition-all",
                        data.max_children === num
                          ? "border-primary bg-primary text-white"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {num === 4 ? "4+" : num}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rates */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  Hourly Rate
                </CardTitle>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "text-sm font-medium transition-colors",
                    rateMode === "single" ? "text-muted-foreground" : "text-foreground"
                  )}>
                    Single
                  </span>
                  <Switch
                    checked={rateMode === "range"}
                    onCheckedChange={(checked) => {
                      const newMode = checked ? "range" : "single";
                      setRateMode(newMode);
                      // When switching to single, set both min and max to the same value
                      if (newMode === "single" && data.hourly_rate_min !== null) {
                        updateField("hourly_rate_max", data.hourly_rate_min);
                      } else if (newMode === "single" && data.hourly_rate_max !== null) {
                        updateField("hourly_rate_min", data.hourly_rate_max);
                      }
                    }}
                  />
                  <span className={cn(
                    "text-sm font-medium transition-colors",
                    rateMode === "range" ? "text-foreground" : "text-muted-foreground"
                  )}>
                    Range
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {rateMode === "single" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Hourly Rate</span>
                    <span className="text-2xl font-bold text-primary">
                      ₪{data.hourly_rate_min || data.hourly_rate_max || 50}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="range"
                      min={20}
                      max={200}
                      step={5}
                      value={data.hourly_rate_min || data.hourly_rate_max || 50}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        updateField("hourly_rate_min", value);
                        updateField("hourly_rate_max", value);
                      }}
                      className="w-full h-3 bg-muted rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>₪20</span>
                      <span>₪200</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Min Rate Slider */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Minimum Rate</span>
                      <span className="text-2xl font-bold text-primary">
                        ₪{data.hourly_rate_min || 20}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min={20}
                        max={data.hourly_rate_max || 200}
                        step={5}
                        value={data.hourly_rate_min || 20}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          if (!data.hourly_rate_max || value <= data.hourly_rate_max) {
                            updateField("hourly_rate_min", value);
                          }
                        }}
                        className="w-full h-3 bg-muted rounded-lg appearance-none cursor-pointer slider"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>₪20</span>
                        <span>₪{data.hourly_rate_max || 200}</span>
                      </div>
                    </div>
                  </div>

                  {/* Max Rate Slider */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Maximum Rate</span>
                      <span className="text-2xl font-bold text-primary">
                        ₪{data.hourly_rate_max || 200}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min={data.hourly_rate_min || 20}
                        max={200}
                        step={5}
                        value={data.hourly_rate_max || 200}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          if (!data.hourly_rate_min || value >= data.hourly_rate_min) {
                            updateField("hourly_rate_max", value);
                          }
                        }}
                        className="w-full h-3 bg-muted rounded-lg appearance-none cursor-pointer slider"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>₪{data.hourly_rate_min || 20}</span>
                        <span>₪200</span>
                      </div>
                    </div>
                  </div>

                  {/* Rate Summary */}
                  <div className="pt-2 pb-1 text-center">
                    <p className="text-sm text-muted-foreground">
                      Range: <span className="font-semibold text-foreground">₪{data.hourly_rate_min || 20}</span> - <span className="font-semibold text-foreground">₪{data.hourly_rate_max || 200}</span> per hour
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Save Button */}
        <div className="mb-24">
          <Button 
            onClick={handleSave}
            disabled={saving}
            className="w-full"
            size="lg"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Profile
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

