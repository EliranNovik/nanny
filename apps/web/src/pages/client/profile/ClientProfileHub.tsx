import { useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useReportIssue } from "@/context/ReportIssueContext";
import { Button } from "@/components/ui/button";
import { ProfileLanguageMenuRow } from "@/components/profile/ProfileLanguageMenuRow";
import { ProfileMenuRow, profileMenuListClassName } from "@/components/profile/ProfileMenuRow";
import { ProfileHubIdentityCard } from "@/components/profile/ProfileHubIdentityCard";
import type { ClientProfileFormContext } from "@/hooks/useClientProfileForm";
import {
  User,
  Briefcase,
  Palette,
  AlertCircle,
  Image as ImageIcon,
  Heart,
  Activity,
  LayoutDashboard,
  CalendarDays,
} from "lucide-react";

export default function ClientProfileHub() {
  const { t } = useTranslation();
  const { openReportModal } = useReportIssue();
  const ctx = useOutletContext<ClientProfileFormContext>();
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
            cityPlaceholder="Add your details"
          />

          <div className={profileMenuListClassName}>
            <ProfileMenuRow to="/client/profile/personal" icon={User} label={t("profile.personalContact")} />
            <ProfileMenuRow to="/client/explore" icon={LayoutDashboard} label={t("profile.myActivity")} />
            <ProfileMenuRow to="/client/profile/events" icon={CalendarDays} label={t("profile.myEvents")} />
            <ProfileMenuRow to="/recent-activity" icon={Activity} label={t("profile.recentActivity")} />
            <ProfileMenuRow to="/client/profile/saved" icon={Heart} label={t("common.saved")} />
            <ProfileMenuRow to="/client/profile/gallery" icon={ImageIcon} label={t("profile.publicGallery")} />
            <ProfileMenuRow to="/client/profile/services" icon={Briefcase} label={t("profile.servicesArea")} />
            <ProfileLanguageMenuRow to="/client/profile/language" />
            <ProfileMenuRow to="/client/profile/appearance" icon={Palette} label={t("profile.appearance")} />
          </div>

          <div className="mt-10 flex justify-center pb-4">
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
          </div>
        </div>
      </div>
    </div>
  );
}
