import { useTranslation } from "react-i18next";
import { ProfileSubpageLayout } from "@/components/profile/ProfileSubpageLayout";
import { ProfileAccountDangerZone } from "@/components/profile/ProfileAccountDangerZone";
import { ProfileAccountIdentitySection } from "@/components/profile/ProfileAccountIdentitySection";
import { ProfilePushPreferences } from "@/components/profile/ProfilePushPreferences";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

export function ProfileAccountPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const email = user?.email?.trim() || "—";

  return (
    <ProfileSubpageLayout
      title={t("profile.myAccount")}
      description={t("profile.myAccountDescription")}
      className="bg-white dark:bg-background"
    >
      <section
        className={cn(
          "mb-6 rounded-2xl border border-border/40 bg-card/30 px-4 py-5 sm:px-6",
          "dark:border-white/10",
        )}
      >
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/90">
          {t("profile.accountEmail")}
        </p>
        <p className="break-all text-[16px] leading-relaxed text-foreground">{email}</p>
      </section>
      <ProfileAccountIdentitySection />
      <ProfilePushPreferences />
      <ProfileAccountDangerZone />
    </ProfileSubpageLayout>
  );
}
