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
      <div className="flex h-[100dvh] min-h-0 overflow-hidden bg-[#F2F2F7] dark:bg-black">
        <aside className="h-full w-[380px] shrink-0 overflow-y-auto border-r border-black/10 bg-[#F2F2F7] dark:border-white/10 dark:bg-black">
          <ClientProfileHub form={form} variant="sidebar" />
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto bg-[#F2F2F7] dark:bg-black">
          {atRoot ? (
            <Navigate to="/client/profile/personal" replace />
          ) : (
            <Outlet context={form} />
          )}
        </main>
      </div>
    );
  }

  return <Outlet context={form} />;
}
