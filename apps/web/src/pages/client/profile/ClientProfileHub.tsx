import { useOutletContext } from "react-router-dom";
import { useReportIssue } from "@/context/ReportIssueContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfileMenuRow } from "@/components/profile/ProfileMenuRow";
import type { ClientProfileFormContext } from "@/hooks/useClientProfileForm";
import { User, Briefcase, Palette, AlertCircle } from "lucide-react";

export default function ClientProfileHub() {
  const { openReportModal } = useReportIssue();
  const ctx = useOutletContext<ClientProfileFormContext>();
  const { profile, fullName, photoUrl } = ctx;

  return (
    <div className="min-h-screen gradient-mesh p-4 pb-64 md:pb-32">
      <div className="max-w-lg mx-auto pt-6 md:pt-8">
        <div className="flex justify-end mb-10">
          <Button type="button" variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={openReportModal}>
            <AlertCircle className="w-4 h-4" />
            Report
          </Button>
        </div>

        <div className="flex flex-col items-center text-center mb-10">
          <Avatar className="h-20 w-20 border border-border/60 mb-4">
            <AvatarImage src={photoUrl ?? undefined} alt="" />
            <AvatarFallback className="text-lg font-medium bg-muted">
              {fullName?.slice(0, 2).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-2xl font-semibold tracking-tight">{fullName || "Your profile"}</h1>
          <p className="text-sm text-muted-foreground mt-1">{profile?.city || "Add your details"}</p>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/40 divide-y divide-border/50 overflow-hidden">
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
  );
}
