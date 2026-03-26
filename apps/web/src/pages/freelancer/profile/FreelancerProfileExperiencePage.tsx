import { useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileSubpageLayout } from "@/components/profile/ProfileSubpageLayout";
import type { FreelancerProfileFormContext } from "@/hooks/useFreelancerProfileForm";
import { Save, Loader2, Shield, Baby, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export default function FreelancerProfileExperiencePage() {
  const ctx = useOutletContext<FreelancerProfileFormContext>();

  return (
    <ProfileSubpageLayout
      title="Experience & skills"
      description="Certifications, age groups, and how many children"
    >
      <div className="space-y-6">
        <Card className="border border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Skills</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl border border-border/60">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="font-medium">First aid certified</p>
                  <p className="text-sm text-muted-foreground">CPR & first aid</p>
                </div>
              </div>
              <Switch
                checked={ctx.data.has_first_aid}
                onCheckedChange={(checked) => ctx.updateField("has_first_aid", checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-border/60">
              <div className="flex items-center gap-3">
                <Baby className="w-5 h-5 text-pink-500 shrink-0" />
                <div>
                  <p className="font-medium">Newborn experience</p>
                  <p className="text-sm text-muted-foreground">0–6 months</p>
                </div>
              </div>
              <Switch
                checked={ctx.data.newborn_experience}
                onCheckedChange={(checked) => ctx.updateField("newborn_experience", checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-border/60">
              <div className="flex items-center gap-3">
                <Heart className="w-5 h-5 text-purple-500 shrink-0" />
                <div>
                  <p className="font-medium">Special needs experience</p>
                  <p className="text-sm text-muted-foreground">Additional support</p>
                </div>
              </div>
              <Switch
                checked={ctx.data.special_needs_experience}
                onCheckedChange={(checked) => ctx.updateField("special_needs_experience", checked)}
              />
            </div>

            <div className="pt-2">
              <Label>Maximum children</Label>
              <div className="flex gap-2 mt-2">
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => ctx.updateField("max_children", num)}
                    className={cn(
                      "w-12 h-12 rounded-lg border-2 font-semibold transition-all",
                      ctx.data.max_children === num
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    {num === 4 ? "4+" : num}
                  </button>
                ))}
              </div>
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
              Save changes
            </>
          )}
        </Button>
      </div>
    </ProfileSubpageLayout>
  );
}
