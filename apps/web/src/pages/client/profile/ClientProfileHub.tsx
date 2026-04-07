import { Link, useOutletContext } from "react-router-dom";
import { useReportIssue } from "@/context/ReportIssueContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfileMenuRow } from "@/components/profile/ProfileMenuRow";
import { StarRating } from "@/components/StarRating";
import type { ClientProfileFormContext } from "@/hooks/useClientProfileForm";
import { User, Briefcase, Palette, AlertCircle, MapPin, Image as ImageIcon, ExternalLink } from "lucide-react";

export default function ClientProfileHub() {
  const { openReportModal } = useReportIssue();
  const ctx = useOutletContext<ClientProfileFormContext>();
  const { profile, fullName, photoUrl, user } = ctx;

  return (
    <div className="min-h-screen gradient-mesh pb-6 md:pb-8">
      <div className="app-desktop-shell pt-6 md:pt-8">
        <div className="app-desktop-centered-wide">
        <div className="flex justify-end mb-10">
          <Button type="button" variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={openReportModal}>
            <AlertCircle className="w-4 h-4" />
            Report
          </Button>
        </div>

        <div className="flex flex-col items-center text-center mb-12">
          <Avatar className="h-28 w-28 md:h-32 md:w-32 border-2 border-border/70 mb-5 shadow-md">
            <AvatarImage src={photoUrl ?? undefined} alt="" />
            <AvatarFallback className="text-2xl font-semibold bg-muted">
              {fullName?.slice(0, 2).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{fullName || "Your profile"}</h1>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <StarRating
              rating={profile?.average_rating || 0}
              size="lg"
              showCount={false}
              className="gap-2"
              numberClassName="text-base font-bold text-foreground/80"
            />
            <span className="text-sm md:text-base text-muted-foreground">
              {profile?.total_ratings ? `${profile.total_ratings} reviews` : "No reviews yet"}
            </span>
          </div>
          <p className="mt-2 flex items-center justify-center gap-2 text-base md:text-lg text-muted-foreground">
            <MapPin className="h-5 w-5 shrink-0 text-muted-foreground/80" aria-hidden />
            {profile?.city || "Add your details"}
          </p>
          {user?.id && (
            <Button variant="outline" size="lg" className="mt-8 w-full max-w-md gap-2" asChild>
              <Link to={`/profile/${user.id}`}>
                <ExternalLink className="h-4 w-4" />
                View public profile
              </Link>
            </Button>
          )}
        </div>

        <div className="rounded-3xl border border-border/50 bg-card/60 divide-y divide-border/50 overflow-hidden shadow-sm">
          <ProfileMenuRow
            to="/client/profile/gallery"
            icon={ImageIcon}
            label="Public profile gallery"
            description="Photos and videos for your public profile"
          />
          <ProfileMenuRow
            to="/client/profile/personal"
            icon={User}
            label="Personal & contact"
            description="Photo, name, location, phone, WhatsApp & Telegram"
          />
          <ProfileMenuRow
            to="/client/profile/services"
            icon={Briefcase}
            label="Services & area"
            description="What you offer, availability, service radius"
          />
          <ProfileMenuRow
            to="/client/profile/appearance"
            icon={Palette}
            label="Appearance"
            description="Light and dark theme"
          />
        </div>
        </div>
      </div>
    </div>
  );
}
