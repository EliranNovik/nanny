import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  kycBlockedActionMessage,
  needsKycVerification,
  type KycBlockedAction,
} from "@/lib/kyc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const HOURLY_REMINDER_MS = 60 * 60 * 1000;

function bannerDismissedKey(userId: string) {
  return `kyc_banner_dismissed_${userId}`;
}

function hourlyReminderKey(userId: string) {
  return `kyc_hourly_reminder_at_${userId}`;
}

function readBannerDismissed(userId: string | undefined): boolean {
  if (!userId) return false;
  return localStorage.getItem(bannerDismissedKey(userId)) === "1";
}

function clearKycReminderStorage(userId: string) {
  localStorage.removeItem(bannerDismissedKey(userId));
  localStorage.removeItem(hourlyReminderKey(userId));
}

type KycGateContextValue = {
  showKycReminder: boolean;
  guardKycAction: (action: KycBlockedAction, onAllowed: () => void) => void;
  openKycRequiredDialog: (action: KycBlockedAction) => void;
};

const KycGateContext = createContext<KycGateContextValue | null>(null);

function KycVerifyReminderBanner({
  onVerify,
  onDismiss,
}: {
  onVerify: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className={cn(
        "pointer-events-auto fixed inset-x-0 z-[62] px-3",
        "top-[calc(env(safe-area-inset-top,0px)+3.25rem)] md:top-auto md:bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:left-[220px]",
      )}
      role="status"
    >
      <div className="relative mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-50/95 py-3 pl-4 pr-3 shadow-lg backdrop-blur-md dark:border-amber-400/25 dark:bg-amber-950/90">
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-amber-800/70 transition-colors hover:bg-amber-200/60 hover:text-amber-950 dark:text-amber-200/70 dark:hover:bg-amber-900/60 dark:hover:text-amber-50"
          aria-label="Dismiss verification reminder"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
        <ShieldCheck
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden
        />
        <div className="min-w-0 flex-1 pr-6">
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-50">
            Verify your identity
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/80">
            Complete verification to post requests, go live, and share posts. You
            can finish this anytime.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0 rounded-full px-3 text-xs font-bold"
          onClick={onVerify}
        >
          Verify
        </Button>
      </div>
    </div>
  );
}

function KycVerifyRequiredDialog({
  open,
  action,
  onOpenChange,
  onVerify,
}: {
  open: boolean;
  action: KycBlockedAction;
  onOpenChange: (open: boolean) => void;
  onVerify: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
            Verification required
          </DialogTitle>
          <DialogDescription className="text-left pt-1">
            {kycBlockedActionMessage(action)}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button type="button" className="w-full rounded-xl" onClick={onVerify}>
            Verify now
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KycHourlyReminderDialog({
  open,
  onOpenChange,
  onVerify,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerify: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
            Reminder: verify your identity
          </DialogTitle>
          <DialogDescription className="text-left pt-1">
            You still need to complete identity verification to post requests, go
            live, and share posts. It only takes a few minutes.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button type="button" className="w-full rounded-xl" onClick={onVerify}>
            Verify now
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Remind me later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function KycGateProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const userId = profile?.id;

  /** User is already on the dedicated verify step — no floating banner. */
  const hideReminderOnRoute =
    pathname === "/onboarding" || pathname.startsWith("/onboarding/");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [hourlyReminderOpen, setHourlyReminderOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [blockedAction, setBlockedAction] =
    useState<KycBlockedAction>("start_request");

  const showKycReminder = needsKycVerification(profile);

  useEffect(() => {
    setBannerDismissed(readBannerDismissed(userId));
  }, [userId]);

  useEffect(() => {
    if (!showKycReminder && userId) {
      clearKycReminderStorage(userId);
      setBannerDismissed(false);
      setHourlyReminderOpen(false);
    }
  }, [showKycReminder, userId]);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    if (userId) {
      localStorage.setItem(bannerDismissedKey(userId), "1");
      localStorage.setItem(hourlyReminderKey(userId), String(Date.now()));
    }
  }, [userId]);

  const markHourlyReminderShown = useCallback(() => {
    if (userId) {
      localStorage.setItem(hourlyReminderKey(userId), String(Date.now()));
    }
  }, [userId]);

  useEffect(() => {
    if (!showKycReminder || !userId || !bannerDismissed) return;

    const maybeShowHourlyReminder = () => {
      if (dialogOpen || hourlyReminderOpen) return;
      const lastRaw = localStorage.getItem(hourlyReminderKey(userId));
      const last = lastRaw ? Number.parseInt(lastRaw, 10) : 0;
      if (Number.isNaN(last)) return;
      if (Date.now() - last < HOURLY_REMINDER_MS) return;
      setHourlyReminderOpen(true);
      markHourlyReminderShown();
    };

    maybeShowHourlyReminder();
    const intervalId = window.setInterval(maybeShowHourlyReminder, 60_000);
    return () => window.clearInterval(intervalId);
  }, [
    bannerDismissed,
    dialogOpen,
    hourlyReminderOpen,
    markHourlyReminderShown,
    showKycReminder,
    userId,
  ]);

  const openKycRequiredDialog = useCallback((action: KycBlockedAction) => {
    setBlockedAction(action);
    setDialogOpen(true);
  }, []);

  const guardKycAction = useCallback(
    (action: KycBlockedAction, onAllowed: () => void) => {
      if (needsKycVerification(profile)) {
        openKycRequiredDialog(action);
        return;
      }
      onAllowed();
    },
    [openKycRequiredDialog, profile],
  );

  const goVerify = useCallback(() => {
    setDialogOpen(false);
    setHourlyReminderOpen(false);
    navigate("/onboarding/verify");
  }, [navigate]);

  const handleHourlyReminderChange = useCallback(
    (open: boolean) => {
      setHourlyReminderOpen(open);
      if (!open) {
        markHourlyReminderShown();
      }
    },
    [markHourlyReminderShown],
  );

  const value = useMemo(
    () => ({ showKycReminder, guardKycAction, openKycRequiredDialog }),
    [guardKycAction, openKycRequiredDialog, showKycReminder],
  );

  const showBanner =
    showKycReminder && !bannerDismissed && !hideReminderOnRoute;

  return (
    <KycGateContext.Provider value={value}>
      {children}
      {showBanner ? (
        <KycVerifyReminderBanner onVerify={goVerify} onDismiss={dismissBanner} />
      ) : null}
      <KycVerifyRequiredDialog
        open={dialogOpen}
        action={blockedAction}
        onOpenChange={setDialogOpen}
        onVerify={goVerify}
      />
      <KycHourlyReminderDialog
        open={hourlyReminderOpen}
        onOpenChange={handleHourlyReminderChange}
        onVerify={goVerify}
      />
    </KycGateContext.Provider>
  );
}

export function useKycGate(): KycGateContextValue {
  const ctx = useContext(KycGateContext);
  if (!ctx) {
    throw new Error("useKycGate must be used within KycGateProvider");
  }
  return ctx;
}

/** Safe when provider is optional (e.g. marketing pages). */
export function useKycGateOptional(): KycGateContextValue | null {
  return useContext(KycGateContext);
}
