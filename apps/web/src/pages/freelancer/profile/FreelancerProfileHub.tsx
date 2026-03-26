import { useNavigate, useOutletContext } from "react-router-dom";
import { useReportIssue } from "@/context/ReportIssueContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfileMenuRow } from "@/components/profile/ProfileMenuRow";
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
} from "lucide-react";

export default function FreelancerProfileHub() {
  const navigate = useNavigate();
  const { openReportModal } = useReportIssue();
  const ctx = useOutletContext<FreelancerProfileFormContext>();
  const { profile, fullName, photoUrl } = ctx;

  return (
    <div className="min-h-screen gradient-mesh p-4 pb-64 md:pb-32">
      <div className="max-w-lg mx-auto pt-6 md:pt-8">
        <div className="flex items-start justify-end gap-1 mb-10">
          <div className="flex items-center gap-1">
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
            <Button type="button" variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={openReportModal}>
              <AlertCircle className="w-4 h-4" />
              Report
            </Button>
          </div>
        </div>

        <div className="flex flex-col items-center text-center mb-10">
          <Avatar className="h-20 w-20 border border-border/60 mb-4">
            <AvatarImage src={photoUrl ?? undefined} alt="" />
            <AvatarFallback className="text-lg font-medium bg-muted">
              {fullName
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-2xl font-semibold tracking-tight">{fullName || "Your profile"}</h1>
          <p className="text-sm text-muted-foreground mt-1">{profile?.city || "Complete your details"}</p>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/40 divide-y divide-border/50 overflow-hidden">
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
      </div>
    </div>
  );
}
