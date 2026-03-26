import { useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import JobsTabContent from "./JobsTabContent";
import RequestsTabContent from "./RequestsTabContent";

export default function UnifiedJobsPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const activeTab = tabFromUrl || "requests";

  useEffect(() => {
    const stateTab = (location.state as { tab?: string } | null)?.tab;
    if (stateTab && !tabFromUrl) {
      setSearchParams({ tab: stateTab }, { replace: true });
    }
  }, [location.state, tabFromUrl, setSearchParams]);

  return (
    <div className="min-h-screen gradient-mesh px-4 pb-32 md:pb-24">
      {/* Extra top padding so section titles sit below fixed tab bar (mobile) / header (desktop) */}
      <div className="max-w-4xl mx-auto pt-[calc(4.75rem+env(safe-area-inset-top,0px))] md:pt-[calc(5.5rem+env(safe-area-inset-top,0px))]">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          {activeTab === "jobs" || activeTab === "past" ? (
            <JobsTabContent activeTab={activeTab as "jobs" | "past"} />
          ) : (
            <RequestsTabContent activeTab={activeTab as "my_requests" | "requests" | "pending"} />
          )}
        </div>
      </div>
    </div>
  );
}
