import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";
import {
  GUEST_AUTH_PROMPT_COPY,
  type GuestAuthPromptVariant,
} from "@/lib/guestAuthPromptCopy";

export type { GuestAuthPromptVariant };

type GuestAuthPromptOptions = {
  /** Return path after sign-in (defaults to current page). */
  redirect?: string;
  /** Which invite copy to show. */
  variant?: GuestAuthPromptVariant;
};

type GuestAuthPromptContextValue = {
  openGuestAuthPrompt: (options?: GuestAuthPromptOptions) => void;
};

const GuestAuthPromptContext =
  createContext<GuestAuthPromptContextValue | null>(null);

function JoinCommunityDialog({
  open,
  variant,
  redirect,
  onOpenChange,
  onRegister,
  onSignIn,
}: {
  open: boolean;
  variant: GuestAuthPromptVariant;
  redirect: string;
  onOpenChange: (open: boolean) => void;
  onRegister: () => void;
  onSignIn: () => void;
}) {
  const copy = GUEST_AUTH_PROMPT_COPY[variant];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl border-0 bg-background px-6 pb-6 pt-8 text-center shadow-2xl outline-none ring-0 focus:outline-none sm:max-w-sm">
        <DialogHeader className="space-y-4 text-center sm:text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center">
            <img
              src={BRAND_LOGO_SRC}
              alt="tebnu"
              className="h-full w-full object-contain"
              width={80}
              height={80}
              decoding="async"
            />
          </div>
          <DialogTitle className="text-2xl font-black tracking-tight">
            {copy.title}
          </DialogTitle>
          <DialogDescription className="text-[15px] leading-relaxed text-muted-foreground">
            {copy.description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 flex-col gap-2.5 sm:flex-col">
          <Button
            type="button"
            className="h-11 w-full rounded-xl text-[15px] font-bold"
            onClick={onRegister}
          >
            Register for free
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-xl border-border/50 text-[15px] font-semibold"
            onClick={onSignIn}
          >
            Sign in
          </Button>
        </DialogFooter>
        <p className="sr-only">Return path: {redirect}</p>
      </DialogContent>
    </Dialog>
  );
}

export function GuestAuthPromptProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [redirect, setRedirect] = useState("/community/feed");
  const [variant, setVariant] = useState<GuestAuthPromptVariant>("engage");

  const openGuestAuthPrompt = useCallback(
    (options?: GuestAuthPromptOptions) => {
      const nextRedirect =
        options?.redirect ?? `${location.pathname}${location.search}`;
      setRedirect(nextRedirect);
      setVariant(options?.variant ?? "engage");
      setOpen(true);
    },
    [location.pathname, location.search],
  );

  const goRegister = useCallback(() => {
    setOpen(false);
    navigate("/onboarding");
  }, [navigate]);

  const goSignIn = useCallback(() => {
    setOpen(false);
    navigate(`/login?redirect=${encodeURIComponent(redirect)}`);
  }, [navigate, redirect]);

  const value = useMemo(
    () => ({ openGuestAuthPrompt }),
    [openGuestAuthPrompt],
  );

  return (
    <GuestAuthPromptContext.Provider value={value}>
      {children}
      <JoinCommunityDialog
        open={open}
        variant={variant}
        redirect={redirect}
        onOpenChange={setOpen}
        onRegister={goRegister}
        onSignIn={goSignIn}
      />
    </GuestAuthPromptContext.Provider>
  );
}

export function useGuestAuthPrompt(): GuestAuthPromptContextValue {
  const ctx = useContext(GuestAuthPromptContext);
  if (!ctx) {
    throw new Error(
      "useGuestAuthPrompt must be used within GuestAuthPromptProvider",
    );
  }
  return ctx;
}

/** Safe when provider is optional. */
export function useGuestAuthPromptOptional(): GuestAuthPromptContextValue | null {
  return useContext(GuestAuthPromptContext);
}
