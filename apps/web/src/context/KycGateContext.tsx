import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
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

type KycGateContextValue = {
  showKycReminder: boolean;
  guardKycAction: (action: KycBlockedAction, onAllowed: () => void) => void;
  openKycRequiredDialog: (action: KycBlockedAction) => void;
};

const KycGateContext = createContext<KycGateContextValue | null>(null);

function KycVerifyReminderBanner({ onVerify }: { onVerify: () => void }) {
  return (
    <div
      className={cn(
        "pointer-events-auto fixed inset-x-0 z-[62] px-3",
        "top-[calc(env(safe-area-inset-top,0px)+3.25rem)] md:top-auto md:bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:left-[220px]",
      )}
      role="status"
    >
      <div className="mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-50/95 px-4 py-3 shadow-lg backdrop-blur-md dark:border-amber-400/25 dark:bg-amber-950/90">
        <ShieldCheck
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-50">
            Verify your identity
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/80">
            Complete verification to post requests, go live, and share posts. You can finish this anytime.
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

export function KycGateProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [blockedAction, setBlockedAction] =
    useState<KycBlockedAction>("start_request");

  const showKycReminder = needsKycVerification(profile);

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
    navigate("/onboarding/verify");
  }, [navigate]);

  const value = useMemo(
    () => ({ showKycReminder, guardKycAction, openKycRequiredDialog }),
    [guardKycAction, openKycRequiredDialog, showKycReminder],
  );

  return (
    <KycGateContext.Provider value={value}>
      {children}
      {showKycReminder ? <KycVerifyReminderBanner onVerify={goVerify} /> : null}
      <KycVerifyRequiredDialog
        open={dialogOpen}
        action={blockedAction}
        onOpenChange={setDialogOpen}
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
