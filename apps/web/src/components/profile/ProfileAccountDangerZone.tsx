import { useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

function mapDeleteAccountError(message: string | undefined, t: (key: string) => string) {
  if (!message) {
    return t("profile.dangerZone.errorBody");
  }
  if (message.includes("not_authenticated")) {
    return t("profile.dangerZone.errorNotAuthenticated");
  }
  if (message.includes("account_not_found")) {
    return t("profile.dangerZone.errorNotFound");
  }
  return t("profile.dangerZone.errorBody");
}

export function ProfileAccountDangerZone() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const { error } = await supabase.rpc("delete_own_account");
      if (error) {
        throw error;
      }

      await signOut();
      navigate("/", { replace: true });
      addToast({
        variant: "success",
        title: t("profile.dangerZone.successTitle"),
        description: t("profile.dangerZone.successBody"),
        duration: 5000,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : typeof err === "object" && err && "message" in err
          ? String((err as { message?: string }).message)
          : undefined;

      addToast({
        variant: "error",
        title: t("profile.dangerZone.errorTitle"),
        description: mapDeleteAccountError(message, t),
        duration: 6000,
      });
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <section
        className={cn(
          "rounded-[24px] border border-destructive/20 bg-destructive/5 px-5 py-6",
          "shadow-sm",
        )}
        aria-labelledby="profile-danger-zone-title"
      >
        <p
          id="profile-danger-zone-title"
          className="text-xs font-black uppercase tracking-[0.18em] text-destructive"
        >
          {t("profile.dangerZone.title")}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("profile.dangerZone.description")}
        </p>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="mt-5 gap-2 rounded-xl"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          {t("profile.dangerZone.deleteAccount")}
        </Button>
      </section>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!deleting) setConfirmOpen(open);
        }}
      >
        <DialogContent className="max-w-md overflow-hidden rounded-3xl p-0">
          <div className="flex flex-col items-center gap-4 px-6 pb-6 pt-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
              <AlertTriangle className="h-7 w-7" strokeWidth={2.5} aria-hidden />
            </span>
            <DialogHeader className="gap-2">
              <DialogTitle className="text-xl font-black tracking-tight text-foreground">
                {t("profile.dangerZone.confirmTitle")}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                {t("profile.dangerZone.confirmBody")}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 flex w-full flex-col gap-2.5">
              <Button
                type="button"
                variant="destructive"
                className="h-12 w-full rounded-xl font-semibold"
                disabled={deleting}
                onClick={() => void handleDeleteAccount()}
              >
                {deleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("profile.dangerZone.deleting")}
                  </>
                ) : (
                  t("profile.dangerZone.confirmDelete")
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11 w-full rounded-xl font-semibold"
                disabled={deleting}
                onClick={() => setConfirmOpen(false)}
              >
                {t("profile.dangerZone.cancel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
