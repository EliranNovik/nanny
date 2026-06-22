import { useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useReportIssue } from "@/context/ReportIssueContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ProfileLanguageMenuRow } from "@/components/profile/ProfileLanguageMenuRow";
import { ProfileMenuRow, profileMenuListClassName } from "@/components/profile/ProfileMenuRow";
import { ProfileHubIdentityCard } from "@/components/profile/ProfileHubIdentityCard";
import { ProfileHubLogoutButton } from "@/components/profile/ProfileHubLogoutButton";
import { ProfileHubHomeButton } from "@/components/profile/ProfileHubHomeButton";
import { RoleOnboardingGuide } from "@/components/onboarding/RoleOnboardingGuide";
import type { FreelancerProfileFormContext } from "@/hooks/useFreelancerProfileForm";
import {
  AlertCircle,
  User,
  Bell,
  FileText,
  Heart,
  Globe,
  Shield,
  DollarSign,
  Palette,
  Image as ImageIcon,
  Activity,
  CalendarDays,
  LayoutDashboard,
} from "lucide-react";

export default function FreelancerProfileHub() {
  const { t } = useTranslation();
  const { openReportModal } = useReportIssue();
  const ctx = useOutletContext<FreelancerProfileFormContext>();
  const { profile, fullName, photoUrl } = ctx;

  return (
    <div className="min-h-screen bg-background pb-6 md:pb-8">
      <div className="app-desktop-shell pt-6 md:pt-8">
        <div className="app-desktop-centered-wide">
          <ProfileHubIdentityCard
            fullName={fullName ?? ""}
            photoUrl={photoUrl}
            city={profile?.city}
            averageRating={profile?.average_rating}
            totalRatings={profile?.total_ratings}
          />

          <div className="flex flex-col gap-4">
            <div className={profileMenuListClassName}>
              <ProfileMenuRow to="/freelancer/profile/personal" icon={User} label={t("profile.personalContact")} />
              <ProfileMenuRow to="/freelancer/explore" icon={LayoutDashboard} label={t("profile.myActivity")} />
              <ProfileMenuRow to="/freelancer/profile/events" icon={CalendarDays} label={t("profile.myEvents")} />
              <ProfileMenuRow to="/recent-activity" icon={Activity} label={t("profile.recentActivity")} />
              <ProfileMenuRow to="/freelancer/profile/saved" icon={Heart} label={t("common.saved")} />
              <ProfileMenuRow to="/freelancer/profile/gallery" icon={ImageIcon} label={t("profile.publicGallery")} />
              <ProfileMenuRow
                to="/freelancer/profile/availability"
                icon={Bell}
                label={t("profile.availability")}
                trailing={
                  <Switch
                    checked={ctx.data.available_now}
                    disabled={ctx.availabilitySaving}
                    onCheckedChange={ctx.setAvailableNowAndSave}
                    aria-label={
                      ctx.data.available_now
                        ? "Available for jobs"
                        : "Not available for jobs"
                    }
                  />
                }
              />
              <ProfileMenuRow to="/freelancer/profile/about" icon={FileText} label={t("profile.aboutYou")} />
            </div>
            <div className={profileMenuListClassName}>
              <ProfileMenuRow to="/freelancer/profile/services" icon={Heart} label={t("profile.servicesArea")} />
              <ProfileMenuRow to="/freelancer/profile/languages" icon={Globe} label={t("profile.languages")} />
              <ProfileMenuRow to="/freelancer/profile/experience" icon={Shield} label={t("profile.experienceSkills")} />
              <ProfileMenuRow to="/freelancer/profile/rates" icon={DollarSign} label={t("profile.hourlyRates")} />
              <ProfileLanguageMenuRow to="/freelancer/profile/language" />
              <ProfileMenuRow to="/freelancer/profile/appearance" icon={Palette} label={t("profile.appearance")} />
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center gap-3 pb-4">
            <RoleOnboardingGuide
              role={profile?.role ?? "freelancer"}
              triggerLabel="Help"
              triggerClassName="gap-2 text-muted-foreground"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={openReportModal}
            >
              <AlertCircle className="w-4 h-4" />
              {t("common.reportIssue")}
            </Button>
            <ProfileHubHomeButton />
            <ProfileHubLogoutButton />
          </div>
        </div>
      </div>
    </div>
  );
}
