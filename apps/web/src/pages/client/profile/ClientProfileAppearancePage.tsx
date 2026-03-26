import { useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ProfileSubpageLayout } from "@/components/profile/ProfileSubpageLayout";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { ClientProfileFormContext } from "@/hooks/useClientProfileForm";
import { Save, Loader2 } from "lucide-react";

export default function ClientProfileAppearancePage() {
  const ctx = useOutletContext<ClientProfileFormContext>();

  return (
    <ProfileSubpageLayout title="Appearance" description="Theme preferences">
      <div className="space-y-8">
        <div className="flex items-center justify-between rounded-xl border border-border/50 p-4">
          <div>
            <p className="font-medium">Theme</p>
            <p className="text-sm text-muted-foreground">Light or dark mode</p>
          </div>
          <ThemeToggle />
        </div>

        <Button className="w-full" size="lg" onClick={ctx.handleSave} disabled={ctx.saving}>
          {ctx.saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save
        </Button>
      </div>
    </ProfileSubpageLayout>
  );
}
