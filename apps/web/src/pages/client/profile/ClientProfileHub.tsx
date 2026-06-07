import { useOutletContext } from "react-router-dom";
import { useReportIssue } from "@/context/ReportIssueContext";
import { Button } from "@/components/ui/button";
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
            <ProfileMenuRow to="/client/profile/personal" icon={User} label="Personal & contact" />
            <ProfileMenuRow to="/client/explore" icon={LayoutDashboard} label="My activity" />
            <ProfileMenuRow to="/client/profile/events" icon={CalendarDays} label="My events" />
            <ProfileMenuRow to="/recent-activity" icon={Activity} label="Recent activity" />
            <ProfileMenuRow to="/client/profile/saved" icon={Heart} label="Saved" />
            <ProfileMenuRow to="/client/profile/gallery" icon={ImageIcon} label="Public profile gallery" />
            <ProfileMenuRow to="/client/profile/services" icon={Briefcase} label="Services & area" />
            <ProfileMenuRow to="/client/profile/appearance" icon={Palette} label="Appearance" />
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
              Report an issue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
