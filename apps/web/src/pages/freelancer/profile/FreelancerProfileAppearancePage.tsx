import { useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileSubpageLayout } from "@/components/profile/ProfileSubpageLayout";
import { ThemePreferenceSelector } from "@/components/ThemePreferenceSelector";
import type { FreelancerProfileFormContext } from "@/hooks/useFreelancerProfileForm";
import { Save, Loader2 } from "lucide-react";

export default function FreelancerProfileAppearancePage() {
  const { t } = useTranslation();
  const ctx = useOutletContext<FreelancerProfileFormContext>();

  return (
    <ProfileSubpageLayout
      title={t("profile.appearance")}
      description={t("profile.theme.pageDescriptionFreelancer")}
    >
      <div className="space-y-6">
        <Card className="border border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              {t("profile.theme.title")}
            </CardTitle>
            <CardDescription>{t("profile.theme.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ThemePreferenceSelector />
          </CardContent>
        </Card>

        <Button
          onClick={ctx.handleSave}
          disabled={ctx.saving}
          className="w-full"
          size="lg"
        >
          {ctx.saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save profile
            </>
          )}
        </Button>
      </div>
    </ProfileSubpageLayout>
  );
}
