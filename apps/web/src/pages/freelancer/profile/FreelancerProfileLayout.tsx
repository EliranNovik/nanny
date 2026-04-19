import { Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useFreelancerProfileForm } from "@/hooks/useFreelancerProfileForm";

export default function FreelancerProfileLayout() {
  const form = useFreelancerProfileForm();

  if (form.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return <Outlet context={form} />;
}
