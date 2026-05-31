import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ShieldCheck,
  CreditCard,
  ScanFace,
  Loader2,
  ArrowRight,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { apiGet, apiPost } from "@/lib/api";
import {
  needsKycVerification,
  roleHomePath,
} from "@/lib/kyc";
import { Button } from "@/components/ui/button";

type KycStatusResponse = {
  kyc_status: string;
  kyc_session_id: string | null;
  kyc_verified_at: string | null;
  is_verified: boolean;
};

type CreateSessionResponse = {
  session_id?: string;
  url?: string;
  kyc_status?: string;
  alreadyVerified?: boolean;
};

export default function KycVerificationPage() {
  const { user, profile, loading, refreshProfile, applyProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnedFromDidit = searchParams.get("return") === "1";

  const [kycStatus, setKycStatus] = useState<string>("not_started");
  const [busy, setBusy] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const homePath = useMemo(
    () => (profile ? roleHomePath(profile.role) : "/"),
    [profile],
  );

  const displayName = useMemo(() => {
    const fromProfile = profile?.full_name?.trim();
    if (fromProfile) return fromProfile.split(/\s+/)[0];
    const meta = user?.user_metadata?.full_name;
    if (typeof meta === "string" && meta.trim()) {
      return meta.trim().split(/\s+/)[0];
    }
    return "there";
  }, [profile?.full_name, user?.user_metadata?.full_name]);

  useEffect(() => {
    if (loading || !user || profile) return;

    let cancelled = false;
    setProfileLoading(true);
    void (async () => {
      try {
        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (profileError) throw profileError;
        if (data) {
          applyProfile(data);
        }
      } catch (err) {
        console.error("[KycVerificationPage] profile load failed", err);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyProfile, loading, profile, user]);

  const refreshStatus = useCallback(
    async (fromDidit = false) => {
      if (!user) return;
      setPolling(true);
      try {
        const data = await apiGet<KycStatusResponse>(
          `/api/kyc/status${fromDidit ? "?refresh=1" : ""}`,
        );
        setKycStatus(data.kyc_status);
        if (data.kyc_status === "approved") {
          await refreshProfile();
        }
      } catch (err: unknown) {
        console.error("[KycVerificationPage] status refresh failed", err);
      } finally {
        setPolling(false);
      }
    },
    [refreshProfile, user],
  );

  useEffect(() => {
    if (loading || !user || !profile) return;
    if (!needsKycVerification(profile)) {
      navigate(homePath, { replace: true });
      return;
    }
    setKycStatus(profile.kyc_status ?? "not_started");
    if (returnedFromDidit) {
      void refreshStatus(true);
    }
  }, [
    homePath,
    loading,
    navigate,
    profile,
    refreshStatus,
    returnedFromDidit,
    user,
  ]);

  useEffect(() => {
    if (!returnedFromDidit || kycStatus === "approved") return;
    const id = window.setInterval(() => {
      void refreshStatus(true);
    }, 4000);
    return () => window.clearInterval(id);
  }, [kycStatus, refreshStatus, returnedFromDidit]);

  useEffect(() => {
    if (kycStatus === "approved" && profile) {
      navigate(homePath, { replace: true });
    }
  }, [homePath, kycStatus, navigate, profile]);

  async function skipVerification() {
    setError(null);
    setBusy(true);
    try {
      await apiPost("/api/kyc/skip", {});
      await refreshProfile();
      navigate(homePath, { replace: true });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Could not skip verification";
      setError(message);
      setBusy(false);
    }
  }

  async function startVerification() {
    setError(null);
    setBusy(true);
    try {
      const data = await apiPost<CreateSessionResponse>("/api/kyc/session", {});
      if (data.alreadyVerified) {
        await refreshProfile();
        navigate(homePath, { replace: true });
        return;
      }
      if (!data.url) {
        throw new Error("Verification link was not returned");
      }
      window.location.href = data.url;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Could not start verification";
      setError(message);
      setBusy(false);
    }
  }

  if (loading || profileLoading || !user || !profile) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  const isDeclined = kycStatus === "declined";
  const isReview = kycStatus === "in_review" || kycStatus === "pending_review";
  const isWaiting =
    returnedFromDidit &&
    (kycStatus === "in_progress" || isReview) &&
    !isDeclined;

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-background text-foreground">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,hsl(var(--primary)/0.12),transparent)]"
        aria-hidden
      />

      <header className="relative z-10 bg-background/80 px-5 pb-6 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md md:pb-8">
        <div className="mx-auto flex w-full max-w-xl items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" strokeWidth={2.25} aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Identity verification
            </p>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">
              Verify your ID
            </h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col justify-center px-5 py-10 md:py-12">
        <div className="mx-auto flex w-full max-w-xl flex-col space-y-8 md:space-y-10">
        <p className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Welcome, {displayName}
        </p>
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-3xl bg-primary/5 shadow-sm ring-1 ring-border/40">
            <img
              src="/images/id-card-scan.png"
              alt="Scanning an ID card with your phone"
              className="aspect-[16/10] w-full object-cover"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-5 pb-3 pt-16 md:px-6 md:pb-4 md:pt-20">
              <p className="text-base leading-relaxed text-white/95 md:text-lg">
                A verified profile builds trust across the community. Confirm your
                identity with a photo ID and a quick selfie.
              </p>
            </div>
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          ) : null}

          {isWaiting ? (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
              <p className="text-sm font-semibold">Processing your verification</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                This usually takes under a minute.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 rounded-full"
                disabled={polling}
                onClick={() => void refreshStatus(true)}
              >
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
                Refresh status
              </Button>
            </div>
          ) : null}

          {isDeclined ? (
            <p className="text-sm text-muted-foreground">
              Verification failed. Try again with a clear, valid ID that matches
              your profile name.
            </p>
          ) : null}

          {!isWaiting ? (
            <Button
              type="button"
              size="lg"
              className="h-14 w-full rounded-2xl text-base font-bold md:text-lg"
              disabled={busy}
              onClick={() => void startVerification()}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
                  Opening verification…
                </>
              ) : (
                <>
                  {isDeclined ? "Try again" : "Continue to verification"}
                  <ArrowRight className="ml-2 h-5 w-5" aria-hidden />
                </>
              )}
            </Button>
          ) : null}

          <p className="text-right text-xs text-muted-foreground md:text-sm">
            Powered by{" "}
            <span className="font-semibold text-foreground">Didit</span>
          </p>
        </div>

        <ul className="grid grid-cols-3 gap-3 md:gap-4">
          {[
            {
              icon: CreditCard,
              title: "Photo ID",
              text: "Passport or national ID",
            },
            {
              icon: ScanFace,
              title: "Live check",
              text: "Quick selfie match",
            },
            {
              icon: ShieldCheck,
              title: "Secure",
              text: "Encrypted — we only store the result",
            },
          ].map((item) => (
            <li
              key={item.title}
              className="flex flex-col items-center gap-2 text-center"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-background/80 text-primary shadow-sm dark:bg-zinc-800 md:h-14 md:w-14">
                <item.icon className="h-6 w-6 md:h-7 md:w-7" strokeWidth={2.25} aria-hidden />
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold leading-tight md:text-base">
                  {item.title}
                </p>
                <p className="text-xs leading-snug text-muted-foreground md:text-sm">
                  {item.text}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="space-y-4">
          {!isWaiting && !isReview ? (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="h-11 w-full rounded-2xl text-sm font-semibold text-muted-foreground"
              disabled={busy}
              onClick={() => void skipVerification()}
            >
              Skip for now
            </Button>
          ) : null}

          <p className="pt-2 text-center text-xs leading-relaxed text-muted-foreground">
            By continuing you agree to share ID details with our verification
            partner for identity checks only.
          </p>
        </div>
        </div>
      </main>
    </div>
  );
}
