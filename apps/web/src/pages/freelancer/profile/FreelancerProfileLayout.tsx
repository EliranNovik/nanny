import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useFreelancerProfileForm } from "@/hooks/useFreelancerProfileForm";
import { useScrollToTopOnPathnameChange } from "@/hooks/useScrollToTopOnPathnameChange";
import { useTabletViewport } from "@/hooks/useIsTabletViewport";
import FreelancerProfileHub from "./FreelancerProfileHub";

export default function FreelancerProfileLayout() {
  const form = useFreelancerProfileForm();
  const { pathname } = useLocation();
  const { isTablet } = useTabletViewport();
  useScrollToTopOnPathnameChange();

  if (form.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isTablet) {
    const atRoot = pathname.replace(/\/+$/, "") === "/freelancer/profile";
    return (
      <div className="flex h-[100dvh] min-h-0 overflow-hidden bg-[#F2F2F7] dark:bg-black">
        <aside className="h-full w-[380px] shrink-0 overflow-y-auto border-r border-black/10 bg-[#F2F2F7] dark:border-white/10 dark:bg-black">
          <FreelancerProfileHub form={form} variant="sidebar" />
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto bg-[#F2F2F7] dark:bg-black">
          {atRoot ? (
            <Navigate to="/freelancer/profile/personal" replace />
          ) : (
            <Outlet context={form} />
          )}
        </main>
      </div>
    );
  }

  return <Outlet context={form} />;
}
