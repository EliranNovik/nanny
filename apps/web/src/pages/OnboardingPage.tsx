import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Users, Heart, Check } from "lucide-react";
import { LandingSiteHeader } from "@/components/LandingSiteHeader";
import { AppBootSplashLogo } from "@/components/AppBootSplash";
import { CreateJobCityAutocomplete } from "@/components/CreateJobCityAutocomplete";
import { cn } from "@/lib/utils";
import { GoogleIcon } from "@/components/BrandIcons";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";
import type { CityPlaceSelection } from "@/lib/cityPlace";
import {
  clearPendingProfile,
  commitPendingProfile,
  readPendingProfile,
  savePendingProfile,
} from "@/lib/pendingProfile";

type Role = "client" | "freelancer";

export default function OnboardingPage() {
  const { user, profile, loading: authLoading, refreshProfile, applyProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  /** Default: family / hire flow. Use `?role=freelancer` for helpers. */
  const [role, setRole] = useState<Role>("client");
  const [fullName, setFullName] = useState("");
  const [citySelection, setCitySelection] = useState<CityPlaceSelection | null>(
    null,
  );
  const cityConfirmed = citySelection !== null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const [completingSignup, setCompletingSignup] = useState(false);
  const checkInitiatedRef = useRef(false);
  const creatingProfileRef = useRef(false);

  // Optional: `?role=freelancer` for helper signup (links from marketing)
  useEffect(() => {
    const roleParam = searchParams.get("role");
    if (roleParam === "client" || roleParam === "freelancer") {
      setRole(roleParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) {
      checkInitiatedRef.current = false;
      setProfileChecked(false);
      setCompletingSignup(false);
      setCheckingProfile(false);
    }
  }, [user]);

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
          clearPendingProfile();

          const target =
            existingProfile.role === "client"
              ? "/client/home"
              : "/freelancer/home";
          navigate(target, { replace: true });

          refreshProfile().catch(() => {});
          return;
        }

        const pending = readPendingProfile();
        if (pending) {
          console.log(
            "[OnboardingPage] Found pending profile, creating...",
            pending,
          );
          setRole(pending.role);
          setFullName(pending.fullName);
          if (pending.city_place_id) {
            setCitySelection({
              label: pending.city,
              placeId: pending.city_place_id,
              lat: pending.location_lat ?? null,
              lng: pending.location_lng ?? null,
            });
          }
          if (pending.email) setEmail(pending.email);

          setCompletingSignup(true);
          try {
            const result = await commitPendingProfile(user.id);
            if (!result.ok) {
              setError(result.error);
              setCompletingSignup(false);
              setCheckingProfile(false);
              checkInitiatedRef.current = false;
              return;
            }
            const { data: createdProfile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", user.id)
              .maybeSingle();
            if (createdProfile) {
              applyProfile(createdProfile);
            }
            setProfileChecked(true);
            setCheckingProfile(false);
            setCompletingSignup(false);
            navigate("/onboarding/verify", { replace: true });
            void refreshProfile();
          } catch (createError) {
            console.error("[OnboardingPage] Error committing pending profile", createError);
            setError("Failed to create profile. Please try again.");
            setCompletingSignup(false);
            setCheckingProfile(false);
            checkInitiatedRef.current = false;
          }
          return;
        }

        setCheckingProfile(false);
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
    applyProfile,
  ]);

  const hasPendingSignup =
    Boolean(user && !profile && readPendingProfile()) && !error;

  // Show loading while checking authentication or finishing post-email signup
  if (
    authLoading ||
    completingSignup ||
    checkingProfile ||
    hasPendingSignup
  ) {
    return (
      <div className="min-h-screen bg-slate-50/50 dark:bg-background flex flex-col">
        <LandingSiteHeader />
        <main className="flex flex-1 items-center justify-center pt-28 md:pt-36">
          <div className="flex flex-col items-center gap-3">
            <AppBootSplashLogo />
            {completingSignup || checkingProfile ? (
              <p className="text-sm text-muted-foreground">
                Setting up your account…
              </p>
            ) : null}
          </div>
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

  function pendingCityFields() {
    if (!citySelection?.placeId) return null;
    return {
      city: citySelection.label.trim(),
      city_place_id: citySelection.placeId,
      location_lat: citySelection.lat,
      location_lng: citySelection.lng,
    };
  }

  async function handleNameCitySubmit() {
    console.log("[OnboardingPage] handleNameCitySubmit called", {
      role,
      fullName,
      citySelection,
    });

    if (!fullName.trim() || !citySelection?.placeId) {
      console.log("[OnboardingPage] Validation failed");
      setError("Please enter your name and pick your city from the list");
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
    const cityFields = pendingCityFields();
    if (!cityFields) {
      setError("Please pick your city from the list before continuing");
      return;
    }

    setLoading(true);
    setError("");
    savePendingProfile({
      role,
      fullName: fullName.trim(),
      ...cityFields,
    });

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
    const cityFields = pendingCityFields();
    console.log("[OnboardingPage] handleRegister called", {
      email,
      password,
      role,
      fullName,
      citySelection,
    });

    if (!email.trim() || !password.trim()) {
      setError("Please fill in email and password");
      return;
    }

    if (!cityFields) {
      setError("Please pick your city from the list before continuing");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError("");

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
    });

    if (signUpError) {
      console.error("[OnboardingPage] Sign up error", signUpError);
      setError(
        signUpError.message || "Failed to create account. Please try again.",
      );
      setLoading(false);
      return;
    }

    if (!signUpData.user) {
      setError("Failed to create account. Please try again.");
      setLoading(false);
      return;
    }

    if (!signUpData.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });
      if (signInError) {
        setError("Account created but sign-in failed. Please try logging in.");
        setLoading(false);
        return;
      }
    }

    await createProfile();
  }

  async function createProfile() {
    const cityFields = pendingCityFields();
    console.log("[OnboardingPage] createProfile START", {
      role,
      fullName,
      citySelection,
    });

    if (creatingProfileRef.current) {
      console.log("[OnboardingPage] createProfile already in progress");
      return;
    }

    creatingProfileRef.current = true;
    setCompletingSignup(true);
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
      setCompletingSignup(false);
      creatingProfileRef.current = false;
      return;
    }
    if (!currentUser) {
      console.error("[OnboardingPage] No current user");
      setError("Unable to get user information. Please try again.");
      setLoading(false);
      setCompletingSignup(false);
      creatingProfileRef.current = false;
      return;
    }
    console.log("[OnboardingPage] Got user", { userId: currentUser.id });

    // Validate required fields
    if (!fullName.trim() || !cityFields) {
      console.error("[OnboardingPage] Validation failed", {
        role,
        fullName,
        citySelection,
      });
      setError(
        "Missing required profile information. Please complete the form.",
      );
      setLoading(false);
      setCompletingSignup(false);
      creatingProfileRef.current = false;
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
      clearPendingProfile();
      setProfileChecked(true);
      setLoading(false);
      setCompletingSignup(false);
      creatingProfileRef.current = false;

      const target =
        existingProfile.role === "client"
          ? "/client/home"
          : "/freelancer/home";
      navigate(target, { replace: true });
      return;
    }

    console.log("[OnboardingPage] Upserting profile...", {
      userId: currentUser.id,
      role,
      full_name: fullName.trim(),
      city: cityFields.city,
      city_place_id: cityFields.city_place_id,
    });

    // Upsert profile
    console.log("[OnboardingPage] Upserting profile to database...", {
      id: currentUser.id,
      role,
      full_name: fullName.trim(),
      city: cityFields.city,
    });

    const { error: profileError, data: profileData } = await supabase
      .from("profiles")
      .upsert({
        id: currentUser.id,
        role,
        full_name: fullName.trim(),
        city: cityFields.city,
        city_place_id: cityFields.city_place_id,
        location_lat: cityFields.location_lat,
        location_lng: cityFields.location_lng,
        kyc_status: "not_started",
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
      setCompletingSignup(false);
      setCheckingProfile(false);
      creatingProfileRef.current = false;
      return;
    }

    if (!profileData || profileData.length === 0) {
      console.error("[OnboardingPage] Profile created but no data returned");
      setError(
        "Profile created but unable to verify. Please refresh the page.",
      );
      setLoading(false);
      setCompletingSignup(false);
      setCheckingProfile(false);
      creatingProfileRef.current = false;
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

    clearPendingProfile();
    setProfileChecked(true);
    setCheckingProfile(false);
    setLoading(false);
    setCompletingSignup(false);
    creatingProfileRef.current = false;

    applyProfile(profileData[0]);
    navigate("/onboarding/verify", { replace: true });
    void refreshProfile();
  }

  console.log("[OnboardingPage] Rendering onboarding form");

  const progressStep = step;

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
          <div className="mb-8">
            <div className="flex items-center">
              {[1, 2].map((s) => (
                <div key={s} className="flex flex-1 items-center last:flex-none">
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all",
                      progressStep > s
                        ? "bg-primary text-primary-foreground"
                        : progressStep === s
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {progressStep > s ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      s
                    )}
                  </div>
                  {s < 2 ? (
                    <div
                      className={cn(
                        "mx-2 h-0.5 flex-1 rounded-full transition-all",
                        progressStep > s ? "bg-primary" : "bg-muted",
                      )}
                    />
                  ) : null}
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between">
              <span
                className={cn(
                  "text-[11px] font-medium",
                  progressStep >= 1 ? "text-primary" : "text-muted-foreground",
                )}
              >
                Details
              </span>
              <span
                className={cn(
                  "text-[11px] font-medium",
                  progressStep >= 2 ? "text-primary" : "text-muted-foreground",
                )}
              >
                Account
              </span>
            </div>
          </div>

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
                  <CreateJobCityAutocomplete
                    size="compact"
                    confirmedCity={citySelection?.label ?? ""}
                    isConfirmed={cityConfirmed}
                    onPickCity={setCitySelection}
                    onInvalidateSelection={() => setCitySelection(null)}
                  />
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
                    disabled={loading || !fullName.trim() || !cityConfirmed}
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

          </div>
        </div>
        </main>
      </div>
    </div>
  );
}

