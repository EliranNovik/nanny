import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { ExploreMyPostedRequests } from "@/components/discover/ExploreMyPostedRequests";
import { ExploreLiveHelpNow } from "@/components/discover/ExploreLiveHelpNow";
import { ExploreHistoryJobs } from "@/components/discover/ExploreHistoryJobs";
import { ExplorePendingResponses } from "@/components/discover/ExplorePendingResponses";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useFreelancerRequests } from "@/hooks/data/useFreelancerRequests";

type ExploreMode = "hire" | "work";

const HIRE_TABS = ["live_help", "my_requests", "history"] as const;
const WORK_TABS = ["live_help", "pending", "history"] as const;
type HireTabId = (typeof HIRE_TABS)[number];
type WorkTabId = (typeof WORK_TABS)[number];

function isHireTab(t: string | null): t is HireTabId {
  return t !== null && (HIRE_TABS as readonly string[]).includes(t);
}

function isWorkTab(t: string | null): t is WorkTabId {
  return t !== null && (WORK_TABS as readonly string[]).includes(t);
}

/** Resolve mode + tab from URL with legacy ?tab= aliases */
function parseExploreSearchParams(searchParams: URLSearchParams): {
  mode: ExploreMode;
  tab: HireTabId | WorkTabId;
} {
  const modeRaw = searchParams.get("mode");
  let mode: ExploreMode = modeRaw === "work" ? "work" : "hire";
  let raw = searchParams.get("tab");

  if (mode === "hire") {
    if (raw === "my_requests" || raw === "posted_requests") {
      return { mode, tab: "my_requests" };
    }
    if (raw === "live_help" || raw === "live") {
      return { mode, tab: "live_help" };
    }
    if (raw === "history" || raw === "past") {
      return { mode, tab: "history" };
    }
    // Default to Live help (Matches removed).
    return { mode, tab: "live_help" };
  }

  if (raw === "live_help" || raw === "live") {
    return { mode, tab: "live_help" };
  }
  if (raw === "pending") {
    return { mode, tab: "pending" };
  }
  if (raw === "history" || raw === "past") {
    return { mode, tab: "history" };
  }
  // Default to Live help (Matches removed).
  return { mode, tab: "live_help" };
}

const HIRE_TAB_ITEMS: { id: HireTabId; label: string }[] = [
  { id: "live_help", label: "Live help" },
  { id: "my_requests", label: "My requests" },
  { id: "history", label: "History" },
];

const WORK_TAB_ITEMS: { id: WorkTabId; label: string }[] = [
  { id: "live_help", label: "Live help" },
  { id: "pending", label: "Pending" },
  { id: "history", label: "History" },
];

/** Secondary tabs: simple text + bottom border underline (active). */
function ExploreSecondaryUnderlineTabs({
  mode,
  tab,
  onTabChange,
  counts,
}: {
  mode: ExploreMode;
  tab: HireTabId | WorkTabId;
  onTabChange: (t: HireTabId | WorkTabId) => void;
  counts: Partial<Record<HireTabId | WorkTabId, number>>;
}) {
  const items = mode === "hire" ? HIRE_TAB_ITEMS : WORK_TAB_ITEMS;
  const isHire = mode === "hire";
  return (
    <div
      className="border-b border-border/80"
      role="tablist"
      aria-label={
        mode === "hire" ? "I need help sections" : "Help others sections"
      }
    >
      <div className="-mb-px flex gap-0 overflow-x-auto pb-px sm:gap-1">
        {items.map(({ id, label }) => {
          const selected = tab === id;
          const c = counts[id];
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onTabChange(id)}
              className={cn(
                "shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-left text-sm font-semibold transition-colors sm:px-4 sm:text-[15px]",
                selected
                  ? isHire
                    ? "border-[#7B61FF] text-[#4c1d95] dark:border-[#A78BFA] dark:text-[#E9D5FF]"
                    : "border-emerald-600 text-emerald-950 dark:border-emerald-400 dark:text-emerald-100"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="inline-flex items-center gap-2">
                <span>{label}</span>
                {typeof c === "number" ? (
                  <span
                    className={cn(
                      "inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 tabular-nums text-[11px] font-black uppercase tracking-[0.14em]",
                      selected
                        ? isHire
                          ? "bg-[#7B61FF]/15 text-[#4c1d95] dark:bg-[#7B61FF]/25 dark:text-[#E9D5FF]"
                          : "bg-emerald-500/15 text-emerald-950 dark:bg-emerald-400/20 dark:text-emerald-100"
                        : "bg-muted text-muted-foreground",
                    )}
                    aria-label={`${c} items`}
                  >
                    {c > 99 ? "99+" : c}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Explore: fixed strip under app header (Discover primary toggle + underline sub-tabs), then scrollable content.
 */
export default function ExplorePage() {
  const location = useLocation();
  const isClientExplore = location.pathname.startsWith("/client/");
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { data: requestsData } = useFreelancerRequests(user?.id);
  const myRequestsCount = (requestsData?.myOpenRequests ?? []).length;
  const [tabCounts, setTabCounts] = useState<
    Partial<Record<HireTabId | WorkTabId, number>>
  >({});

  const { mode, tab } = useMemo(() => {
    const parsed = parseExploreSearchParams(searchParams);
    // If no explicit mode in URL, default based on the page role
    if (!searchParams.get("mode")) {
      parsed.mode = isClientExplore ? "hire" : "work";
      // If we changed mode, ensure tab is valid
      const ok =
        parsed.mode === "hire"
          ? isHireTab(parsed.tab)
          : isWorkTab(parsed.tab);
      if (!ok) parsed.tab = "live_help";
    }
    return parsed;
  }, [searchParams, isClientExplore]);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "others_hires" || t === "my_availability") {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          if (!n.get("mode")) n.set("mode", "work");
          n.set("tab", "live_help");
          return n;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    trackEvent("explore_open", {
      mode,
      tab,
      viewer: isClientExplore ? "client" : "freelancer",
    });
  }, [mode, tab, isClientExplore]);

  useEffect(() => {
    let cancelled = false;
    const uid = user?.id;
    if (!uid) {
      setTabCounts({});
      return;
    }

    void (async () => {
      // Live help counts: jobs in locked/active with assigned helper.
      const liveHelpRes = await supabase
        .from("job_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["locked", "active"])
        .not("selected_freelancer_id", "is", null)
        .eq(mode === "hire" ? "client_id" : "selected_freelancer_id", uid);

      // History counts: completed/cancelled jobs for this user in this mode.
      const historyRes = await supabase
        .from("job_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["completed", "cancelled"])
        .eq(mode === "hire" ? "client_id" : "selected_freelancer_id", uid);

      const liveHelpCount = liveHelpRes.count ?? 0;
      const historyCount = historyRes.count ?? 0;

      const pendingCount =
        mode === "work"
          ? (requestsData?.inboundNotifications ?? []).filter((n: any) =>
              Boolean(n?.isConfirmed),
            ).length
          : 0;

      const next: Partial<Record<HireTabId | WorkTabId, number>> = {
        live_help: liveHelpCount,
        history: historyCount,
      };

      if (mode === "hire") {
        next.my_requests = myRequestsCount;
      } else {
        next.pending = pendingCount;
      }

      if (!cancelled) setTabCounts(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, myRequestsCount, user?.id]);

  function setMode(next: ExploreMode) {
    trackEvent("explore_mode", { mode: next });
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set("mode", next);
        const cur = n.get("tab");
        const ok = next === "hire" ? isHireTab(cur) : isWorkTab(cur);
        if (!ok) n.set("tab", "live_help");
        return n;
      },
      { replace: true },
    );
  }

  function setTab(next: HireTabId | WorkTabId) {
    trackEvent("explore_tab", { mode, tab: next });
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set("tab", next);
        if (!n.get("mode")) n.set("mode", mode);
        return n;
      },
      { replace: true },
    );
  }

  return (
    <div
      className="relative min-h-screen bg-white pb-8 md:pb-10 dark:bg-zinc-950"
      style={{ "--app-explore-stack-gap": "0.03125rem" } as React.CSSProperties}
      data-explore-page=""
      data-explore-mode={mode}
    >
      {/* Header with Switcher Button */}
      <div className="app-desktop-shell max-md:px-2.5">
        <div className="flex w-full items-center justify-between px-2 pb-1.5 pt-2 md:pt-5">
          <h1 className="text-[17px] font-black tracking-tight text-slate-900 dark:text-white pl-2">
            {mode === "hire" ? "I need help" : "Help others"}
          </h1>
          
          <button
            type="button"
            onClick={() => setMode(mode === "hire" ? "work" : "hire")}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100/80 px-3.5 py-2 text-[13px] font-bold text-slate-700 backdrop-blur-md transition-colors hover:bg-slate-200 dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:bg-zinc-700 shadow-sm"
          >
            {mode === "hire" ? "Help others?" : "Get help?"}
            <ChevronRight className="-mr-0.5 h-4 w-4 opacity-70" aria-hidden />
          </button>
        </div>

        <div className="px-2">
          <ExploreSecondaryUnderlineTabs
            mode={mode}
            tab={tab}
            onTabChange={setTab}
            counts={tabCounts}
          />
        </div>
      </div>

      {/* Content */}
      <div
        className={cn(
          "app-desktop-shell max-md:px-2.5",
          "bg-white dark:bg-zinc-950",
        )}
      >
        <div className="px-1 pt-3 md:pt-5">
          {mode === "hire" ? (
            <>
              {tab === "live_help" ? (
                <ExploreLiveHelpNow mode="hire" />
              ) : tab === "my_requests" ? (
                <ExploreMyPostedRequests />
              ) : tab === "history" ? (
                <ExploreHistoryJobs mode="hire" />
              ) : null}
            </>
          ) : (
            <>
              {tab === "live_help" ? (
                <ExploreLiveHelpNow mode="work" />
              ) : tab === "pending" ? (
                <ExplorePendingResponses />
              ) : tab === "history" ? (
                <ExploreHistoryJobs mode="work" />
              ) : (
                <ExploreLiveHelpNow mode="work" />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
