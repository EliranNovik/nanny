import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Mail, MapPin, Loader2 } from "lucide-react";
import { LandingSiteHeader } from "@/components/LandingSiteHeader";
import { getLocationDataFromGps } from "@/lib/location";

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
            console.log("[OnboardingPage] Found pending profile, creating...", profileData);
            setRole(profileData.role);
            setFullName(profileData.fullName);
            setCity(profileData.city);
            if (typeof profileData.location_lat === "number") setLocationLat(profileData.location_lat);
            if (typeof profileData.location_lng === "number") setLocationLng(profileData.location_lng);
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
      <div className="min-h-screen gradient-mesh flex flex-col">
        <LandingSiteHeader />
        <main className="flex flex-1 items-center justify-center pt-28 md:pt-36">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </main>
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
    console.log("[OnboardingPage] handleNameCitySubmit called", { role, fullName, city });

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

    const emailRedirectTo = `${window.location.origin}/login`;

    // Register the user directly with Supabase to get full response
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
      options: {
        emailRedirectTo,
      },
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
    if (!fullName.trim() || !city.trim()) {
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
    
    const { error: profileError, data: profileData } = await supabase.from("profiles").upsert({
      id: currentUser.id,
      role,
      full_name: fullName.trim(),
      city: city.trim(),
      location_lat: locationLat,
      location_lng: locationLng,
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
    const targetPath = role === "client" ? "/client/home" : "/freelancer/home";
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
    <div className="min-h-screen gradient-mesh flex flex-col">
      <LandingSiteHeader />
      <main className="flex w-full flex-1 flex-col items-center justify-center px-4 pb-16 pt-28 md:px-8 md:pb-20 md:pt-36">
        <div className="animate-fade-in w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-[40rem] mx-auto">
        {step !== 3 && (
          <div className="text-center mb-8 md:mb-10">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {step === 1 ? "Your name and city" : "Email and password"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {step === 1
                ? "First, tell us your name and city."
                : "Then create your account. If email confirmation is on, we will send you a link next."}
            </p>
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
                    <p className="text-xs text-muted-foreground">
                      Location saved with map coordinates for nearby helpers.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Type a city or use <span className="font-medium">My location</span> to save your position.
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
                    <span className="font-medium text-foreground">{registrationEmail || email}</span>.
                    Open the link from Supabase to verify your address—you will be signed in and taken
                    to your dashboard. If the link doesn’t open the app, sign in here with the same
                    email and password.
                  </p>
                </div>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button
                    variant="outline"
                    onClick={() => {
                      localStorage.removeItem("pendingProfile");
                      setStep(2);
                    }}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button onClick={() => navigate("/login")} className="flex-1">
                    Sign in
                  </Button>
                </div>
              </div>
            )}
        </div>
        </div>
      </main>
    </div>
  );
}


