import { useOutletContext } from "react-router-dom";
import { useReportIssue } from "@/context/ReportIssueContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ProfileMenuRow, profileMenuListClassName } from "@/components/profile/ProfileMenuRow";
import { ProfileHubIdentityCard } from "@/components/profile/ProfileHubIdentityCard";
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
              <ProfileMenuRow to="/freelancer/profile/personal" icon={User} label="Personal & contact" />
              <ProfileMenuRow to="/freelancer/explore" icon={LayoutDashboard} label="My activity" />
              <ProfileMenuRow to="/freelancer/profile/events" icon={CalendarDays} label="My events" />
              <ProfileMenuRow to="/recent-activity" icon={Activity} label="Recent activity" />
              <ProfileMenuRow to="/freelancer/profile/saved" icon={Heart} label="Saved" />
              <ProfileMenuRow to="/freelancer/profile/gallery" icon={ImageIcon} label="Public profile gallery" />
              <ProfileMenuRow
                to="/freelancer/profile/availability"
                icon={Bell}
                label="Availability"
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
              <ProfileMenuRow to="/freelancer/profile/about" icon={FileText} label="About you" />
            </div>
            <div className={profileMenuListClassName}>
              <ProfileMenuRow to="/freelancer/profile/services" icon={Heart} label="Services & area" />
              <ProfileMenuRow to="/freelancer/profile/languages" icon={Globe} label="Languages" />
              <ProfileMenuRow to="/freelancer/profile/experience" icon={Shield} label="Experience & skills" />
              <ProfileMenuRow to="/freelancer/profile/rates" icon={DollarSign} label="Hourly rates" />
              <ProfileMenuRow to="/freelancer/profile/appearance" icon={Palette} label="Appearance" />
            </div>
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
