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
import { apiGet, apiPost } from "@/lib/api";
import {
  kycStatusLabel,
  needsKycVerification,
  roleHomePath,
} from "@/lib/kyc";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnedFromDidit = searchParams.get("return") === "1";

  const [kycStatus, setKycStatus] = useState<string>("not_started");
  const [busy, setBusy] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const homePath = useMemo(
    () => (profile ? roleHomePath(profile.role) : "/"),
    [profile],
  );

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

  if (loading || !user || !profile) {
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

      <div className="relative mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Identity verification
            </p>
            <h1 className="text-xl font-bold tracking-tight">Verify your ID</h1>
          </div>
        </div>

        <div className="mb-8 space-y-4 rounded-3xl bg-muted/35 p-5 dark:bg-zinc-900/50">
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            To keep Tebnu safe for everyone, we verify your government ID and
            match your legal name and date of birth. This step is powered by{" "}
            <span className="font-semibold text-foreground">Didit</span>, a
            certified identity provider.
          </p>

          <ul className="space-y-3">
            {[
              {
                icon: CreditCard,
                title: "Photo ID",
                text: "Passport, national ID, or driver licence",
              },
              {
                icon: ScanFace,
                title: "Live check",
                text: "Quick selfie to confirm you match your document",
              },
              {
                icon: ShieldCheck,
                title: "Secure & private",
                text: "Encrypted end-to-end; we only store verification result",
              },
            ].map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background/80 text-primary shadow-sm dark:bg-zinc-800">
                  <item.icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-6 flex items-center justify-between rounded-2xl border border-border/40 bg-background/60 px-4 py-3 dark:border-white/10 dark:bg-zinc-950/40">
          <span className="text-sm text-muted-foreground">Status</span>
          <span
            className={cn(
              "text-sm font-bold",
              kycStatus === "approved" && "text-emerald-600 dark:text-emerald-400",
              isDeclined && "text-red-600 dark:text-red-400",
              isReview && "text-amber-600 dark:text-amber-400",
            )}
          >
            {polling ? "Updating…" : kycStatusLabel(kycStatus)}
          </span>
        </div>

        {error ? (
          <div className="mb-4 flex items-start gap-2 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        ) : null}

        {isWaiting ? (
          <div className="mb-6 flex flex-col items-center gap-3 rounded-2xl bg-muted/30 px-4 py-8 text-center dark:bg-zinc-900/40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
            <p className="text-sm font-semibold">Processing your verification</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              This usually takes under a minute. You can leave this page open or
              tap refresh if it takes longer.
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
          <p className="mb-4 text-sm text-muted-foreground">
            We could not verify your identity. Please try again with a clear,
            valid ID document that matches your profile name.
          </p>
        ) : null}

        <div className="mt-auto space-y-3 pt-4">
          {!isWaiting ? (
            <Button
              type="button"
              size="lg"
              className="h-12 w-full rounded-2xl text-base font-bold"
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

          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            By continuing you agree to share ID details with our verification
            partner for identity checks only.
          </p>
        </div>
      </div>
    </div>
  );
}
