import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Props = {
  /** Whether the user can receive help requests at all. */
  available: boolean;
  className?: string;
};

/** Saves `profiles.notify_new_requests` on its own, outside the profile form save. */
export function NewRequestAlertsToggle({ available, className }: Props) {
  const { t } = useTranslation();
  const { user, profile, refreshProfile } = useAuth();
  const { addToast } = useToast();
  const [enabled, setEnabled] = useState(profile?.notify_new_requests !== false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEnabled(profile?.notify_new_requests !== false);
  }, [profile?.notify_new_requests]);

  async function handleChange(next: boolean) {
    if (!user?.id || saving) return;
    const prev = enabled;
    setEnabled(next);
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ notify_new_requests: next })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      setEnabled(prev);
      addToast({
        title: t("profile.notifyNewRequestsSaveError"),
        description: error.message,
        variant: "error",
      });
      return;
    }
    void refreshProfile();
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-2xl border border-border/40 bg-card/25 px-4 py-4 sm:px-5",
        !available && "opacity-60",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-[15px] font-medium leading-tight">
          {t("profile.notifyNewRequests")}
        </p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {available
            ? t("profile.notifyNewRequestsHint")
            : t("profile.notifyNewRequestsNeedsAvailable")}
        </p>
      </div>
      <Switch
        checked={available && enabled}
        onCheckedChange={(v) => void handleChange(v)}
        disabled={!available || saving}
        aria-label={t("profile.notifyNewRequests")}
      />
    </div>
  );
}
