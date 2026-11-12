import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useClientProfileForm } from "@/hooks/useClientProfileForm";
import { useScrollToTopOnPathnameChange } from "@/hooks/useScrollToTopOnPathnameChange";
import { useTabletViewport } from "@/hooks/useIsTabletViewport";
import ClientProfileHub from "./ClientProfileHub";

export default function ClientProfileLayout() {
  const form = useClientProfileForm();
  const { pathname } = useLocation();
  const { isTablet } = useTabletViewport();
  useScrollToTopOnPathnameChange();

  if (isTablet) {
    const atRoot = pathname.replace(/\/+$/, "") === "/client/profile";
    return (
      <div data-profile-page="" className="flex h-[100dvh] min-h-0 overflow-hidden bg-white dark:bg-black md:h-full md:max-h-full">
        <aside className="scrollbar-hide h-full w-[380px] shrink-0 overflow-y-auto border-r border-black/10 bg-white dark:border-white/10 dark:bg-black">
          <ClientProfileHub form={form} variant="sidebar" />
        </aside>
        <main className="scrollbar-hide min-w-0 flex-1 overflow-y-auto bg-white dark:bg-black">
          {atRoot ? (
            <Navigate to="/client/profile/personal" replace />
          ) : (
            <Outlet context={form} />
          )}
        </main>
      </div>
    );
  }

  return (
    <div data-profile-page="" className="min-h-0">
      <Outlet context={form} />
    </div>
  );
}
