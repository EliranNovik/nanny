import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { HeartHandshake, HelpingHand } from "lucide-react";
import { ExploreMyPostedRequests } from "@/components/discover/ExploreMyPostedRequests";
import { ExploreYourMatches } from "@/components/discover/ExploreYourMatches";
import { ExploreLiveHelpNow } from "@/components/discover/ExploreLiveHelpNow";
import { ExploreHistoryJobs } from "@/components/discover/ExploreHistoryJobs";
import { ExplorePendingResponses } from "@/components/discover/ExplorePendingResponses";
import {
  DISCOVER_STROKE,
  discoverIcon,
} from "@/components/discover/discoverHomeIcons";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useFreelancerRequests } from "@/hooks/data/useFreelancerRequests";

type ExploreMode = "hire" | "work";

const HIRE_TABS = ["matches", "live_help", "my_requests", "history"] as const;
const WORK_TABS = ["matches", "live_help", "pending", "history"] as const;
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
    if (raw === "matches" || raw === "match") {
      return { mode, tab: "matches" };
    }
    return { mode, tab: "matches" };
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
  if (raw === "matches" || raw === "match") {
    return { mode, tab: "matches" };
  }
  return { mode, tab: "matches" };
}

const HIRE_TAB_ITEMS: { id: HireTabId; label: string }[] = [
  { id: "matches", label: "Matches" },
  { id: "live_help", label: "Live help" },
  { id: "my_requests", label: "My requests" },
  { id: "history", label: "History" },
];

const WORK_TAB_ITEMS: { id: WorkTabId; label: string }[] = [
  { id: "matches", label: "Matches" },
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
                "shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-left text-xs font-semibold transition-colors sm:px-4 sm:text-sm",
                selected
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="inline-flex items-center gap-2">
                <span>{label}</span>
                {typeof c === "number" ? (
                  <span
                    className={cn(
                      "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums",
                      selected
                        ? "bg-primary/10 text-foreground"
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

  const { mode, tab } = useMemo(
    () => parseExploreSearchParams(searchParams),
    [searchParams],
  );

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "others_hires" || t === "my_availability") {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          if (!n.get("mode")) n.set("mode", "work");
          n.set("tab", "matches");
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
        next.matches = liveHelpCount + myRequestsCount;
      } else {
        next.matches = liveHelpCount;
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
        if (!ok) n.set("tab", "matches");
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

  const summary =
    mode === "hire"
      ? "As someone looking for help: live matches on your requests and open requests you posted."
      : "As a helper: client requests you accepted and jobs matched to you.";

  return (
    <div
      className="relative min-h-screen bg-background pb-8 md:pb-10 dark:bg-background"
      data-explore-page=""
      data-explore-mode={mode}
    >
      {/* Fixed under BottomNav header — same shell as Discover home primary toggle */}
      <div
        className={cn(
          "fixed inset-x-0 z-[55] pointer-events-none border-b border-border/40 shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:border-border/30 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)]",
          "bg-white dark:bg-background",
          "max-md:top-0",
          "md:top-[calc(env(safe-area-inset-top,0px)+3.5rem)]",
        )}
      >
        <div
          aria-hidden
          className="shrink-0 bg-white dark:bg-background md:hidden"
          style={{
            height: "calc(env(safe-area-inset-top, 0px) + 3.5rem)",
          }}
        />
        <div className="app-desktop-shell pointer-events-auto max-md:px-2.5">
          <div className="w-full space-y-2 px-2 py-2">
            <div role="tablist" aria-label="Explore: what are you here for?">
              <div
                className={cn(
                  "relative isolate mx-auto grid min-h-[56px] w-full max-w-[26rem] grid-cols-2 items-stretch gap-1 overflow-hidden rounded-[28px] p-1.5 sm:max-w-[28rem] md:max-w-[30rem] sm:min-h-[64px]",
                  "border border-slate-200/90 bg-slate-100/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
                  "dark:border-zinc-700/80 dark:bg-zinc-800/90 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
                  "leading-none",
                )}
              >
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute top-1.5 bottom-1.5 left-1.5 z-[5] rounded-[22px]",
                    "w-[calc((100%-1rem)/2)] will-change-transform",
                    "bg-white shadow-[0_2px_8px_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.04)]",
                    "ring-1 ring-black/[0.05]",
                    "dark:bg-zinc-100 dark:shadow-[0_2px_10px_rgba(0,0,0,0.35)] dark:ring-white/10",
                    "transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                    mode === "hire"
                      ? "translate-x-0"
                      : "translate-x-[calc(100%+0.25rem)]",
                  )}
                />
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "hire"}
                  onClick={() => setMode("hire")}
                  className={cn(
                    "relative z-10 flex h-full min-h-[54px] w-full min-w-0 items-center justify-center gap-1 rounded-[22px] px-2 py-2.5 sm:min-h-[62px] sm:gap-1.5 sm:px-3",
                    "transition-[color,transform] duration-300 ease-out",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B61FF]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    "active:scale-[0.98] motion-reduce:transition-none",
                    mode === "hire"
                      ? "text-[#7B61FF]"
                      : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200",
                  )}
                >
                  <HeartHandshake
                    className={cn(
                      discoverIcon.md,
                      "shrink-0 transition-colors duration-300 sm:h-6 sm:w-6",
                      mode === "hire"
                        ? "text-[#7B61FF]"
                        : "text-slate-400 dark:text-zinc-500",
                    )}
                    strokeWidth={DISCOVER_STROKE}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 text-center text-[13px] font-bold leading-tight tracking-tight sm:text-[16px]",
                      mode === "hire"
                        ? "text-[#7B61FF]"
                        : "text-slate-500 dark:text-zinc-400",
                    )}
                  >
                    I need help
                  </span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "work"}
                  onClick={() => setMode("work")}
                  className={cn(
                    "relative z-10 flex h-full min-h-[54px] w-full min-w-0 items-center justify-center gap-1 rounded-[22px] px-2 py-2.5 sm:min-h-[62px] sm:gap-1.5 sm:px-3",
                    "transition-[color,transform] duration-300 ease-out",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#065f46]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    "active:scale-[0.98] motion-reduce:transition-none",
                    mode === "work"
                      ? "text-[#065f46]"
                      : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200",
                  )}
                >
                  <HelpingHand
                    className={cn(
                      discoverIcon.md,
                      "shrink-0 transition-colors duration-300 sm:h-6 sm:w-6",
                      mode === "work"
                        ? "text-[#065f46]"
                        : "text-slate-400 dark:text-zinc-500",
                    )}
                    strokeWidth={DISCOVER_STROKE}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 text-center text-[13px] font-bold leading-tight tracking-tight sm:text-[16px]",
                      mode === "work"
                        ? "text-[#065f46]"
                        : "text-slate-500 dark:text-zinc-400",
                    )}
                  >
                    Help others
                  </span>
                </button>
              </div>
            </div>

            <ExploreSecondaryUnderlineTabs
              mode={mode}
              tab={tab}
              onTabChange={setTab}
              counts={tabCounts}
            />
          </div>
        </div>
      </div>

      {/* Scroll area: offset = mobile header spacer + primary toggle + underline tab row */}
      <div
        className={cn(
          "app-desktop-shell app-scroll-below-explore-fixed max-md:px-2.5",
        )}
      >
        <div className="mb-5 px-1 pt-1">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white md:text-3xl">
            Explore
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {summary}
          </p>
        </div>

        <div className="px-1">
          {mode === "hire" ? (
            <>
              {tab === "matches" ? (
                <ExploreYourMatches
                  embeddedInExplore
                  matchPerspective="client"
                />
              ) : tab === "live_help" ? (
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
                <ExploreYourMatches embeddedInExplore matchPerspective="helper" />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
