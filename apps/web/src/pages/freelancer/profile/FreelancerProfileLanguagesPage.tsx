import { useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileSubpageLayout } from "@/components/profile/ProfileSubpageLayout";
import { FREELANCER_LANGUAGES, type FreelancerProfileFormContext } from "@/hooks/useFreelancerProfileForm";
import { Save, Loader2, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export default function FreelancerProfileLanguagesPage() {
  const ctx = useOutletContext<FreelancerProfileFormContext>();

  return (
    <ProfileSubpageLayout title="Languages" description="Languages you speak with families">
      <div className="space-y-6">
        <Card className="border border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Select languages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {FREELANCER_LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => ctx.toggleLanguage(lang)}
                  className={cn(
                    "px-4 py-2 rounded-full border-2 text-sm font-medium transition-all",
                    ctx.data.languages.includes(lang)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  {lang}
                </button>
              ))}
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
