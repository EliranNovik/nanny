import { useTranslation } from "react-i18next";
import { ProfileSubpageLayout } from "@/components/profile/ProfileSubpageLayout";
import { ProfileAccountDangerZone } from "@/components/profile/ProfileAccountDangerZone";
import { ProfilePushPreferences } from "@/components/profile/ProfilePushPreferences";

export function ProfileAccountPage() {
  const { t } = useTranslation();

  return (
    <ProfileSubpageLayout
      title={t("profile.myAccount")}
      description={t("profile.myAccountDescription")}
      className="bg-white dark:bg-background"
    >
      <ProfilePushPreferences />
      <ProfileAccountDangerZone />
    </ProfileSubpageLayout>
  );
}
