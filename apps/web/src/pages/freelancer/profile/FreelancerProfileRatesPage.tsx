import { useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileSubpageLayout } from "@/components/profile/ProfileSubpageLayout";
import type { FreelancerProfileFormContext } from "@/hooks/useFreelancerProfileForm";
import { Save, Loader2, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

export default function FreelancerProfileRatesPage() {
  const ctx = useOutletContext<FreelancerProfileFormContext>();

  return (
    <ProfileSubpageLayout title="Hourly rates" description="Set a single rate or a min–max range">
      <div className="space-y-6">
        <Card className="border border-border/50 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                Hourly rate
              </CardTitle>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "text-sm font-medium transition-colors",
                    ctx.rateMode === "single" ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  Single
                </span>
                <Switch
                  checked={ctx.rateMode === "range"}
                  onCheckedChange={(checked) => {
                    const newMode = checked ? "range" : "single";
                    ctx.setRateMode(newMode);
                    if (newMode === "single" && ctx.data.hourly_rate_min !== null) {
                      ctx.updateField("hourly_rate_max", ctx.data.hourly_rate_min);
                    } else if (newMode === "single" && ctx.data.hourly_rate_max !== null) {
                      ctx.updateField("hourly_rate_min", ctx.data.hourly_rate_max);
                    }
                  }}
                />
                <span
                  className={cn(
                    "text-sm font-medium transition-colors",
                    ctx.rateMode === "range" ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  Range
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {ctx.rateMode === "single" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Hourly rate</span>
                  <span className="text-2xl font-bold text-primary">
                    ₪{ctx.data.hourly_rate_min || ctx.data.hourly_rate_max || 50}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="range"
                    min={20}
                    max={200}
                    step={5}
                    value={ctx.data.hourly_rate_min || ctx.data.hourly_rate_max || 50}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      ctx.updateField("hourly_rate_min", value);
                      ctx.updateField("hourly_rate_max", value);
                    }}
                    className="w-full h-3 bg-muted rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>₪20</span>
                    <span>₪200</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Minimum</span>
                    <span className="text-2xl font-bold text-primary">₪{ctx.data.hourly_rate_min || 20}</span>
                  </div>
                  <div className="relative">
                    <input
                      type="range"
                      min={20}
                      max={ctx.data.hourly_rate_max || 200}
                      step={5}
                      value={ctx.data.hourly_rate_min || 20}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (!ctx.data.hourly_rate_max || value <= ctx.data.hourly_rate_max) {
                          ctx.updateField("hourly_rate_min", value);
                        }
                      }}
                      className="w-full h-3 bg-muted rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>₪20</span>
                      <span>₪{ctx.data.hourly_rate_max || 200}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Maximum</span>
                    <span className="text-2xl font-bold text-primary">₪{ctx.data.hourly_rate_max || 200}</span>
                  </div>
                  <div className="relative">
                    <input
                      type="range"
                      min={ctx.data.hourly_rate_min || 20}
                      max={200}
                      step={5}
                      value={ctx.data.hourly_rate_max || 200}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (!ctx.data.hourly_rate_min || value >= ctx.data.hourly_rate_min) {
                          ctx.updateField("hourly_rate_max", value);
                        }
                      }}
                      className="w-full h-3 bg-muted rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>₪{ctx.data.hourly_rate_min || 20}</span>
                      <span>₪200</span>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground text-center pt-1">
                  Range:{" "}
                  <span className="font-semibold text-foreground">₪{ctx.data.hourly_rate_min || 20}</span> –{" "}
                  <span className="font-semibold text-foreground">₪{ctx.data.hourly_rate_max || 200}</span> / hour
                </p>
              </div>
            )}
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
              Save changes
            </>
          )}
        </Button>
      </div>
    </ProfileSubpageLayout>
  );
}
