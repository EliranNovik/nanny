import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Briefcase, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Role = "client" | "freelancer";

export default function OnboardingPage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  console.log("[OnboardingPage] Render", {
    hasUser: !!user,
    userId: user?.id,
    profileState: profile === undefined ? "undefined" : profile === null ? "null" : "exists",
    profile,
    authLoading,
    step,
  });

  async function handleSubmit() {
    console.log("[OnboardingPage] handleSubmit called", { role, fullName, city, userId: user?.id });

    if (!role || !fullName.trim() || !city.trim()) {
      console.log("[OnboardingPage] Validation failed");
      setError("Please fill in all fields");
      return;
    }

    if (!user) {
      console.error("[OnboardingPage] No user found!");
      setError("You must be logged in");
      return;
    }

    setLoading(true);
    setError("");

    console.log("[OnboardingPage] Upserting profile...");
    // Upsert profile
    const { error: profileError, data: profileData } = await supabase.from("profiles").upsert({
      id: user.id,
      role,
      full_name: fullName.trim(),
      city: city.trim(),
    }).select();

    console.log("[OnboardingPage] Profile upsert result", { profileError, profileData });

    if (profileError) {
      console.error("[OnboardingPage] Profile error", profileError);
      setError(profileError.message);
      setLoading(false);
      return;
    }

    // If freelancer, also create freelancer_profiles entry
    if (role === "freelancer") {
      console.log("[OnboardingPage] Creating freelancer profile...");
      const { error: freelancerError } = await supabase.from("freelancer_profiles").upsert({
        user_id: user.id,
      });
      console.log("[OnboardingPage] Freelancer profile result", { freelancerError });
    }

    console.log("[OnboardingPage] Refreshing profile...");
    await refreshProfile();
    console.log("[OnboardingPage] Profile refreshed, navigating...");
    setLoading(false);

    // Navigate based on role
    if (role === "client") {
      console.log("[OnboardingPage] Navigating to /dashboard");
      navigate("/dashboard", { replace: true });
    } else {
      console.log("[OnboardingPage] Navigating to /freelancer/profile");
      navigate("/freelancer/profile", { replace: true });
    }
  }

  // Show loading if auth is still loading or no user
  if (authLoading) {
    console.log("[OnboardingPage] Showing loading", { authLoading, hasUser: !!user });
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Redirect to login if no user after loading completes
  if (!user) {
    console.log("[OnboardingPage] No user, redirecting to login");
    navigate("/login", { replace: true });
    return null;
  }

  console.log("[OnboardingPage] Rendering onboarding form");
  return (
    <div className="min-h-screen gradient-mesh flex items-center justify-center p-4">
      <div className="w-full max-w-lg animate-fade-in">
        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {step === 1 ? "What brings you here?" : "Tell us about yourself"}
            </CardTitle>
            <CardDescription>
              {step === 1 
                ? "Choose how you want to use NannyNow"
                : "Just a few quick details to get started"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="p-3 mb-4 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-4">
                <button
                  onClick={() => { setRole("client"); setStep(2); }}
                  className={cn(
                    "flex items-center gap-4 p-6 rounded-xl border-2 transition-all duration-200 text-left",
                    role === "client" 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-secondary flex items-center justify-center">
                    <Users className="w-7 h-7 text-secondary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">I need a nanny</h3>
                    <p className="text-sm text-muted-foreground">
                      Find trusted childcare providers quickly
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => { setRole("freelancer"); setStep(2); }}
                  className={cn(
                    "flex items-center gap-4 p-6 rounded-xl border-2 transition-all duration-200 text-left",
                    role === "freelancer" 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center">
                    <Briefcase className="w-7 h-7 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">I'm a nanny</h3>
                    <p className="text-sm text-muted-foreground">
                      Get matched with families who need you
                    </p>
                  </div>
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Your Name</Label>
                  <Input
                    id="fullName"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="e.g., Tel Aviv"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setStep(1)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button 
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? "Saving..." : "Continue"}
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


