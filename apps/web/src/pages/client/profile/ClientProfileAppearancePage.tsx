import { useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ProfileSubpageLayout } from "@/components/profile/ProfileSubpageLayout";
import { ThemePreferenceSelector } from "@/components/ThemePreferenceSelector";
import type { ClientProfileFormContext } from "@/hooks/useClientProfileForm";
import { Save, Loader2 } from "lucide-react";

export default function ClientProfileAppearancePage() {
  const { t } = useTranslation();
  const ctx = useOutletContext<ClientProfileFormContext>();

  return (
    <ProfileSubpageLayout
      title={t("profile.appearance")}
      description={t("profile.theme.pageDescription")}
    >
      <div className="space-y-8">
        <div className="space-y-3 rounded-xl border border-border/50 p-4">
          <div>
            <p className="font-medium">{t("profile.theme.title")}</p>
            <p className="text-sm text-muted-foreground">
              {t("profile.theme.description")}
            </p>
          </div>
          <ThemePreferenceSelector />
        </div>

        <Button
          className="w-full"
          size="lg"
          onClick={ctx.handleSave}
          disabled={ctx.saving}
        >
          {ctx.saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save
        </Button>
      </div>
    </ProfileSubpageLayout>
  );
}
