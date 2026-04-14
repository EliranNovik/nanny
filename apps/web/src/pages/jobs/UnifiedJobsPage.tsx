import { useEffect, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { JobsMobileTabStepper } from "@/components/jobs/JobsMobileTabStepper";
import { JobsTabBar } from "@/components/jobs/JobsTabBar";
import { JobsRolePicker } from "@/components/jobs/JobsRolePicker";
import { JobsPerspectiveSwitch } from "@/components/jobs/JobsPerspectiveSwitch";
import {
  type JobsPerspective,
  defaultTabForPerspective,
  inferPerspectiveFromTab,
  isTabValidForPerspective,
  writeStoredPerspective,
} from "@/components/jobs/jobsPerspective";
import JobsTabContent from "./JobsTabContent";
import RequestsTabContent from "./RequestsTabContent";

export default function UnifiedJobsPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile, loading } = useAuth();

  const tabFromUrl = searchParams.get("tab");
  const modeFromUrl = searchParams.get("mode") as JobsPerspective | null;

  const receiveRequestsOn = profile?.is_available_for_jobs === true;
  const clientOnly = profile?.role === "client" && !receiveRequestsOn;
  const showRolePicker =
    !!profile &&
    !clientOnly &&
    (profile.role === "freelancer" || (profile.role === "client" && receiveRequestsOn));

  /** Resolved acting mode: URL wins; else infer legacy tab; else client-only / non-picker default */
  const resolvedMode: JobsPerspective | null = useMemo(() => {
    if (clientOnly) return "client";
    if (modeFromUrl === "freelancer" || modeFromUrl === "client") return modeFromUrl;
    if (!showRolePicker) return "freelancer";
    return inferPerspectiveFromTab(tabFromUrl || "");
  }, [clientOnly, modeFromUrl, showRolePicker, tabFromUrl]);

  const effectiveTab = useMemo(() => {
    if (!resolvedMode) return null;
    if (tabFromUrl && isTabValidForPerspective(resolvedMode, tabFromUrl)) return tabFromUrl;
    return defaultTabForPerspective(resolvedMode);
  }, [resolvedMode, tabFromUrl]);

  useEffect(() => {
    const stateTab = (location.state as { tab?: string } | null)?.tab;
    if (stateTab && !tabFromUrl) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", stateTab);
        return next;
      }, { replace: true });
    }
  }, [location.state, tabFromUrl, setSearchParams]);

  /** Client-only accounts: always persist client mode in the URL */
  useEffect(() => {
    if (!profile || !clientOnly) return;
    const t =
      tabFromUrl && isTabValidForPerspective("client", tabFromUrl)
        ? tabFromUrl
        : defaultTabForPerspective("client");
    if (modeFromUrl !== "client" || tabFromUrl !== t) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("mode", "client");
        next.set("tab", t);
        return next;
      }, { replace: true });
    }
  }, [profile, clientOnly, modeFromUrl, tabFromUrl, setSearchParams]);

  /** Dual-role legacy links: add ?mode= when only ?tab= was present */
  useEffect(() => {
    if (!profile || clientOnly) return;
    if (modeFromUrl === "freelancer" || modeFromUrl === "client") return;
    if (!resolvedMode || !effectiveTab) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("mode", resolvedMode);
      next.set("tab", effectiveTab);
      return next;
    }, { replace: true });
    writeStoredPerspective(resolvedMode);
  }, [profile, clientOnly, modeFromUrl, resolvedMode, effectiveTab, setSearchParams]);

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center gradient-mesh pb-6 md:pb-8">
        <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
      </div>
    );
  }

  const needsPicker = showRolePicker && !resolvedMode;

  if (needsPicker) {
    return (
      <div className="min-h-screen gradient-mesh pb-6 md:pb-8">
        <div className="app-desktop-shell flex min-h-[calc(100dvh-6rem)] flex-col justify-center pt-[calc(4.75rem+env(safe-area-inset-top,0px))] md:min-h-[70vh] md:pt-[calc(5.5rem+env(safe-area-inset-top,0px))]">
          <JobsRolePicker
            onSelect={(mode) => {
              writeStoredPerspective(mode);
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set("mode", mode);
                next.set("tab", defaultTabForPerspective(mode));
                return next;
              }, { replace: true });
            }}
          />
        </div>
      </div>
    );
  }

  if (!resolvedMode || !effectiveTab) {
    return (
      <div className="flex min-h-screen items-center justify-center gradient-mesh pb-6 md:pb-8">
        <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
      </div>
    );
  }

  const isJobsOrPast = effectiveTab === "jobs" || effectiveTab === "past";

  return (
    <div className="min-h-screen gradient-mesh pb-6 md:pb-8">
      <JobsMobileTabStepper />
      {/** Mobile: strip only — PageLayoutWithHeader already clears the nav (`app-content-below-fixed-header`). */}
      {/** Desktop: fixed directly under the app header (same offset as mobile strip). */}
      <div className="pointer-events-none hidden md:fixed md:inset-x-0 md:top-[calc(env(safe-area-inset-top,0px)+3.5rem)] md:z-[60] md:flex md:justify-center md:py-2">
        <div className="pointer-events-auto w-full">
          <JobsTabBar menuAlign="center" hideMobile />
        </div>
      </div>

      <div className="app-desktop-shell pt-[calc(5rem)] md:pt-[calc(env(safe-area-inset-top,0px)+3.5rem+7.25rem)]">
        {showRolePicker && (
          <JobsPerspectiveSwitch current={resolvedMode} className="mb-4 flex" />
        )}
        <div className="animate-in fade-in slide-in-from-bottom-2 min-w-0 duration-500 w-full">
          {isJobsOrPast ? (
            <JobsTabContent
              activeTab={effectiveTab as "jobs" | "past"}
              perspective={resolvedMode}
            />
          ) : (
            <RequestsTabContent
              activeTab={
                effectiveTab as "my_requests" | "requests" | "pending"
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
