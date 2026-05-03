import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { useReportIssue } from "@/context/ReportIssueContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfileMenuRow } from "@/components/profile/ProfileMenuRow";
import { StarRating } from "@/components/StarRating";
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
  BellRing,
  MapPin,
  Image as ImageIcon,
  ExternalLink,
  Activity,
} from "lucide-react";

export default function FreelancerProfileHub() {
  const navigate = useNavigate();
  const { openReportModal } = useReportIssue();
  const ctx = useOutletContext<FreelancerProfileFormContext>();
  const { profile, fullName, photoUrl, user } = ctx;

  return (
    <div className="min-h-screen bg-background pb-6 md:pb-8">
      <div className="app-desktop-shell pt-6 md:pt-8">
        <div className="app-desktop-centered-wide">
          <div className="mb-6 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={() => navigate("/jobs")}
            >
              <BellRing className="w-4 h-4" />
              Alerts
            </Button>
          </div>

          <div className="flex flex-col items-center text-center mb-12">
            <Avatar className="h-28 w-28 md:h-32 md:w-32 border-2 border-border/70 mb-5 shadow-md">
              <AvatarImage src={photoUrl ?? undefined} alt="" />
              <AvatarFallback className="text-2xl font-semibold bg-muted">
                {fullName
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
              {fullName || "Your profile"}
            </h1>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <StarRating
                rating={profile?.average_rating || 0}
                size="lg"
                showCount={false}
                className="gap-2"
                numberClassName="text-base font-bold text-foreground/80"
              />
              <span className="text-sm md:text-base text-muted-foreground">
                {profile?.total_ratings
                  ? `${profile.total_ratings} reviews`
                  : "No reviews yet"}
              </span>
            </div>
            <p className="mt-2 flex items-center justify-center gap-2 text-base md:text-lg text-muted-foreground">
              <MapPin
                className="h-5 w-5 shrink-0 text-muted-foreground/80"
                aria-hidden
              />
              {profile?.city || "Complete your details"}
            </p>
            <Button className="mt-6 rounded-full px-8 font-bold" asChild>
              <Link to="/freelancer/profile/personal">Edit profile</Link>
            </Button>
            {user?.id && (
              <Link
                to={`/profile/${user.id}`}
                className="mt-4 inline-flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
              >
                <ExternalLink
                  className="h-4 w-4 shrink-0 opacity-80"
                  aria-hidden
                />
                View public profile
              </Link>
            )}
          </div>

          <div className="rounded-[24px] border border-slate-200/80 dark:border-white/5 bg-white dark:bg-zinc-900 divide-y divide-slate-100 dark:divide-white/5 overflow-hidden shadow-sm">
            <ProfileMenuRow
              to="/recent-activity"
              icon={Activity}
              label="Recent activity"
              description="Reviews, comments on your posts, and hire interest"
            />
            <ProfileMenuRow
              to="/freelancer/profile/saved"
              icon={Heart}
              label="Saved"
              description="Profiles and posts you liked"
            />
            <ProfileMenuRow
              to="/freelancer/profile/gallery"
              icon={ImageIcon}
              label="Public profile gallery"
              description="Photos and videos for your public profile"
            />
            <ProfileMenuRow
              to="/freelancer/profile/personal"
              icon={User}
              label="Personal & contact"
              description="Photo, name, city, phone, WhatsApp & Telegram"
            />
            <ProfileMenuRow
              to="/freelancer/profile/availability"
              icon={Bell}
              label="Availability"
              description="Whether you receive job requests now"
            />
            <ProfileMenuRow
              to="/freelancer/profile/about"
              icon={FileText}
              label="About you"
              description="Short bio for families"
            />
            <ProfileMenuRow
              to="/freelancer/profile/services"
              icon={Heart}
              label="Services & area"
              description="Categories and where you work"
            />
            <ProfileMenuRow
              to="/freelancer/profile/languages"
              icon={Globe}
              label="Languages"
              description="Languages you speak with families"
            />
            <ProfileMenuRow
              to="/freelancer/profile/experience"
              icon={Shield}
              label="Experience & skills"
              description="Certifications, ages, capacity"
            />
            <ProfileMenuRow
              to="/freelancer/profile/rates"
              icon={DollarSign}
              label="Hourly rates"
              description="Single rate or a range"
            />
            <ProfileMenuRow
              to="/freelancer/profile/appearance"
              icon={Palette}
              label="Appearance"
              description="Light and dark theme"
            />
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
