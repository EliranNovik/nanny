import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { useKycGate } from "@/context/KycGateContext";
import { needsKycVerification } from "@/lib/kyc";
import { useToast } from "@/components/ui/toast";
import { apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader2, Radio } from "lucide-react";
import { queryKeys } from "@/hooks/data/keys";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  isServiceCategoryId,
  SERVICE_CATEGORY_IDS,
} from "@/lib/serviceCategories";
import { cn } from "@/lib/utils";

/** Default availability window data when going live without the old multi-step picker. */
const DEFAULT_LIVE_CAN_START = "immediate";

export default function PostAvailabilityNowPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { openKycRequiredDialog } = useKycGate();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [submitting, setSubmitting] = useState(false);

  const mainTabHomePath = useMemo(() => {
    if (profile?.is_admin) return "/admin";
    if (profile?.role === "freelancer") return "/freelancer/home";
    return "/client/home";
  }, [profile?.is_admin, profile?.role]);

  /** Go live with the helper's configured service categories (fallback: all categories). */
  const liveCategories = useMemo(() => {
    const fromProfile = (profile?.categories ?? []).filter((c) =>
      isServiceCategoryId(c),
    );
    return fromProfile.length > 0 ? fromProfile : [...SERVICE_CATEGORY_IDS];
  }, [profile?.categories]);

  const handleCancel = () => navigate(mainTabHomePath, { replace: true });

  const handleConfirm = async () => {
    if (!user?.id || !profile) return;
    if (profile.location_lat == null || profile.location_lng == null) {
      addToast({
        title: t("goLiveModal.locationTitle"),
        description: t("goLiveModal.locationBody"),
        variant: "warning",
      });
      navigate("/freelancer/profile/services");
      return;
    }
    if (needsKycVerification(profile)) {
      openKycRequiredDialog("go_live");
      return;
    }
    setSubmitting(true);
    try {
      await apiPost("/api/freelancer/go-live", {
        live_categories: liveCategories,
        live_can_start_in: DEFAULT_LIVE_CAN_START,
      });

      await queryClient.invalidateQueries({
        queryKey: queryKeys.discoverLiveAvatars(),
      });

      addToast({
        title: t("goLiveModal.successTitle"),
        description: t("goLiveModal.successBody"),
        variant: "success",
      });
      navigate(mainTabHomePath, { replace: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Try again.";
      if (message.toLowerCase().includes("verify")) {
        openKycRequiredDialog("go_live");
      }
      addToast({
        title: t("goLiveModal.errorTitle"),
        description: message,
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !submitting) handleCancel();
      }}
    >
      <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden">
        <div className="flex flex-col items-center gap-4 px-6 pb-6 pt-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <Radio className="h-7 w-7" strokeWidth={2.5} aria-hidden />
          </span>
          <DialogHeader className="gap-2">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
              {t("goLiveModal.eyebrow")}
            </p>
            <DialogTitle className="text-xl font-black tracking-tight text-foreground">
              {t("goLiveModal.title")}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              {t("goLiveModal.body")}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 flex w-full flex-col gap-2.5">
            <Button
              type="button"
              className={cn(
                "h-12 w-full rounded-xl font-semibold text-white",
                "bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 hover:from-emerald-600 hover:to-teal-600",
              )}
              disabled={submitting}
              onClick={() => void handleConfirm()}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("goLiveModal.going")}
                </>
              ) : (
                t("goLiveModal.confirm")
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full rounded-xl font-semibold"
              disabled={submitting}
              onClick={handleCancel}
            >
              {t("goLiveModal.cancel")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
