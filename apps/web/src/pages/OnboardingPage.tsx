import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Mail, MapPin, Loader2, Users, Heart, Check } from "lucide-react";
import { LandingSiteHeader } from "@/components/LandingSiteHeader";
import { AppBootSplashLogo } from "@/components/AppBootSplash";
import { getLocationDataFromGps } from "@/lib/location";
import { cn } from "@/lib/utils";
import { GoogleIcon } from "@/components/BrandIcons";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";

type Role = "client" | "freelancer";

export default function OnboardingPage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  /** Default: family / hire flow. Use `?role=freelancer` for helpers. */
  const [role, setRole] = useState<Role>("client");
  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  /** Set when user uses "My location" (saved to profiles.location_lat/lng). */
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registrationEmail, setRegistrationEmail] = useState("");
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const checkInitiatedRef = useRef(false);

  // Optional: `?role=freelancer` for helper signup (links from marketing)
  useEffect(() => {
    const roleParam = searchParams.get("role");
    if (roleParam === "client" || roleParam === "freelancer") {
      setRole(roleParam);
    }
  }, [searchParams]);

  // Check if profile already exists in database (even if context hasn't loaded it)
  // This should run FIRST before checking for pending profile
  useEffect(() => {
    async function checkExistingProfile() {
      // Prevent multiple simultaneous checks
      if (
        !user ||
        profile ||
        authLoading ||
        checkingProfile ||
        profileChecked ||
        checkInitiatedRef.current
      ) {
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
          console.log(
            "[OnboardingPage] Profile already exists in database, redirecting immediately...",
            existingProfile,
          );
          setProfileChecked(true);
          setCheckingProfile(false);
          // Clear any pending profile
          localStorage.removeItem("pendingProfile");

          // Navigate immediately without waiting for anything
          if (existingProfile.role === "client") {
            navigate("/client/home", { replace: true });
          } else {
            navigate("/freelancer/home", { replace: true });
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
            console.log(
              "[OnboardingPage] Found pending profile, creating...",
              profileData,
            );
            setRole(profileData.role);
            setFullName(profileData.fullName);
            setCity(profileData.city);
            if (typeof profileData.location_lat === "number")
              setLocationLat(profileData.location_lat);
            if (typeof profileData.location_lng === "number")
              setLocationLng(profileData.location_lng);
            setRegistrationEmail(profileData.email);

            // Create the profile now that user is verified
            console.log("[OnboardingPage] Calling createProfile...");
            try {
              await createProfile();
              console.log(
                "[OnboardingPage] createProfile completed successfully",
              );
              // Don't set checkingProfile to false here - let createProfile handle navigation
            } catch (createError) {
              console.error(
                "[OnboardingPage] Error in createProfile",
                createError,
              );
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
    if (
      user &&
      !profile &&
      !authLoading &&
      !checkingProfile &&
      !profileChecked
    ) {
      checkExistingProfile();
    }
  }, [
    user,
    profile,
    authLoading,
    checkingProfile,
    profileChecked,
    navigate,
    refreshProfile,
  ]);

  // Show loading while checking authentication (only briefly)
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50/50 dark:bg-background flex flex-col">
        <LandingSiteHeader />
        <main className="flex flex-1 items-center justify-center pt-28 md:pt-36">
          <AppBootSplashLogo />
        </main>
      </div>
    );
  }

  // Allow page to render even without user - they'll need to login when submitting

  console.log("[OnboardingPage] Render", {
    hasUser: !!user,
    userId: user?.id,
    profileState:
      profile === undefined
        ? "undefined"
        : profile === null
          ? "null"
          : "exists",
    profile,
    authLoading,
    step,
  });

  async function handleUseMyLocation() {
    setLocationLoading(true);
    setError("");
    try {
      const { city: resolvedCity, lat, lng } = await getLocationDataFromGps();
      setCity(resolvedCity);
      setLocationLat(lat);
      setLocationLng(lng);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not get your location.");
    } finally {
      setLocationLoading(false);
    }
  }

  async function handleNameCitySubmit() {
    console.log("[OnboardingPage] handleNameCitySubmit called", {
      role,
      fullName,
      city,
    });

    if (!fullName.trim() || !city.trim()) {
      console.log("[OnboardingPage] Validation failed");
      setError("Please fill in all fields");
      return;
    }

    // If not logged in, move to registration step
    if (!user) {
      console.log("[OnboardingPage] No user, moving to registration step");
      setStep(2);
      return;
    }

    // If user is logged in, proceed to create profile
    await createProfile();
  }

  async function handleGoogleSignUp() {
    setLoading(true);
    setError("");
    const pendingProfile: Record<string, unknown> = {
      role,
      fullName: fullName.trim(),
      city: city.trim(),
    };
    if (locationLat != null && locationLng != null) {
      pendingProfile.location_lat = locationLat;
      pendingProfile.location_lng = locationLng;
    }
    localStorage.setItem("pendingProfile", JSON.stringify(pendingProfile));

    const { error: oAuthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/login` },
    });
    if (oAuthError) {
      setError(oAuthError.message || "Failed to connect to Google.");
      setLoading(false);
    }
  }

  async function handleRegister() {
    console.log("[OnboardingPage] handleRegister called", {
      email,
      password,
      role,
      fullName,
      city,
    });

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

    const emailRedirectTo = `${window.location.origin}/login`;

    // Register the user directly with Supabase to get full response
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
      {
        email: email.trim(),
        password: password,
        options: {
          emailRedirectTo,
        },
      },
    );

    if (signUpError) {
      console.error("[OnboardingPage] Sign up error", signUpError);
      setError(
        signUpError.message || "Failed to create account. Please try again.",
      );
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
      const pendingProfile: Record<string, unknown> = {
        role,
        fullName: fullName.trim(),
        city: city.trim(),
        email: email.trim(),
      };
      if (locationLat != null && locationLng != null) {
        pendingProfile.location_lat = locationLat;
        pendingProfile.location_lng = locationLng;
      }
      localStorage.setItem("pendingProfile", JSON.stringify(pendingProfile));

      setLoading(false);
      setStep(3); // Email verification step
      return;
    }

    // If session exists, user is immediately signed in (email confirmation disabled)
    // Wait a moment for auth state to update
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check if user is now available
    const {
      data: { user: newUser },
    } = await supabase.auth.getUser();

    if (!newUser) {
      setError("Account created but unable to sign in. Please try logging in.");
      setLoading(false);
      return;
    }

    // Now create the profile
    await createProfile();
  }

  async function createProfile() {
    console.log("[OnboardingPage] createProfile START", {
      loading,
      role,
      fullName,
      city,
    });

    // Prevent multiple calls
    if (loading) {
      console.log("[OnboardingPage] createProfile already in progress");
      return;
    }

    setLoading(true);
    setError("");

    // Get current user
    console.log("[OnboardingPage] Getting current user...");
    const {
      data: { user: currentUser },
      error: userError,
    } = await supabase.auth.getUser();
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
    if (!fullName.trim() || !city.trim()) {
      console.error("[OnboardingPage] Validation failed", {
        role,
        fullName,
        city,
      });
      setError(
        "Missing required profile information. Please complete the form.",
      );
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
      console.error(
        "[OnboardingPage] Error checking for existing profile",
        checkError,
      );
      // Continue with creation attempt
    } else if (existingProfile) {
      console.log(
        "[OnboardingPage] Profile already exists, skipping creation",
        existingProfile,
      );
      // Clear pending profile
      localStorage.removeItem("pendingProfile");
      setProfileChecked(true);
      setLoading(false);

      // Try to refresh profile (but don't wait if it times out)
      refreshProfile().catch((err) => {
        console.warn(
          "[OnboardingPage] Profile refresh failed, but profile exists",
          err,
        );
      });

      // Navigate based on role immediately
      if (existingProfile.role === "client") {
        navigate("/client/home", { replace: true });
      } else {
        navigate("/freelancer/home", { replace: true });
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

    const { error: profileError, data: profileData } = await supabase
      .from("profiles")
      .upsert({
        id: currentUser.id,
        role,
        full_name: fullName.trim(),
        city: city.trim(),
        location_lat: locationLat,
        location_lng: locationLng,
      })
      .select();

    console.log("[OnboardingPage] Profile upsert result", {
      hasError: !!profileError,
      error: profileError,
      hasData: !!profileData,
      data: profileData,
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
      setError(
        "Profile created but unable to verify. Please refresh the page.",
      );
      setLoading(false);
      setCheckingProfile(false);
      return;
    }

    console.log(
      "[OnboardingPage] Profile created successfully!",
      profileData[0],
    );

    // If freelancer, also create freelancer_profiles entry
    if (role === "freelancer") {
      console.log("[OnboardingPage] Creating freelancer profile...");
      const { error: freelancerError } = await supabase
        .from("freelancer_profiles")
        .upsert({
          user_id: currentUser.id,
        });
      console.log("[OnboardingPage] Freelancer profile result", {
        freelancerError,
      });
      if (freelancerError) {
        console.error(
          "[OnboardingPage] Freelancer profile error",
          freelancerError,
        );
        // Don't fail the whole process if freelancer profile fails
      }
    }

    // Clear pending profile from localStorage
    localStorage.removeItem("pendingProfile");
    setProfileChecked(true);
    setCheckingProfile(false);
    setLoading(false);

    console.log(
      "[OnboardingPage] Profile created successfully, navigating NOW...",
      { role },
    );

    // Navigate based on role immediately - use window.location as fallback
    const targetPath = role === "client" ? "/client/home" : "/freelancer/home";
    console.log("[OnboardingPage] Target path:", targetPath);

    // Use window.location immediately for guaranteed navigation
    console.log("[OnboardingPage] Using window.location.href to navigate");
    window.location.href = targetPath;

    // Also try React Router navigate as backup (though window.location should work)
    try {
      navigate(targetPath, { replace: true });
    } catch (navError) {
      console.error(
        "[OnboardingPage] React Router navigate failed (but window.location should work)",
        navError,
      );
    }

    // Try to refresh profile in background (don't wait)
    refreshProfile().catch((err) => {
      console.warn(
        "[OnboardingPage] Profile refresh failed, but profile was created",
        err,
      );
    });
  }

  console.log("[OnboardingPage] Rendering onboarding form");

  const progressStep = step; // 1, 2, or 3

  return (
    <div className="min-h-[100dvh] flex bg-white dark:bg-background">
      {/* LEFT COLUMN - Visual Experience (Desktop Only) */}
      <div className="hidden lg:flex lg:w-[45%] relative flex-col justify-end p-16 overflow-hidden bg-slate-900 shrink-0">
        <img
          src="/pexels-rdne-6646861.jpg"
          alt="Trusted professionals connecting locally"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/90 pointer-events-none" />
        
        <div className="relative z-10 animate-fade-up pointer-events-none">
          <img
            src={BRAND_LOGO_SRC}
            alt="Tebnu"
            className="h-28 w-auto xl:h-32 mb-10"
          />
          <h1 className="text-[3.25rem] font-black text-white leading-[1.05] tracking-tight mb-5 drop-shadow-xl text-balance">
            Join the Tebnu <br /> community.
          </h1>
          <p className="text-xl text-white/90 font-medium max-w-md leading-snug drop-shadow-md text-balance">
            Register your profile to connect with trusted locals instantly.
          </p>
        </div>
      </div>

      {/* RIGHT COLUMN - Auth Form */}
      <div className="flex flex-col flex-1 relative min-w-0">
        <div className="absolute top-0 right-0 left-0 z-20 pointer-events-none">
          <div className="pointer-events-auto">
            <LandingSiteHeader hideLeftLogo hideLoginCta homeLinkRight />
          </div>
        </div>

        <main className="flex-1 flex flex-col items-center justify-center p-6 pt-32 pb-12 overflow-y-auto">
          <div className="w-full max-w-[460px] animate-fade-in relative z-10 mx-auto">
            
            {/* Mobile Branding (Hidden on Desktop) */}
            <div className="lg:hidden text-center mb-10">
              <img
                src={BRAND_LOGO_SRC}
                alt="Tebnu"
                className="h-24 w-auto sm:h-28 mx-auto mb-4"
              />
            </div>

          {/* Step progress indicator */}
          {step !== 3 && (
            <div className="mb-8">
              <div className="flex items-center justify-between">
                {[1, 2].map((s) => (
                  <div key={s} className="flex flex-1 items-center">
                    <div className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all",
                      progressStep > s
                        ? "bg-primary text-primary-foreground"
                        : progressStep === s
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                          : "bg-muted text-muted-foreground"
                    )}>
                      {progressStep > s ? <Check className="h-3.5 w-3.5" /> : s}
                    </div>
                    <div className={cn(
                      "h-0.5 flex-1 mx-2 rounded-full transition-all",
                      progressStep > s ? "bg-primary" : "bg-muted"
                    )} />
                  </div>
                ))}
                <div className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all",
                  progressStep === 2
                    ? "bg-muted text-muted-foreground"
                    : "bg-muted text-muted-foreground"
                )}>
                  3
                </div>
              </div>
              <div className="flex justify-between mt-1.5">
                <span className={cn("text-[11px] font-medium", progressStep >= 1 ? "text-primary" : "text-muted-foreground")}>Details</span>
                <span className={cn("text-[11px] font-medium", progressStep >= 2 ? "text-primary" : "text-muted-foreground")}>Account</span>
              </div>
            </div>
          )}

          {step !== 3 && (
            <div className="text-center mb-8 md:mb-10">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {step === 1 ? "Your name and city" : "Create your account"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {step === 1
                  ? "Just the basics — we'll match you with the right people."
                  : "Almost there. Your account is free and takes seconds."}
              </p>
            </div>
          )}

          {/* Role selector — shown at top of step 1 */}
          {step === 1 && (
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2.5">I am joining as…</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("client")}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    role === "client"
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border bg-card hover:border-primary/40 hover:bg-primary/5"
                  )}
                >
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full",
                    role === "client" ? "bg-primary/15" : "bg-muted"
                  )}>
                    <Heart className={cn("h-5 w-5", role === "client" ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">I need help</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Find helpers near you</p>
                  </div>
                  {role === "client" && (
                    <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-primary-foreground" />
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setRole("freelancer")}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 relative",
                    role === "freelancer"
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border bg-card hover:border-primary/40 hover:bg-primary/5"
                  )}
                >
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full",
                    role === "freelancer" ? "bg-primary/15" : "bg-muted"
                  )}>
                    <Users className={cn("h-5 w-5", role === "freelancer" ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">I want to help</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Earn by helping others</p>
                  </div>
                  {role === "freelancer" && (
                    <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-primary-foreground" />
                    </div>
                  )}
                </button>
              </div>
            </div>
          )}

          <div>
            {error && (
              <div className="p-3 mb-4 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            {step === 1 && (
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
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                    <Input
                      id="city"
                      className="min-w-0 flex-1"
                      placeholder="e.g., Tel Aviv"
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        setLocationLat(null);
                        setLocationLng(null);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 gap-2 sm:min-w-[10.5rem]"
                      disabled={locationLoading}
                      onClick={handleUseMyLocation}
                      title="Use device location (saves GPS coordinates)"
                    >
                      {locationLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                      )}
                      My location
                    </Button>
                  </div>
                  {locationLat != null && locationLng != null ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Check className="h-3 w-3" />
                      Location saved — helpers nearby will see your request.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Type a city or use{" "}
                      <span className="font-medium">My location</span> for more precise matching.
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => navigate("/")}
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

            {step === 2 && (
              <div className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mb-2 font-semibold"
                  onClick={handleGoogleSignUp}
                  disabled={loading}
                >
                  <GoogleIcon className="mr-2 w-5 h-5" />
                  Continue with Google
                </Button>
                <div className="relative mb-6 mt-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/60" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or sign up with email</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
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
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setStep(1)}
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

            {step === 3 && (
              <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm md:p-8">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <Mail className="h-7 w-7 text-primary" aria-hidden />
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                    Check your email
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                    We sent a confirmation link to{" "}
                    <span className="font-medium text-foreground">
                      {registrationEmail || email}
                    </span>
                    . Click the link to verify your email — you&apos;ll be signed in automatically and taken to your dashboard.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Didn&apos;t get it? Check your spam folder or go back and try a different email.
                  </p>
                </div>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Do NOT clear pendingProfile — preserve it so the user
                      // can fix their email and re-register without losing data
                      setStep(2);
                    }}
                    className="flex-1"
                  >
                    Change email
                  </Button>
                  <Button onClick={() => navigate("/login")} className="flex-1">
                    Sign in instead
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        </main>
      </div>
    </div>
  );
}

