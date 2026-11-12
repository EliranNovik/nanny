import { useState, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { FloatingLabelInput } from "@/components/ui/FloatingLabelInput";
import {
  ArrowRight,
  Baby,
  Check,
  ChefHat,
  HelpingHand,
  HeartHandshake,
  Home,
  Sparkles,
  Truck,
} from "lucide-react";
import {
  isRtlLocale,
  normalizeAppLocale,
} from "@/i18n";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { AppBootSplashLogo } from "@/components/AppBootSplash";
import { CreateJobCityAutocomplete } from "@/components/CreateJobCityAutocomplete";
import { cn } from "@/lib/utils";
import { GoogleIcon } from "@/components/BrandIcons";
import type { CityPlaceSelection } from "@/lib/cityPlace";
import {
  OTHER_HELP_SUBCATEGORIES,
  SERVICE_CATEGORIES,
} from "@/lib/serviceCategories";
import {
  clearPendingProfile,
  commitPendingProfile,
  readPendingProfile,
} from "@/lib/pendingProfile";
import { needsKycVerification, roleHomePath } from "@/lib/kyc";

type Role = "client" | "freelancer";

const CATEGORY_ICONS = {
  cleaning: Sparkles,
  cooking: ChefHat,
  pickup_delivery: Truck,
  nanny: Baby,
  home_maintenance: Home,
  other_help: HelpingHand,
} as const;

const CATEGORY_ICON_COLORS: Record<string, string> = {
  cleaning: "bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300",
  cooking: "bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300",
  pickup_delivery: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300",
  nanny: "bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300",
  home_maintenance: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  other_help: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300",
};

function OnboardingTopBar() {
  return (
    <div className="flex shrink-0 items-center justify-end px-4 pt-4 sm:px-6 md:px-10 lg:px-12">
      <LanguageSwitcher variant="compact" triggerClassName="text-foreground" />
    </div>
  );
}

export default function OnboardingPage({ embedded = false }: { embedded?: boolean }) {
  const { user, profile, loading: authLoading, refreshProfile, applyProfile } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const appLocale = normalizeAppLocale(i18n.language ?? "en");
  /** Default: family / hire flow. Use `?role=freelancer` for helpers. */
  const [role, setRole] = useState<Role>("client");
  const [fullName, setFullName] = useState("");
  const [citySelection, setCitySelection] = useState<CityPlaceSelection | null>(
    null,
  );
  const cityConfirmed = citySelection !== null;
  const [categories, setCategories] = useState<string[]>([]);
  const [otherHelpSubs, setOtherHelpSubs] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const [completingSignup, setCompletingSignup] = useState(false);
  const checkInitiatedRef = useRef(false);
  const creatingProfileRef = useRef(false);
  const fullNameRef = useRef<HTMLInputElement>(null);
  const cityInputRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function focusRegisterField(el: HTMLInputElement | null) {
    if (!el) return;
    el.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: "center", inline: "nearest" });
    });
  }

  function goToRegisterStep(next: number) {
    const details = role === "freelancer" ? 4 : 3;
    flushSync(() => {
      setStep(next);
    });
    if (next === 1) {
      focusRegisterField(emailRef.current);
      return;
    }
    if (next === details) {
      focusRegisterField(fullNameRef.current);
    }
  }

  // Optional: `?role=freelancer` for helper signup (links from marketing)
  useEffect(() => {
    const roleParam = searchParams.get("role");
    if (roleParam === "client" || roleParam === "freelancer") {
      setRole(roleParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (authLoading || completingSignup || checkingProfile) return;
    const details = role === "freelancer" ? 4 : 3;
    const target =
      step === 1
        ? emailRef.current
        : step === details
          ? fullNameRef.current
          : null;
    if (!target) return;
    const id = window.setTimeout(() => {
      const active = document.activeElement;
      if (
        active &&
        active !== document.body &&
        active !== document.documentElement &&
        active !== target
      ) {
        return;
      }
      focusRegisterField(target);
    }, 80);
    return () => window.clearTimeout(id);
  }, [authLoading, completingSignup, checkingProfile, step, role]);

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
          setProfileChecked(true);
          setCheckingProfile(false);
          clearPendingProfile();
          if (embedded) return;

          const target = needsKycVerification(existingProfile)
            ? "/onboarding/verify"
            : roleHomePath(existingProfile.role);
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
            const createdTarget =
              createdProfile && needsKycVerification(createdProfile)
                ? "/onboarding/verify"
                : roleHomePath(createdProfile?.role ?? "client");
            navigate(createdTarget, { replace: true });
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

        setProfileChecked(true);
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

  useEffect(() => {
    if (!user || profile || authLoading || checkingProfile || step !== 1) return;
    setStep(2);
  }, [user, profile, authLoading, checkingProfile, step]);

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
      <div className={cn("flex flex-col", embedded ? "min-h-full bg-[#FAF6EF] dark:bg-[#09090b]" : "min-h-screen bg-slate-50/50 bg-white dark:bg-background")}>
        {embedded ? null : <OnboardingTopBar />}
        <main className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <AppBootSplashLogo />
            {completingSignup || checkingProfile ? (
              <p className="text-sm text-muted-foreground">
                {t("onboarding.settingUp")}
              </p>
            ) : null}
          </div>
        </main>
      </div>
    );
  }

  if (embedded && profile) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#FAF6EF] px-8 text-center dark:bg-[#09090b]">
        <p className="text-lg font-semibold text-foreground">{t("onboarding.alreadySignedIn")}</p>
        <Button
          type="button"
          onClick={() =>
            navigate(
              needsKycVerification(profile) ? "/onboarding/verify" : roleHomePath(profile.role),
            )
          }
          className="rounded-full px-6"
        >
          {t("onboarding.goToApp")}
        </Button>
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
    if (!fullName.trim() || !citySelection?.placeId) {
      setError(t("onboarding.errors.nameCityRequired"));
      return;
    }
    setError("");
    await createProfile();
  }

  function handleRoleContinue() {
    setError("");
    setStep(3);
  }

  function helperCategories() {
    return [
      ...categories,
      ...(categories.includes("other_help") ? otherHelpSubs : []),
    ];
  }

  async function handleCategoriesContinue() {
    if (categories.length === 0) {
      setError(t("onboarding.errors.categoriesRequired"));
      return;
    }
    setError("");
    goToRegisterStep(4);
  }

  async function handleGoogleSignUp() {
    setLoading(true);
    setError("");
    const { error: oAuthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/onboarding` },
    });
    if (oAuthError) {
      setError(oAuthError.message || "Failed to connect to Google.");
      setLoading(false);
    }
  }

  async function handleRegister() {
    if (!email.trim() || !password.trim()) {
      setError(t("onboarding.errors.emailPasswordRequired"));
      return;
    }
    if (password.length < 6) {
      setError(t("onboarding.errors.passwordShort"));
      return;
    }
    if (user) {
      goToRegisterStep(2);
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
      setError(signUpError.message || t("onboarding.errors.signUpFailed"));
      setLoading(false);
      return;
    }

    if (!signUpData.user) {
      setError(t("onboarding.errors.signUpFailed"));
      setLoading(false);
      return;
    }

    if (!signUpData.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });
      if (signInError) {
        setError(t("onboarding.errors.signInAfterSignUpFailed"));
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    goToRegisterStep(2);
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
      setError(t("onboarding.errors.userMissing"));
      setLoading(false);
      setCompletingSignup(false);
      creatingProfileRef.current = false;
      return;
    }
    if (!currentUser) {
      console.error("[OnboardingPage] No current user");
      setError(t("onboarding.errors.userMissing"));
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
      setError(t("onboarding.errors.missingProfile"));
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

      const target = needsKycVerification(existingProfile)
        ? "/onboarding/verify"
        : roleHomePath(existingProfile.role);
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
        app_locale: appLocale,
        ...(role === "freelancer" && helperCategories().length
          ? { categories: helperCategories() }
          : {}),
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
      setError(t("onboarding.errors.profileUnverified"));
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
    const createdTarget = needsKycVerification(profileData[0])
      ? "/onboarding/verify"
      : roleHomePath(profileData[0].role);
    navigate(createdTarget, { replace: true });
    void refreshProfile();
  }

  console.log("[OnboardingPage] Rendering onboarding form");

  const isHelper = role === "freelancer";
  const isRtl = isRtlLocale(appLocale);
  const totalSteps = isHelper ? 4 : 3;
  const detailsStep = isHelper ? 4 : 3;
  const progressStep = step;
  const primaryBtnClass = isHelper
    ? "rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
    : "rounded-full";
  const backBtnClass = isHelper
    ? "border border-transparent bg-transparent text-emerald-700 shadow-none hover:border-emerald-600 hover:bg-transparent hover:text-emerald-700 dark:text-emerald-400 dark:hover:border-emerald-500 dark:hover:bg-transparent dark:hover:text-emerald-400"
    : "border border-transparent bg-transparent text-foreground shadow-none hover:border-border hover:bg-transparent hover:text-foreground";
  const accentFillClass = isHelper
    ? "bg-emerald-600 text-white"
    : "bg-primary text-primary-foreground";
  const accentActiveClass = isHelper
    ? "bg-emerald-600 text-white ring-4 ring-emerald-600/20"
    : "bg-primary text-primary-foreground ring-4 ring-primary/20";
  const accentTextClass = isHelper ? "text-emerald-600" : "text-primary";
  const accentBarClass = isHelper ? "bg-emerald-600" : "bg-primary";

  return (
    <div className={cn("flex flex-col", embedded ? "min-h-full bg-[#FAF6EF] dark:bg-[#09090b]" : "h-[100dvh] max-h-[100dvh] overflow-hidden bg-white dark:bg-background")}>
      <div className={cn("flex min-h-0", embedded ? "flex-none overflow-visible" : "flex-1 overflow-hidden")}>
      {embedded ? null : (
      <div
        className="relative hidden h-full min-h-0 shrink-0 lg:block lg:w-[45%]"
      >
        <div
          className={cn(
            "absolute inset-x-0 bottom-5 top-5 overflow-hidden bg-slate-900",
            isRtl ? "rounded-s-[2rem]" : "rounded-[2rem]",
          )}
        >
        <img
          src="/ChatGPT Image Apr 19, 2026, 11_35_26 AM.png"
          alt="Trusted professionals connecting locally"
          className="absolute inset-0 h-full w-full object-cover object-right"
        />
        
        <div className={cn("absolute inset-x-0 bottom-0 z-10 p-16 pointer-events-none", isRtl ? "pb-24 pe-20" : "pb-20")}>
          <h1
            className={cn(
              "mb-5 font-black tracking-tight text-white drop-shadow-xl",
              isRtl
                ? "text-start text-[2.85rem] leading-[1.28]"
                : "text-balance text-[3.25rem] leading-[1.15]",
            )}
          >
            {t("onboarding.heroTitle")}
          </h1>
          <p
            className={cn(
              "max-w-md text-xl font-medium text-white/90 drop-shadow-md",
              isRtl
                ? "text-start leading-[1.7]"
                : "text-balance leading-snug",
            )}
          >
            {t("onboarding.heroSubtitle")}
          </p>
        </div>
        </div>
      </div>
      )}

      {/* RIGHT COLUMN - Auth Form */}
      <div className={cn("relative flex min-h-0 min-w-0 flex-col overflow-hidden", embedded ? "w-full flex-none self-start" : "h-full flex-1")}>
        {embedded ? null : <OnboardingTopBar />}
        {embedded && step === 1 ? null : (
        <div className={cn("shrink-0 px-6 pb-3 md:px-10 lg:px-12", embedded ? "bg-[#FAF6EF] px-5 pt-28 dark:bg-[#09090b]" : "bg-white pt-4 dark:bg-background")}>
          <div className="mx-auto w-full max-w-[460px]">
            <div className="flex items-center">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
                <div key={s} className="flex flex-1 items-center last:flex-none">
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all",
                      progressStep > s
                        ? accentFillClass
                        : progressStep === s
                          ? accentActiveClass
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {progressStep > s ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      s
                    )}
                  </div>
                  {s < totalSteps ? (
                    <div
                      className={cn(
                        "mx-2 h-0.5 flex-1 rounded-full transition-all",
                        progressStep > s ? accentBarClass : "bg-muted",
                      )}
                    />
                  ) : null}
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between">
              {(
                isHelper
                  ? [
                      t("onboarding.stepAccount"),
                      t("onboarding.stepRole"),
                      t("onboarding.stepCategories"),
                      t("onboarding.stepDetails"),
                    ]
                  : [
                      t("onboarding.stepAccount"),
                      t("onboarding.stepRole"),
                      t("onboarding.stepDetails"),
                    ]
              ).map((label, index) => (
                <span
                  key={label}
                  className={cn(
                    "text-[11px] font-medium",
                    progressStep >= index + 1 ? accentTextClass : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
        )}

        <main className={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain", embedded ? "bg-[#FAF6EF] px-5 pb-6 dark:bg-[#09090b]" : "px-6 pt-4 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:px-10 md:pt-6", embedded && step === 1 && "pt-28")}>
          <div className="mx-auto w-full max-w-[460px] animate-fade-in">
          <div className={cn("text-center", step === 1 ? "mb-6" : "mb-8 md:mb-10")}>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {step === 1
                ? t("onboarding.titleAccount")
                : step === 2
                  ? t("onboarding.joiningAs")
                  : step === 3 && isHelper
                    ? t("onboarding.titleCategories")
                    : t("onboarding.titleNameCity")}
            </h1>
            {step === 3 && isHelper ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("onboarding.subtitleCategories")}
              </p>
            ) : null}
          </div>

          {/* Role selector */}
          {step === 2 && (
            <div className="mb-6">
              <div className="mx-auto grid max-w-[26rem] grid-cols-2 items-center gap-4 sm:max-w-md">
                <button
                  type="button"
                  onClick={() => setRole("client")}
                  className={cn(
                    "relative flex flex-col items-center rounded-2xl text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    role === "client"
                      ? "z-10 scale-[1.06] gap-3.5 border border-white/20 bg-gradient-to-r from-orange-500 to-red-600 p-6 shadow-lg shadow-orange-500/25"
                      : "gap-3 border-0 bg-muted/20 p-5 hover:bg-muted/30",
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center rounded-full",
                      role === "client" ? "h-16 w-16 bg-white/20" : "h-14 w-14 bg-white/60",
                    )}
                  >
                    <HeartHandshake
                      className={cn(
                        role === "client" ? "h-8 w-8 text-white" : "h-7 w-7 text-muted-foreground",
                      )}
                      strokeWidth={2.25}
                    />
                  </div>
                  <div>
                    <p
                      className={cn(
                        "font-bold",
                        role === "client" ? "text-lg text-white" : "text-base text-foreground",
                      )}
                    >
                      {t("onboarding.needHelp")}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-sm",
                        role === "client" ? "text-white/85" : "text-muted-foreground",
                      )}
                    >
                      {t("onboarding.needHelpHint")}
                    </p>
                  </div>
                  {role === "client" ? (
                    <div className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-white">
                      <Check className="h-3 w-3 text-orange-600" />
                    </div>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => setRole("freelancer")}
                  className={cn(
                    "relative flex flex-col items-center rounded-2xl text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    role === "freelancer"
                      ? "z-10 scale-[1.06] gap-3.5 border border-white/20 bg-gradient-to-r from-emerald-500 to-green-600 p-6 shadow-lg shadow-emerald-500/25"
                      : "gap-3 border-0 bg-muted/20 p-5 hover:bg-muted/30",
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center rounded-full",
                      role === "freelancer" ? "h-16 w-16 bg-white/20" : "h-14 w-14 bg-white/60",
                    )}
                  >
                    <HelpingHand
                      className={cn(
                        role === "freelancer" ? "h-8 w-8 text-white" : "h-7 w-7 text-muted-foreground",
                      )}
                      strokeWidth={2.25}
                    />
                  </div>
                  <div>
                    <p
                      className={cn(
                        "font-bold",
                        role === "freelancer" ? "text-lg text-white" : "text-base text-foreground",
                      )}
                    >
                      {t("onboarding.wantToHelp")}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-sm",
                        role === "freelancer" ? "text-white/85" : "text-muted-foreground",
                      )}
                    >
                      {t("onboarding.wantToHelpHint")}
                    </p>
                  </div>
                  {role === "freelancer" ? (
                    <div className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-white">
                      <Check className="h-3 w-3 text-emerald-600" />
                    </div>
                  ) : null}
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

            {step === detailsStep && (
              <div className="space-y-4">
                <FloatingLabelInput
                  id="fullName"
                  ref={fullNameRef}
                  label={t("onboarding.fullName")}
                  name="name"
                  autoComplete="name"
                  autoCapitalize="words"
                  autoCorrect="off"
                  autoFocus
                  enterKeyHint="next"
                  inputMode="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    if (cityInputRef.current) {
                      focusRegisterField(cityInputRef.current);
                      return;
                    }
                    const tryFocusCity = (attempt: number) => {
                      if (cityInputRef.current) {
                        focusRegisterField(cityInputRef.current);
                        return;
                      }
                      if (attempt >= 20) return;
                      window.setTimeout(() => tryFocusCity(attempt + 1), 80);
                    };
                    tryFocusCity(0);
                  }}
                />

                <CreateJobCityAutocomplete
                  size="compact"
                  label={t("onboarding.city")}
                  confirmedCity={citySelection?.label ?? ""}
                  isConfirmed={cityConfirmed}
                  onPickCity={setCitySelection}
                  onInvalidateSelection={() => setCitySelection(null)}
                  inputRef={cityInputRef}
                  enterKeyHint="next"
                  onInputKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    if (!fullName.trim() || !cityConfirmed) return;
                    e.preventDefault();
                    void handleNameCitySubmit();
                  }}
                />
              </div>
            )}

            {step === 3 && isHelper && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {SERVICE_CATEGORIES.map((cat) => {
                    const selected = categories.includes(cat.id);
                    const Icon = CATEGORY_ICONS[cat.id] ?? HelpingHand;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setCategories((prev) => {
                            if (prev.includes(cat.id)) {
                              if (cat.id === "other_help") setOtherHelpSubs([]);
                              return prev.filter((id) => id !== cat.id);
                            }
                            return [...prev, cat.id];
                          });
                          setError("");
                        }}
                        aria-pressed={selected}
                        className={cn(
                          "relative flex items-center gap-3.5 rounded-2xl border-2 px-4 py-4 text-left transition-all",
                          selected
                            ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                            : "border-transparent bg-muted/20 hover:bg-muted/30",
                        )}
                      >
                        {selected ? (
                          <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md">
                            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl",
                            CATEGORY_ICON_COLORS[cat.id] ?? "bg-muted/60 text-muted-foreground",
                          )}
                        >
                          <Icon className="h-8 w-8" strokeWidth={1.85} />
                        </span>
                        <span
                          className={cn(
                            "min-w-0 text-sm font-semibold leading-snug",
                            selected ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {t(`feed.categories.${cat.id}`, { defaultValue: cat.label })}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {categories.includes("other_help") ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {OTHER_HELP_SUBCATEGORIES.map((sub) => {
                      const selected = otherHelpSubs.includes(sub.id);
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            setOtherHelpSubs((prev) =>
                              prev.includes(sub.id)
                                ? prev.filter((id) => id !== sub.id)
                                : [...prev, sub.id],
                            );
                            setError("");
                          }}
                          aria-pressed={selected}
                          className={cn(
                            "flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left text-[13px] font-semibold transition-all",
                            selected
                              ? "border-emerald-500 bg-emerald-500/10 text-foreground"
                              : "border-transparent bg-muted/15 text-muted-foreground hover:bg-muted/30",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                              selected
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-border",
                            )}
                          >
                            {selected ? (
                              <Check className="h-3 w-3" strokeWidth={2.5} />
                            ) : null}
                          </span>
                          {t(`otherHelpSubcategories.${sub.id}`, {
                            defaultValue: sub.label,
                          })}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    "mb-2 w-full rounded-full border font-semibold shadow-none",
                    embedded
                      ? "border-black/10 bg-white text-black hover:bg-white hover:text-black"
                      : "border-0 bg-zinc-100 text-black hover:bg-zinc-200 hover:text-black dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700 dark:hover:text-white",
                  )}
                  onClick={handleGoogleSignUp}
                  disabled={loading}
                >
                  <GoogleIcon className="mr-2 h-6 w-6" />
                  {t("onboarding.googleContinue")}
                </Button>
                <div className="relative mb-6 mt-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/60" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className={cn("px-2 text-muted-foreground", embedded ? "bg-[#FAF6EF] dark:bg-[#09090b]" : "bg-card")}>{t("onboarding.orEmail")}</span>
                  </div>
                </div>

                <FloatingLabelInput
                  id="email"
                  ref={emailRef}
                  label={t("onboarding.email")}
                  type="email"
                  name="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                  enterKeyHint="next"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    focusRegisterField(passwordRef.current);
                  }}
                />

                <FloatingLabelInput
                  id="password"
                  ref={passwordRef}
                  label={t("onboarding.password")}
                  type="password"
                  name="new-password"
                  autoComplete="new-password"
                  enterKeyHint="go"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    void handleRegister();
                  }}
                />
              </div>
            )}

          </div>
        </div>
        </main>

        <div
          className={cn(
            embedded
              ? "shrink-0 bg-[#FAF6EF] p-4 dark:bg-[#09090b]"
              : "fixed inset-x-0 bottom-0 z-50 bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] lg:left-[45%]",
          )}
        >
          <div className="mx-auto flex w-full max-w-[460px] gap-3">
            {step === 1 ? (
              <>
                {embedded ? null : (
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => navigate("/")}
                  className={cn("flex-1", backBtnClass)}
                >
                  {t("onboarding.back")}
                </Button>
                )}
                <Button
                  onClick={() => void handleRegister()}
                  disabled={loading || !email.trim() || !password.trim()}
                  className={cn("flex-1", primaryBtnClass)}
                >
                  {loading ? t("onboarding.creatingAccount") : t("onboarding.createAccount")}
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </>
            ) : step === 2 ? (
              <>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => goToRegisterStep(1)}
                  disabled={loading}
                  className={cn("flex-1", backBtnClass)}
                >
                  {t("onboarding.back")}
                </Button>
                <Button
                  onClick={handleRoleContinue}
                  disabled={loading}
                  className={cn("flex-1", primaryBtnClass)}
                >
                  {t("onboarding.continue")}
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </>
            ) : step === 3 && isHelper ? (
              <>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => goToRegisterStep(2)}
                  disabled={loading}
                  className={cn("flex-1", backBtnClass)}
                >
                  {t("onboarding.back")}
                </Button>
                <Button
                  onClick={() => void handleCategoriesContinue()}
                  disabled={loading || categories.length === 0}
                  className={cn("flex-1", primaryBtnClass)}
                >
                  {t("onboarding.continue")}
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => goToRegisterStep(isHelper ? 3 : 2)}
                  disabled={loading}
                  className={cn("flex-1", backBtnClass)}
                >
                  {t("onboarding.back")}
                </Button>
                <Button
                  onClick={() => void handleNameCitySubmit()}
                  disabled={loading || !fullName.trim() || !cityConfirmed}
                  className={cn("flex-1", primaryBtnClass)}
                >
                  {t("onboarding.continue")}
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

