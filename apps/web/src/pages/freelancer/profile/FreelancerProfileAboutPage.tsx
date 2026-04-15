import { useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileSubpageLayout } from "@/components/profile/ProfileSubpageLayout";
import type { FreelancerProfileFormContext } from "@/hooks/useFreelancerProfileForm";
import { Save, Loader2 } from "lucide-react";

const textareaClass =
  "mt-1.5 flex min-h-[120px] w-full border-2 bg-primary/5 border-primary/20 hover:border-primary/30 focus:bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all rounded-xl px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none dark:bg-white/5 dark:border-white/10 dark:hover:border-white/20 dark:focus:bg-white/10";

export default function FreelancerProfileAboutPage() {
  const ctx = useOutletContext<FreelancerProfileFormContext>();

  return (
    <ProfileSubpageLayout
      title="About you"
      description="Tell families what makes you a great match"
    >
      <div className="space-y-6">
        <Card className="border border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Bio</CardTitle>
            <CardDescription>
              Share your experience and what you love about childcare
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="bio" className="sr-only">
              Bio
            </Label>
            <textarea
              id="bio"
              className={textareaClass}
              placeholder="Share your experience, what you love about childcare, etc."
              value={ctx.data.bio}
              onChange={(e) => ctx.updateField("bio", e.target.value)}
            />
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
              Save changes
            </>
          )}
        </Button>
      </div>
    </ProfileSubpageLayout>
  );
}
