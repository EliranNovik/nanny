import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LandingSiteHeader } from "@/components/LandingSiteHeader";
import { AppBootSplashLogo } from "@/components/AppBootSplash";
import { Loader2, Sparkles } from "lucide-react";
import { GoogleIcon } from "@/components/BrandIcons";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const {
    signIn,
    signUp,
    user,
    profile,
    loading: authLoading,
    refreshProfile,
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check if signup mode should be enabled from URL params
  useEffect(() => {
    const signupParam = searchParams.get("signup");
    if (signupParam === "true" && !isSignUp) {
      setIsSignUp(true);
    }
  }, [searchParams, isSignUp]);

  // Check for pending profile and create it after login
  useEffect(() => {
    async function handlePendingProfile() {
      if (!user || profile || authLoading) return;

      const pendingProfile = localStorage.getItem("pendingProfile");
      if (pendingProfile) {
        try {
          const profileData = JSON.parse(pendingProfile);
          console.log(
            "[LoginPage] Found pending profile, creating...",
            profileData,
          );

          // Create the profile
          const { error: profileError } = await supabase
            .from("profiles")
            .upsert({
              id: user.id,
              role: profileData.role,
              full_name: profileData.fullName,
              city: profileData.city,
              location_lat: profileData.location_lat ?? null,
              location_lng: profileData.location_lng ?? null,
            });

          if (profileError) {
            console.error("[LoginPage] Error creating profile", profileError);
            // Don't clear pending profile on error, let onboarding handle it
            return;
          }

          // If freelancer, also create freelancer_profiles entry
          if (profileData.role === "freelancer") {
            await supabase.from("freelancer_profiles").upsert({
              user_id: user.id,
            });
          }

          // Clear pending profile
          localStorage.removeItem("pendingProfile");

          // Refresh profile to get the new one
          await refreshProfile();
        } catch (e) {
          console.error("[LoginPage] Error handling pending profile", e);
        }
      }
    }

    handlePendingProfile();
  }, [user, profile, authLoading, refreshProfile]);

  // Redirect if already logged in (wait for auth to finish loading)
  useEffect(() => {
    console.log("[LoginPage] useEffect triggered", {
      authLoading,
      hasUser: !!user,
      profile,
    });

    // Only redirect after loading is complete
    if (!authLoading && user) {
      console.log("[LoginPage] Ready to redirect", { profile });
      // Small delay to ensure auth state is fully updated and profile creation completes
      const timer = setTimeout(() => {
        // Check if there's a redirect parameter
        const redirectParam = searchParams.get("redirect");
        const roleParam = searchParams.get("role");

        if (redirectParam) {
          // Redirect to the specified path, preserving role if present
          const redirectUrl = roleParam
            ? `${redirectParam}?role=${roleParam}`
            : redirectParam;
          console.log("[LoginPage] Redirecting to", redirectUrl);
          navigate(redirectUrl, { replace: true });
        } else if (profile) {
          // User has a profile, redirect to dashboard based on role
          if (profile.role === "client") {
            console.log("[LoginPage] Redirecting to /client/home (client)");
            navigate("/client/home", { replace: true });
          } else {
            console.log("[LoginPage] Redirecting to /freelancer/home");
            navigate("/freelancer/home", { replace: true });
          }
        } else {
          // No profile yet, redirect to onboarding
          console.log("[LoginPage] Redirecting to /onboarding (no profile)");
          const redirectUrl = roleParam
            ? `/onboarding?role=${roleParam}`
            : "/onboarding";
          navigate(redirectUrl, { replace: true });
        }
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [user, profile, authLoading, navigate, searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    console.log("[LoginPage] handleSubmit called", { isSignUp, email });

    const { error } = isSignUp
      ? await signUp(email, password)
      : await signIn(email, password);

    console.log("[LoginPage] Auth result", {
      error: error?.message,
      hasError: !!error,
    });

    if (error) {
      // Check for CORS/network errors
      const errorMessage = error.message || String(error);
      if (
        errorMessage.includes("NetworkError") ||
        errorMessage.includes("CORS") ||
        errorMessage.includes("fetch") ||
        errorMessage.includes("Failed to fetch")
      ) {
        setError(
          "Cannot connect to Supabase. This usually means:\n\n" +
            "1. Your Supabase project is paused (free tier pauses after 7 days)\n" +
            "   → Go to https://supabase.com/dashboard and restore your project\n\n" +
            "2. Network connectivity issues\n" +
            "   → Check your internet connection\n\n" +
            "3. Browser extension blocking requests\n" +
            "   → Try disabling ad blockers or privacy extensions",
        );
      } else {
        setError(errorMessage);
      }
      setLoading(false);
      return;
    }

    console.log("[LoginPage] Auth successful, waiting for profile to load...");
    // Wait a moment for auth state to update, then redirect will happen via useEffect
    // Don't navigate here - let the useEffect handle it based on profile state
    setLoading(false);
  }

  async function handleGoogleLogin() {
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  // Show loading if auth is loading
  if (authLoading) {
    console.log("[LoginPage] Showing loading spinner", {
      authLoading,
      hasUser: !!user,
      profile,
    });
    return (
      <div className="min-h-screen bg-slate-50/50 dark:bg-background flex flex-col">
        <LandingSiteHeader hideLeftLogo hideLoginCta homeLinkRight />
        <main className="flex flex-1 items-center justify-center pt-28 md:pt-36">
          <AppBootSplashLogo />
        </main>
      </div>
    );
  }

  // Don't show login page if already logged in (redirect will happen)
  if (user) {
    console.log(
      "[LoginPage] User exists, hiding login form (redirect pending)",
    );
    return null;
  }

  console.log("[LoginPage] Rendering login form");

  return (
    <div className="min-h-[100dvh] flex bg-white dark:bg-background">
      {/* LEFT COLUMN - Visual Experience (Desktop Only) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-end p-16 overflow-hidden bg-slate-900 shrink-0">
        <img
          src="/pexels-rdne-6646861.jpg"
          alt="Trusted professionals connecting locally"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Gradient overlays to make text brilliant and readable */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/90 pointer-events-none" />
        
        {/* Animated Brand Content */}
        <div className="relative z-10 animate-fade-up pointer-events-none">
          <img
            src={BRAND_LOGO_SRC}
            alt="MamaLama Logo"
            className="h-[4.5rem] w-auto mb-10"
          />
          <h1 className="text-[3.25rem] font-black text-white leading-[1.05] tracking-tight mb-5 drop-shadow-xl text-balance">
            Find the perfect <br /> helper in minutes.
          </h1>
          <p className="text-xl text-white/90 font-medium max-w-md leading-snug drop-shadow-md text-balance">
            Join thousands of families and trusted professionals connecting locally every single day.
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
          <div className="w-full max-w-[380px] animate-fade-in relative z-10 mx-auto">
            
            {/* Mobile Branding (Hidden on Desktop) */}
            <div className="lg:hidden text-center mb-10">
              <img
                src={BRAND_LOGO_SRC}
                alt="MamaLama Logo"
                className="h-[5rem] w-auto mx-auto mb-5"
              />
              <p className="text-muted-foreground mt-2 flex items-center justify-center gap-1.5 font-medium tracking-tight">
                <Sparkles className="w-4 h-4 text-orange-500" />
                Find a helper in minutes
              </p>
            </div>

            <div className="mb-8">
              <h2 className="text-[1.75rem] font-black tracking-tight text-slate-950 dark:text-white">
                {isSignUp ? "Create an account" : "Welcome back"}
              </h2>
              <p className="text-[0.95rem] font-medium text-slate-500 dark:text-slate-400 mt-2">
                {isSignUp
                  ? "Enter your details below to get started"
                  : "Sign in with your email or social account"}
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-12 mb-7 text-[0.95rem] font-semibold bg-white hover:bg-slate-50 border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all dark:bg-zinc-900 dark:border-white/10 dark:hover:bg-zinc-800 rounded-xl"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <GoogleIcon className="mr-3 w-5 h-5" />
              Continue with Google
            </Button>

            <div className="relative mb-7">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200 dark:border-white/10" />
              </div>
              <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                <span className="bg-white dark:bg-background px-3">
                  Or continue with email
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 text-red-600 text-[0.9rem] font-medium leading-snug border border-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/40 whitespace-pre-line animate-in fade-in slide-in-from-top-1">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="font-semibold text-slate-700 dark:text-slate-300">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 rounded-xl border-slate-200 shadow-sm focus-visible:ring-offset-0 focus-visible:ring-primary/50 text-base dark:border-white/10 dark:bg-zinc-900/50"
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="font-semibold text-slate-700 dark:text-slate-300">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-12 rounded-xl border-slate-200 shadow-sm focus-visible:ring-offset-0 focus-visible:ring-primary/50 text-base dark:border-white/10 dark:bg-zinc-900/50"
                  disabled={loading}
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl text-base font-bold shadow-md hover:shadow-lg transition-all"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Please wait...
                    </>
                  ) : isSignUp ? (
                    "Create Account"
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </div>
            </form>

            <div className="mt-8 text-center">
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
                disabled={loading}
              >
                {isSignUp ? (
                  <>Already have an account? <span className="text-primary hover:underline underline-offset-4">Sign in</span></>
                ) : (
                  <>Don't have an account? <span className="text-primary hover:underline underline-offset-4">Sign up</span></>
                )}
              </button>
            </div>
            
          </div>
        </main>
      </div>
    </div>
  );
}
