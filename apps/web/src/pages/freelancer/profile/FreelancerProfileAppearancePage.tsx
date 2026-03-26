import { useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileSubpageLayout } from "@/components/profile/ProfileSubpageLayout";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { FreelancerProfileFormContext } from "@/hooks/useFreelancerProfileForm";
import { Save, Loader2 } from "lucide-react";

export default function FreelancerProfileAppearancePage() {
  const ctx = useOutletContext<FreelancerProfileFormContext>();

  return (
    <ProfileSubpageLayout title="Appearance" description="Customize how the app looks">
      <div className="space-y-6">
        <Card className="border border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Theme</CardTitle>
            <CardDescription>Switch between light and dark mode</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">Applies across the app</p>
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>

        <Button onClick={ctx.handleSave} disabled={ctx.saving} className="w-full" size="lg">
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
