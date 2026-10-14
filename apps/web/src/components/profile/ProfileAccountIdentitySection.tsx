import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  isIdentityVerified,
  isKycUnderReview,
  roleAccountVerifyPath,
} from "@/lib/kyc";
import { cn } from "@/lib/utils";

export function ProfileAccountIdentitySection() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const verified = isIdentityVerified(profile);
  const reviewing = isKycUnderReview(profile?.kyc_status);
  const verifyPath = roleAccountVerifyPath(profile?.role ?? "client");

  return (
    <section
      className={cn(
        "mb-6 rounded-[24px] border border-slate-200/80 bg-white px-5 py-6 shadow-sm",
        "dark:border-0 dark:bg-zinc-900",
      )}
      aria-labelledby="profile-identity-title"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="profile-identity-title"
            className="text-sm font-semibold text-foreground"
          >
            {t("profile.identity.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("profile.identity.description")}
          </p>

          {verified ? (
            <p className="mt-4 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              {t("profile.identity.verified")}
            </p>
          ) : reviewing ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {t("profile.identity.reviewing")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("profile.identity.reviewingHint")}
              </p>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => navigate(verifyPath)}
              >
                {t("profile.identity.openStatus")}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              className="mt-4 rounded-xl"
              onClick={() => navigate(verifyPath)}
            >
              {t("profile.identity.verifyYourself")}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
