import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import type { JobsPerspective } from "./jobsPerspective";
import { tabsForPerspective } from "./jobsTabConfig";
import { defaultTabForPerspective, isTabValidForPerspective } from "./jobsPerspective";

interface JobsTabBarProps {
  menuAlign?: "left" | "right" | "center";
  hideMobile?: boolean;
  hideDesktop?: boolean;
}

const TAB_CONTROL_SURFACE =
  "rounded-full border border-border/60 bg-card/90 shadow-lg backdrop-blur-md transition-all hover:bg-card active:scale-95 dark:border dark:border-border/60 dark:hover:bg-muted";

/** Mobile: neutral, light frame — no primary/orange chip look */
const MOBILE_TAB_SURFACE =
  "rounded-xl border border-slate-200/70 bg-white/90 shadow-sm backdrop-blur-sm transition-colors dark:border-border/50 dark:bg-zinc-900/50";

export function JobsTabBar({
  menuAlign = "right",
  hideMobile = false,
  hideDesktop = false,
}: JobsTabBarProps) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({
    my_requests: 0,
    requests: 0,
    pending: 0,
    jobs_client: 0,
    past_client: 0,
    jobs_freelancer: 0,
    past_freelancer: 0,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const mode = searchParams.get("mode") as JobsPerspective | null;
  const tabFromUrl = searchParams.get("tab");

  const tabs = mode === "freelancer" || mode === "client" ? tabsForPerspective(mode) : null;

  const activeId =
    tabs && tabFromUrl && isTabValidForPerspective(mode!, tabFromUrl)
      ? tabFromUrl
      : tabs
        ? defaultTabForPerspective(mode!)
        : "requests";

  const active = tabs?.find((t) => t.id === activeId) ?? tabs?.[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!window.matchMedia("(min-width: 768px)").matches) return;
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    async function loadCounts() {
      if (!user) return;
      try {
        const [myReqRes, jobsRes, notifsRes, confRes] = await Promise.all([
          supabase
            .from("job_requests")
            .select("id", { count: "exact", head: true })
            .eq("client_id", user.id)
            .in("status", ["ready", "notifying", "confirmations_closed"]),
          supabase
            .from("job_requests")
            .select("id,status,client_id,selected_freelancer_id")
            .or(`client_id.eq.${user.id},selected_freelancer_id.eq.${user.id}`)
            .in("status", ["locked", "active", "completed", "cancelled"]),
          supabase
            .from("job_candidate_notifications")
            .select("job_id")
            .eq("freelancer_id", user.id)
            .in("status", ["pending", "opened"]),
          supabase.from("job_confirmations").select("job_id,status").eq("freelancer_id", user.id),
        ]);

        const rows = (jobsRes.data || []) as {
          status: string;
          client_id: string;
          selected_freelancer_id: string | null;
        }[];
        const asClient = rows.filter((j) => j.client_id === user.id);
        const asFreelancer = rows.filter((j) => j.selected_freelancer_id === user.id);
        const countLivePast = (arr: typeof rows) => ({
          live: arr.filter((j) => j.status === "locked" || j.status === "active").length,
          past: arr.filter((j) => j.status === "completed" || j.status === "cancelled").length,
        });
        const clientLP = countLivePast(asClient);
        const freelancerLP = countLivePast(asFreelancer);

        const confirmedIds = new Set(
          (confRes.data || [])
            .filter((c: { status: string }) => c.status === "available")
            .map((c: { job_id: string }) => c.job_id)
        );
        const pending = (notifsRes.data || []).filter((n: { job_id: string }) =>
          confirmedIds.has(n.job_id)
        ).length;
        const requests = (notifsRes.data || []).length - pending;

        setCounts({
          my_requests: myReqRes.count || 0,
          requests: Math.max(0, requests),
          pending: Math.max(0, pending),
          jobs_client: clientLP.live,
          past_client: clientLP.past,
          jobs_freelancer: freelancerLP.live,
          past_freelancer: freelancerLP.past,
        });
      } catch {
        // keep zeros
      }
    }
    loadCounts();
  }, [user?.id]);

  function select(nextTabId: string) {
    if (!mode) return;
    setSearchParams({ mode, tab: nextTabId }, { replace: true });
    setOpen(false);
  }

  useEffect(() => {
    if (!mode || !tabs) return;
    if (tabFromUrl && isTabValidForPerspective(mode, tabFromUrl)) return;
    setSearchParams({ mode, tab: defaultTabForPerspective(mode) }, { replace: true });
  }, [mode, tabFromUrl, tabs, setSearchParams]);

  if (!tabs || !active || !mode) {
    return null;
  }

  function badgeCountForTab(tabId: string): number {
    if (tabId === "jobs") {
      return mode === "client" ? counts.jobs_client ?? 0 : counts.jobs_freelancer ?? 0;
    }
    if (tabId === "past") {
      return mode === "client" ? counts.past_client ?? 0 : counts.past_freelancer ?? 0;
    }
    return counts[tabId] ?? 0;
  }

  const ActiveIcon = active.icon;

  const menuPositionClass =
    menuAlign === "left"
      ? "left-0"
      : menuAlign === "center"
        ? "left-1/2 -translate-x-1/2"
        : "right-0";

  return (
    <div ref={containerRef} className="relative shrink-0 md:max-w-full">
      {!hideMobile && (
        <div className="flex w-full min-w-0 max-w-[min(13.75rem,calc(100vw-7.5rem))] shrink items-center md:hidden">
          <div className="relative min-w-0 flex-1">
            <div className={cn("relative min-w-0", MOBILE_TAB_SURFACE)}>
              <ActiveIcon
                className="pointer-events-none absolute left-2 top-1/2 z-[3] h-3.5 w-3.5 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                aria-hidden
              />
              <select
                value={activeId}
                aria-label="Jobs section"
                onChange={(e) => select(e.target.value)}
                className={cn(
                  "relative z-[2] h-9 w-full min-w-0 max-w-full cursor-pointer appearance-none border-0 bg-transparent py-1.5 pl-8 pr-10 text-[12px] font-semibold leading-tight text-slate-900 shadow-none outline-none ring-0 focus:ring-0 dark:text-white"
                )}
              >
                {tabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label}
                  </option>
                ))}
              </select>
              <span
                className="pointer-events-none absolute right-7 top-1/2 z-[3] inline-flex h-4 min-w-[1.125rem] -translate-y-1/2 items-center justify-center rounded-full bg-slate-100 px-1 text-[9px] font-bold leading-none tabular-nums text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
                aria-hidden
              >
                {badgeCountForTab(activeId)}
              </span>
              <ChevronDown
                className="pointer-events-none absolute right-2 top-1/2 z-[3] h-3.5 w-3.5 -translate-y-1/2 text-slate-500 dark:text-zinc-400"
                aria-hidden
              />
            </div>
          </div>
        </div>
      )}

      {!hideDesktop && (
        <div className="hidden w-full min-w-0 items-center justify-center md:flex">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-haspopup="listbox"
              className={cn(
                "flex h-10 w-full min-w-0 max-w-[17rem] items-center gap-2 px-4 py-0 text-left text-[16px] font-bold leading-none sm:mx-auto",
                "text-slate-900 dark:text-white",
                TAB_CONTROL_SURFACE,
                open && "ring-2 ring-primary/35",
                "justify-center gap-2.5"
              )}
            >
              <ActiveIcon className="h-[1.125rem] w-[1.125rem] shrink-0 self-center text-primary" aria-hidden />
              <span className="min-w-0 flex-none self-center text-center leading-none">{active.label}</span>
              <span
                className="inline-flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center self-center rounded-full bg-slate-100 px-2 text-[11px] font-bold leading-none tabular-nums text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
                aria-label={`${badgeCountForTab(activeId)} items in this section`}
              >
                {badgeCountForTab(activeId)}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 self-center text-slate-500 transition-transform dark:text-zinc-400",
                  open && "rotate-180"
                )}
              />
            </button>

            {open && (
              <div
                className={cn(
                  "absolute top-full z-[80] mt-2 w-[min(calc(100vw-2rem),17rem)] rounded-xl border border-slate-200 bg-card py-1.5 shadow-lg dark:border-border dark:bg-card",
                  menuPositionClass
                )}
                role="listbox"
              >
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const selected = tab.id === activeId;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => select(tab.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3.5 py-3 text-left text-[14px] font-medium transition-colors md:text-[15px] md:font-semibold",
                        selected
                          ? "bg-orange-50 text-orange-800 dark:bg-orange-950/60 dark:text-orange-200"
                          : "text-slate-900 hover:bg-slate-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4.5 w-4.5 shrink-0",
                          selected ? "text-orange-600 dark:text-orange-400" : "text-slate-600 dark:text-zinc-400"
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate text-left">{tab.label}</span>
                      <span
                        className={cn(
                          "ml-auto inline-flex min-w-[1.75rem] shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold leading-none tabular-nums",
                          selected
                            ? "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-100"
                            : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
                        )}
                      >
                        {badgeCountForTab(tab.id)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
