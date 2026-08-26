import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  Baby,
  Check,
  ChefHat,
  HelpingHand,
  HeartHandshake,
  Sparkles,
  Truck,
  Wrench,
} from "lucide-react";
import {
  SUPPORTED_LOCALES,
  isRtlLocale,
  normalizeAppLocale,
  type AppLocale,
} from "@/i18n";
import { LOCALE_LABEL_KEYS } from "@/components/i18n/localeLabels";
import {
  guestSiteHeaderChromeProps,
  LandingSiteHeader,
} from "@/components/LandingSiteHeader";
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
  savePendingProfile,
} from "@/lib/pendingProfile";

type Role = "client" | "freelancer";

const CATEGORY_ICONS = {
  cleaning: Sparkles,
  cooking: ChefHat,
  pickup_delivery: Truck,
  nanny: Baby,
  technical_help: Wrench,
  other_help: HelpingHand,
} as const;

const CATEGORY_ICON_COLORS: Record<string, string> = {
  cleaning: "bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300",
  cooking: "bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300",
  pickup_delivery: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300",
  nanny: "bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300",
  technical_help: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  other_help: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300",
};

export default function OnboardingPage() {
  const { user, profile, loading: authLoading, refreshProfile, applyProfile } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [appLocale, setAppLocale] = useState<AppLocale>(() =>
    normalizeAppLocale(i18n.language ?? "en"),
  );
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

          const shouldVerify =
            !existingProfile.is_admin &&
            existingProfile.kyc_status !== "approved" &&
            existingProfile.kyc_status !== "skipped";
          const target = shouldVerify
            ? "/onboarding/verify"
            : existingProfile.role === "client"
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
        <LandingSiteHeader {...guestSiteHeaderChromeProps} />
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
      setError(t("onboarding.errors.nameCityRequired"));
      return;
    }

    setError("");
    setStep(2);
  }

  async function applyRegisterLocale(locale: AppLocale) {
    setAppLocale(locale);
    await i18n.changeLanguage(locale);
  }

  function helperCategories() {
    return [
      ...categories,
      ...(categories.includes("other_help") ? otherHelpSubs : []),
    ];
  }

  function pendingPayload() {
    const cityFields = pendingCityFields();
    if (!cityFields) return null;
    return {
      role,
      fullName: fullName.trim(),
      ...cityFields,
      locale: appLocale,
      categories: role === "freelancer" ? helperCategories() : undefined,
    };
  }

  async function handleLanguageContinue() {
    await applyRegisterLocale(appLocale);
    const pending = pendingPayload();
    if (pending) savePendingProfile(pending);

    if (role === "freelancer" || !user) {
      setStep(3);
      return;
    }

    await createProfile();
  }

  async function handleCategoriesContinue() {
    if (categories.length === 0) {
      setError(t("onboarding.errors.categoriesRequired"));
      return;
    }
    setError("");
    const pending = pendingPayload();
    if (pending) savePendingProfile(pending);

    if (!user) {
      setStep(4);
      return;
    }

    await createProfile();
  }

  async function handleGoogleSignUp() {
    const cityFields = pendingCityFields();
    if (!cityFields) {
      setError(t("onboarding.errors.cityRequired"));
      return;
    }

    setLoading(true);
    setError("");
    if (role === "freelancer" && categories.length === 0) {
      setError(t("onboarding.errors.categoriesRequired"));
      return;
    }

    savePendingProfile({
      role,
      fullName: fullName.trim(),
      ...cityFields,
      locale: appLocale,
      categories:
        role === "freelancer"
          ? [
              ...categories,
              ...(categories.includes("other_help") ? otherHelpSubs : []),
            ]
          : undefined,
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
      setError(t("onboarding.errors.emailPasswordRequired"));
      return;
    }

    if (!cityFields) {
      setError(t("onboarding.errors.cityRequired"));
      return;
    }

    if (password.length < 6) {
      setError(t("onboarding.errors.passwordShort"));
      return;
    }

    if (role === "freelancer" && categories.length === 0) {
      setError(t("onboarding.errors.categoriesRequired"));
      return;
    }

    setLoading(true);
    setError("");
    savePendingProfile({
      role,
      fullName: fullName.trim(),
      ...cityFields,
      locale: appLocale,
      categories:
        role === "freelancer"
          ? [
              ...categories,
              ...(categories.includes("other_help") ? otherHelpSubs : []),
            ]
          : undefined,
    });

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

      const shouldVerify =
        !existingProfile.is_admin &&
        existingProfile.kyc_status !== "approved" &&
        existingProfile.kyc_status !== "skipped";
      const target = shouldVerify
        ? "/onboarding/verify"
        : existingProfile.role === "client"
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
    navigate("/onboarding/verify", { replace: true });
    void refreshProfile();
  }

  console.log("[OnboardingPage] Rendering onboarding form");

  const isHelper = role === "freelancer";
  const isRtl = isRtlLocale(appLocale);
  const totalSteps = isHelper ? 4 : 3;
  const accountStep = isHelper ? 4 : 3;
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
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-white dark:bg-background">
      <LandingSiteHeader {...guestSiteHeaderChromeProps} className="shrink-0" />
      <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* LEFT COLUMN - Visual Experience (Desktop Only) */}
      <div
        className={cn(
          "relative hidden h-full min-h-0 shrink-0 flex-col justify-end overflow-hidden bg-slate-900 p-16 lg:flex lg:w-[45%]",
          isRtl ? "rounded-s-[2rem] pb-24 pe-20" : "rounded-e-[2rem] pb-20",
        )}
      >
        <img
          src="/ChatGPT Image Apr 19, 2026, 11_35_26 AM.png"
          alt="Trusted professionals connecting locally"
          className="absolute inset-0 h-full w-full object-cover object-right"
        />
        
        <div className="relative z-10 animate-fade-up pointer-events-none">
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

      {/* RIGHT COLUMN - Auth Form */}
      <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 bg-white px-6 pt-4 pb-3 dark:bg-background md:px-10 lg:px-12">
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
              <span
                className={cn(
                  "text-[11px] font-medium",
                  progressStep >= 1 ? accentTextClass : "text-muted-foreground",
                )}
              >
                {t("onboarding.stepDetails")}
              </span>
              <span
                className={cn(
                  "text-[11px] font-medium",
                  progressStep >= 2 ? accentTextClass : "text-muted-foreground",
                )}
              >
                {t("onboarding.stepLanguage")}
              </span>
              {isHelper ? (
                <span
                  className={cn(
                    "text-[11px] font-medium",
                    progressStep >= 3 ? accentTextClass : "text-muted-foreground",
                  )}
                >
                  {t("onboarding.stepCategories")}
                </span>
              ) : null}
              <span
                className={cn(
                  "text-[11px] font-medium",
                  progressStep >= accountStep ? accentTextClass : "text-muted-foreground",
                )}
              >
                {t("onboarding.stepAccount")}
              </span>
            </div>
          </div>
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-6 pt-4 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:px-10 md:pt-6">
          <div className="mx-auto w-full max-w-[460px] animate-fade-in">
          <div className={cn("text-center", step === 1 ? "mb-6" : "mb-8 md:mb-10")}>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {step === 1
                ? t("onboarding.titleNameCity")
                : step === 2
                  ? t("onboarding.titleLanguage")
                  : step === 3 && isHelper
                    ? t("onboarding.titleCategories")
                    : t("onboarding.titleAccount")}
            </h1>
            {step === 2 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("onboarding.subtitleLanguage")}
              </p>
            ) : null}
            {step === 3 && isHelper ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("onboarding.subtitleCategories")}
              </p>
            ) : null}
            {step === accountStep ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("onboarding.subtitleAccount")}
              </p>
            ) : null}
          </div>

          {/* Role selector — shown at top of step 1 */}
          {step === 1 && (
            <div className="mb-6">
              <p className="mb-10 text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground sm:text-base">
                {t("onboarding.joiningAs")}
              </p>
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

            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">{t("onboarding.fullName")}</Label>
                  <Input
                    id="fullName"
                    placeholder={t("onboarding.fullNamePlaceholder")}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">{t("onboarding.city")}</Label>
                  <CreateJobCityAutocomplete
                    size="compact"
                    confirmedCity={citySelection?.label ?? ""}
                    isConfirmed={cityConfirmed}
                    onPickCity={setCitySelection}
                    onInvalidateSelection={() => setCitySelection(null)}
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-2.5">
                  {SUPPORTED_LOCALES.map((locale) => {
                    const selected = appLocale === locale;
                    return (
                      <button
                        key={locale}
                        type="button"
                        onClick={() => {
                          void applyRegisterLocale(locale);
                        }}
                        aria-pressed={selected}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all",
                          selected
                            ? isHelper
                              ? "border-emerald-500/40 bg-emerald-500/10 shadow-sm"
                              : "border-primary/40 bg-primary/10 shadow-sm"
                            : "border-border/70 bg-muted/20 hover:bg-muted/30",
                        )}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/80 text-[11px] font-bold uppercase tracking-wide text-foreground/80">
                          {locale}
                        </span>
                        <span className="min-w-0 flex-1 text-base font-semibold text-foreground">
                          {t(LOCALE_LABEL_KEYS[locale])}
                        </span>
                        {selected ? (
                          <Check
                            className={cn("h-5 w-5 shrink-0", accentTextClass)}
                            strokeWidth={2.25}
                            aria-hidden
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
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

            {step === accountStep && (
              <div className="space-y-4">
                <Button
                  type="button"
                  variant="ghost"
                  className="mb-2 w-full rounded-full border-0 bg-zinc-100 font-semibold text-black shadow-none hover:bg-zinc-200 hover:text-black dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700 dark:hover:text-white"
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
                    <span className="bg-card px-2 text-muted-foreground">{t("onboarding.orEmail")}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t("onboarding.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t("onboarding.emailPlaceholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">{t("onboarding.password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={t("onboarding.passwordPlaceholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            )}

          </div>
        </div>
        </main>

        <div className="fixed inset-x-0 bottom-0 z-50 bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] lg:left-[45%]">
          <div className="mx-auto flex w-full max-w-[460px] gap-3">
            {step === 1 ? (
              <>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => navigate("/")}
                  className={cn("flex-1", backBtnClass)}
                >
                  {t("onboarding.back")}
                </Button>
                <Button
                  onClick={handleNameCitySubmit}
                  disabled={loading || !fullName.trim() || !cityConfirmed}
                  className={cn("flex-1", primaryBtnClass)}
                >
                  {t("onboarding.continue")}
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </>
            ) : step === 2 ? (
              <>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={loading}
                  className={cn("flex-1", backBtnClass)}
                >
                  {t("onboarding.back")}
                </Button>
                <Button
                  onClick={() => void handleLanguageContinue()}
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
                  onClick={() => setStep(2)}
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
                  onClick={() => setStep(isHelper ? 3 : 2)}
                  disabled={loading}
                  className={cn("flex-1", backBtnClass)}
                >
                  {t("onboarding.back")}
                </Button>
                <Button
                  onClick={handleRegister}
                  disabled={loading}
                  className={cn("flex-1", primaryBtnClass)}
                >
                  {loading ? t("onboarding.creatingAccount") : t("onboarding.createAccount")}
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

