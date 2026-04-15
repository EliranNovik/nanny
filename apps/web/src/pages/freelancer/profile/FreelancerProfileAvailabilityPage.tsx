import { useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { ProfileSubpageLayout } from "@/components/profile/ProfileSubpageLayout";
import type { FreelancerProfileFormContext } from "@/hooks/useFreelancerProfileForm";
import { Save, Loader2, Bell, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function FreelancerProfileAvailabilityPage() {
  const ctx = useOutletContext<FreelancerProfileFormContext>();

  return (
    <ProfileSubpageLayout
      title="Availability"
      description="Control whether you receive job requests"
    >
      <div className="space-y-6">
        <Card className="border border-border/50 shadow-sm overflow-hidden">
          <div
            className={cn(
              "p-6 transition-colors",
              ctx.data.available_now ? "bg-emerald-500/10" : "bg-muted/40",
            )}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                    ctx.data.available_now
                      ? "bg-emerald-500"
                      : "bg-muted-foreground/20",
                  )}
                >
                  {ctx.data.available_now ? (
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  ) : (
                    <Bell className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-lg">
                    {ctx.data.available_now
                      ? "You're available"
                      : "Not available"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {ctx.data.available_now
                      ? "You'll receive job notifications"
                      : "Turn on to receive job requests"}
                  </p>
                </div>
              </div>
              <Switch
                checked={ctx.data.available_now}
                onCheckedChange={(checked) =>
                  ctx.updateField("available_now", checked)
                }
              />
            </div>
          </div>
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
              Save changes
            </>
          )}
        </Button>
      </div>
    </ProfileSubpageLayout>
  );
}
