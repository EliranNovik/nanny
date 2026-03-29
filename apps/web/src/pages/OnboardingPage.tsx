import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Briefcase, ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

type Role = "client" | "freelancer";

export default function OnboardingPage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registrationEmail, setRegistrationEmail] = useState("");
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const checkInitiatedRef = useRef(false);

  // Check for role in URL params and pre-select it
  useEffect(() => {
    const roleParam = searchParams.get("role");
    if (roleParam === "client" || roleParam === "freelancer") {
      setRole(roleParam);
      setStep(2); // Skip role selection step
    }
  }, [searchParams]);

  // Check if profile already exists in database (even if context hasn't loaded it)
  // This should run FIRST before checking for pending profile
  useEffect(() => {
    async function checkExistingProfile() {
      // Prevent multiple simultaneous checks
      if (!user || profile || authLoading || checkingProfile || profileChecked || checkInitiatedRef.current) {
        return;
      }

      checkInitiatedRef.current = true;
      setCheckingProfile(true);
      console.log("[OnboardingPage] Checking for existing profile...");

      try {
        // First check if profile exists in database directly
        const { data: existingProfile, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          console.error("[OnboardingPage] Error checking profile", error);
          setCheckingProfile(false);
          return;
        }

        if (existingProfile) {
          console.log("[OnboardingPage] Profile already exists in database, redirecting immediately...", existingProfile);
          setProfileChecked(true);
          setCheckingProfile(false);
          // Clear any pending profile
          localStorage.removeItem("pendingProfile");
          
          // Navigate immediately without waiting for anything
          if (existingProfile.role === "client") {
            navigate("/dashboard", { replace: true });
          } else {
            navigate("/freelancer/dashboard", { replace: true });
          }
          
          // Try to refresh profile in context in background (don't wait)
          refreshProfile().catch(() => {
            // Ignore errors, profile exists in DB
          });
          
          return;
        }

        // No profile exists in DB, check for pending profile
        const pendingProfile = localStorage.getItem("pendingProfile");
        if (pendingProfile) {
          try {
            const profileData = JSON.parse(pendingProfile);
            console.log("[OnboardingPage] Found pending profile, creating...", profileData);
            setRole(profileData.role);
            setFullName(profileData.fullName);
            setCity(profileData.city);
            setRegistrationEmail(profileData.email);
            
            // Create the profile now that user is verified
            console.log("[OnboardingPage] Calling createProfile...");
            try {
              await createProfile();
              console.log("[OnboardingPage] createProfile completed successfully");
              // Don't set checkingProfile to false here - let createProfile handle navigation
            } catch (createError) {
              console.error("[OnboardingPage] Error in createProfile", createError);
              setError("Failed to create profile. Please try again.");
              setCheckingProfile(false);
              checkInitiatedRef.current = false; // Allow retry
            }
          } catch (e) {
            console.error("[OnboardingPage] Error parsing pending profile", e);
            setCheckingProfile(false);
          }
        } else {
          setCheckingProfile(false);
        }
      } catch (err) {
        console.error("[OnboardingPage] Error in checkExistingProfile", err);
        setCheckingProfile(false);
      }
    }

    // Only run if we have a user, no profile in context, not loading, and haven't checked yet
    if (user && !profile && !authLoading && !checkingProfile && !profileChecked) {
      checkExistingProfile();
    }
  }, [user, profile, authLoading, checkingProfile, profileChecked, navigate, refreshProfile]);

  // Show loading while checking authentication (only briefly)
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Allow page to render even without user - they'll need to login when submitting

  console.log("[OnboardingPage] Render", {
    hasUser: !!user,
    userId: user?.id,
    profileState: profile === undefined ? "undefined" : profile === null ? "null" : "exists",
    profile,
    authLoading,
    step,
  });

  async function handleNameCitySubmit() {
    console.log("[OnboardingPage] handleNameCitySubmit called", { role, fullName, city });

    if (!role || !fullName.trim() || !city.trim()) {
      console.log("[OnboardingPage] Validation failed");
      setError("Please fill in all fields");
      return;
    }

    // If not logged in, move to registration step
    if (!user) {
      console.log("[OnboardingPage] No user, moving to registration step");
      setStep(3);
      return;
    }

    // If user is logged in, proceed to create profile
    await createProfile();
  }

  async function handleRegister() {
    console.log("[OnboardingPage] handleRegister called", { email, password, role, fullName, city });

    if (!email.trim() || !password.trim()) {
      setError("Please fill in email and password");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError("");

    // Register the user directly with Supabase to get full response
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
    });
    
    if (signUpError) {
      console.error("[OnboardingPage] Sign up error", signUpError);
      setError(signUpError.message || "Failed to create account. Please try again.");
      setLoading(false);
      return;
    }

    // Check if email confirmation is required
    // If user is null, it means email confirmation is required
    if (!signUpData.user) {
      setError("Failed to create account. Please try again.");
      setLoading(false);
      return;
    }

    // If user exists but session is null, email confirmation is required
    if (signUpData.user && !signUpData.session) {
      console.log("[OnboardingPage] Email confirmation required");
      setRegistrationEmail(email.trim());
      
      // Save profile data to localStorage to create after email verification
      const pendingProfile = {
        role,
        fullName: fullName.trim(),
        city: city.trim(),
        email: email.trim(),
      };
      localStorage.setItem("pendingProfile", JSON.stringify(pendingProfile));
      
      setLoading(false);
      setStep(4); // Move to email verification step
      return;
    }

    // If session exists, user is immediately signed in (email confirmation disabled)
    // Wait a moment for auth state to update
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if user is now available
    const { data: { user: newUser } } = await supabase.auth.getUser();
    
    if (!newUser) {
      setError("Account created but unable to sign in. Please try logging in.");
      setLoading(false);
      return;
    }

    // Now create the profile
    await createProfile();
  }

  async function createProfile() {
    console.log("[OnboardingPage] createProfile START", { loading, role, fullName, city });
    
    // Prevent multiple calls
    if (loading) {
      console.log("[OnboardingPage] createProfile already in progress");
      return;
    }

    setLoading(true);
    setError("");

    // Get current user
    console.log("[OnboardingPage] Getting current user...");
    const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error("[OnboardingPage] Error getting user", userError);
      setError("Unable to get user information. Please try again.");
      setLoading(false);
      return;
    }
    if (!currentUser) {
      console.error("[OnboardingPage] No current user");
      setError("Unable to get user information. Please try again.");
      setLoading(false);
      return;
    }
    console.log("[OnboardingPage] Got user", { userId: currentUser.id });

    // Validate required fields
    if (!role || !fullName.trim() || !city.trim()) {
      console.error("[OnboardingPage] Validation failed", { role, fullName, city });
      setError("Missing required profile information. Please complete the form.");
      setLoading(false);
      return;
    }
    console.log("[OnboardingPage] Validation passed");

    // Check if profile already exists before creating
    const { data: existingProfile, error: checkError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("[OnboardingPage] Error checking for existing profile", checkError);
      // Continue with creation attempt
    } else if (existingProfile) {
      console.log("[OnboardingPage] Profile already exists, skipping creation", existingProfile);
      // Clear pending profile
      localStorage.removeItem("pendingProfile");
      setProfileChecked(true);
      setLoading(false);
      
      // Try to refresh profile (but don't wait if it times out)
      refreshProfile().catch(err => {
        console.warn("[OnboardingPage] Profile refresh failed, but profile exists", err);
      });
      
      // Navigate based on role immediately
      if (existingProfile.role === "client") {
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/freelancer/dashboard", { replace: true });
      }
      return;
    }

    console.log("[OnboardingPage] Upserting profile...", {
      userId: currentUser.id,
      role,
      fullName: fullName.trim(),
      city: city.trim(),
    });

    // Upsert profile
    console.log("[OnboardingPage] Upserting profile to database...", {
      id: currentUser.id,
      role,
      full_name: fullName.trim(),
      city: city.trim(),
    });
    
    const { error: profileError, data: profileData } = await supabase.from("profiles").upsert({
      id: currentUser.id,
      role,
      full_name: fullName.trim(),
      city: city.trim(),
    }).select();

    console.log("[OnboardingPage] Profile upsert result", { 
      hasError: !!profileError, 
      error: profileError, 
      hasData: !!profileData,
      data: profileData 
    });

    if (profileError) {
      console.error("[OnboardingPage] Profile creation FAILED", profileError);
      setError(profileError.message);
      setLoading(false);
      setCheckingProfile(false);
      return;
    }

    if (!profileData || profileData.length === 0) {
      console.error("[OnboardingPage] Profile created but no data returned");
      setError("Profile created but unable to verify. Please refresh the page.");
      setLoading(false);
      setCheckingProfile(false);
      return;
    }

    console.log("[OnboardingPage] Profile created successfully!", profileData[0]);

    // If freelancer, also create freelancer_profiles entry
    if (role === "freelancer") {
      console.log("[OnboardingPage] Creating freelancer profile...");
      const { error: freelancerError } = await supabase.from("freelancer_profiles").upsert({
        user_id: currentUser.id,
      });
      console.log("[OnboardingPage] Freelancer profile result", { freelancerError });
      if (freelancerError) {
        console.error("[OnboardingPage] Freelancer profile error", freelancerError);
        // Don't fail the whole process if freelancer profile fails
      }
    }

    // Clear pending profile from localStorage
    localStorage.removeItem("pendingProfile");
    setProfileChecked(true);
    setCheckingProfile(false);
    setLoading(false);

    console.log("[OnboardingPage] Profile created successfully, navigating NOW...", { role });
    
    // Navigate based on role immediately - use window.location as fallback
    const targetPath = role === "client" ? "/dashboard" : "/freelancer/dashboard";
    console.log("[OnboardingPage] Target path:", targetPath);
    
    // Use window.location immediately for guaranteed navigation
    console.log("[OnboardingPage] Using window.location.href to navigate");
    window.location.href = targetPath;
    
    // Also try React Router navigate as backup (though window.location should work)
    try {
      navigate(targetPath, { replace: true });
    } catch (navError) {
      console.error("[OnboardingPage] React Router navigate failed (but window.location should work)", navError);
    }

    // Try to refresh profile in background (don't wait)
    refreshProfile().catch(err => {
      console.warn("[OnboardingPage] Profile refresh failed, but profile was created", err);
    });
  }

  console.log("[OnboardingPage] Rendering onboarding form");
  return (
    <div className="min-h-screen gradient-mesh flex items-center justify-center p-4 md:py-12">
      <div className="app-desktop-centered-narrow animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {step === 1 
              ? "What brings you here?" 
              : step === 2 
              ? "Tell us about yourself" 
              : step === 3
              ? "Create your account"
              : "Verify your email"}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {step === 1 
              ? "Choose how you want to use NannyNow"
              : step === 2
              ? "Just a few quick details to get started"
              : step === 3
              ? "Create an account to continue"
              : "We've sent you a verification email"}
          </p>
        </div>
        <div>
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
                    "flex items-center gap-4 p-6 rounded-xl border-2 transition-all duration-200 text-left bg-card shadow-sm",
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
                    "flex items-center gap-4 p-6 rounded-xl border-2 transition-all duration-200 text-left bg-card shadow-sm",
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
                    onClick={handleNameCitySubmit}
                    disabled={loading}
                    className="flex-1"
                  >
                    Continue
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Create a password (min. 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setStep(2)}
                    disabled={loading}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button 
                    onClick={handleRegister}
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? "Creating Account..." : "Create Account"}
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center py-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Mail className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold">Check your email</h3>
                    <p className="text-sm text-muted-foreground">
                      We've sent a verification link to
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {registrationEmail || email}
                    </p>
                  </div>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="space-y-1 text-sm">
                      <p className="font-medium text-foreground">Account created successfully!</p>
                      <p className="text-muted-foreground">
                        Please click the verification link in your email to activate your account. 
                        Once verified, you'll be automatically signed in and your profile will be created.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      localStorage.removeItem("pendingProfile");
                      setStep(3);
                    }}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button 
                    onClick={() => navigate("/login")}
                    className="flex-1"
                  >
                    Go to Login
                  </Button>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}


