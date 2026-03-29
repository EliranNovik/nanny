import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Briefcase,
  Bell,
  ClipboardList,
  Hourglass,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export const JOBS_TABS = [
  { id: "my_requests", label: "My Requests", icon: ClipboardList },
  { id: "requests", label: "Requests", icon: Bell },
  { id: "pending", label: "Pending Jobs", icon: Hourglass },
  { id: "jobs", label: "Live Jobs", icon: Briefcase },
  { id: "past", label: "Past Jobs", icon: CheckCircle2 },
] as const;

export type JobsTabId = (typeof JOBS_TABS)[number]["id"];

interface JobsTabBarProps {
  /** Dropdown alignment under the trigger */
  menuAlign?: "left" | "right" | "center";
  /** Hide mobile native select (e.g. desktop strip rendered on /jobs page) */
  hideMobile?: boolean;
  /** Hide desktop pill + arrows (e.g. tabs only in header were moved to page — mobile floating bar) */
  hideDesktop?: boolean;
}

/** Same as mobile search / bell in BottomNav: opaque frosted chip */
const TAB_CONTROL_SURFACE =
  "rounded-full border border-border/60 bg-card/90 shadow-lg backdrop-blur-md transition-all hover:bg-card active:scale-95 dark:border dark:border-border/60 dark:hover:bg-muted";

/** Mobile: native `<select>` (OS picker). Desktop: pill + anchored menu + optional prev/next. */
export function JobsTabBar({
  menuAlign = "right",
  hideMobile = false,
  hideDesktop = false,
}: JobsTabBarProps) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<JobsTabId, number>>({
    my_requests: 0,
    requests: 0,
    pending: 0,
    jobs: 0,
    past: 0,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const activeId = (searchParams.get("tab") || "requests") as JobsTabId;
  const active = JOBS_TABS.find((t) => t.id === activeId) ?? JOBS_TABS.find((t) => t.id === "requests")!;

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
            .select("id,status")
            .or(`client_id.eq.${user.id},selected_freelancer_id.eq.${user.id}`)
            .in("status", ["locked", "active", "completed", "cancelled"]),
          supabase
            .from("job_candidate_notifications")
            .select("job_id")
            .eq("freelancer_id", user.id)
            .in("status", ["pending", "opened"]),
          supabase.from("job_confirmations").select("job_id,status").eq("freelancer_id", user.id),
        ]);

        const lockedActive = (jobsRes.data || []).filter(
          (j: { status: string }) => j.status === "locked" || j.status === "active"
        ).length;
        const past = (jobsRes.data || []).filter(
          (j: { status: string }) => j.status === "completed" || j.status === "cancelled"
        ).length;

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
          jobs: lockedActive,
          past,
        });
      } catch {
        // keep zeros
      }
    }
    loadCounts();
  }, [user?.id]);

  function select(id: string) {
    setSearchParams({ tab: id }, { replace: true });
    setOpen(false);
  }

  const tabIds = JOBS_TABS.map((t) => t.id);
  const idx = tabIds.indexOf(activeId);
  const safeIdx = idx >= 0 ? idx : 0;
  const prevTabId = tabIds[(safeIdx - 1 + tabIds.length) % tabIds.length];
  const nextTabId = tabIds[(safeIdx + 1) % tabIds.length];

  function goPrev() {
    select(prevTabId);
  }

  function goNext() {
    select(nextTabId);
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
      {/* Mobile: prev / native OS picker / next */}
      {!hideMobile && (
      <div className="flex w-full max-w-[min(100vw-5rem,22rem)] items-center gap-1.5 md:hidden">
        <button
          type="button"
          onClick={goPrev}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center text-slate-600 dark:text-slate-300",
            TAB_CONTROL_SURFACE
          )}
          aria-label={`Previous tab: ${JOBS_TABS.find((t) => t.id === prevTabId)?.label ?? ""}`}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <div className="relative min-w-0 flex-1">
          {/* Wrapper carries the frosted chip so iOS still paints an opaque pill (native <select> often ignores bg on the control). */}
          <div className={cn("relative min-w-0", TAB_CONTROL_SURFACE)}>
            <ActiveIcon
              className="pointer-events-none absolute left-3 top-1/2 z-[3] h-4 w-4 -translate-y-1/2 text-primary"
              aria-hidden
            />
            <select
              value={activeId}
              aria-label="Jobs section"
              onChange={(e) => select(e.target.value)}
              className={cn(
                "relative z-[2] h-10 w-full min-w-0 cursor-pointer appearance-none border-0 bg-transparent py-2 pl-10 pr-[2.75rem] text-[14px] font-semibold text-slate-900 shadow-none outline-none ring-0 focus:ring-0 dark:text-white"
              )}
            >
              {JOBS_TABS.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
            <span
              className="pointer-events-none absolute right-9 top-1/2 z-[3] inline-flex h-5 min-w-[1.25rem] -translate-y-1/2 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[10px] font-bold leading-none tabular-nums text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
              aria-hidden
            >
              {counts[activeId] ?? 0}
            </span>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 z-[3] h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-zinc-400"
              aria-hidden
            />
          </div>
        </div>
        <button
          type="button"
          onClick={goNext}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center text-slate-600 dark:text-slate-300",
            TAB_CONTROL_SURFACE
          )}
          aria-label={`Next tab: ${JOBS_TABS.find((t) => t.id === nextTabId)?.label ?? ""}`}
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>
      )}

      {/* Tablet/desktop: prev / dropdown / next — centered on page */}
      {!hideDesktop && (
      <div className="hidden w-full min-w-0 items-center justify-center gap-2 md:flex">
        <button
          type="button"
          onClick={goPrev}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center text-slate-600 dark:text-slate-300",
            TAB_CONTROL_SURFACE
          )}
          aria-label={`Previous tab: ${JOBS_TABS.find((t) => t.id === prevTabId)?.label ?? ""}`}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>

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
              aria-label={`${counts[activeId] ?? 0} items in this section`}
            >
              {counts[activeId] ?? 0}
            </span>
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 self-center text-slate-500 transition-transform dark:text-zinc-400", open && "rotate-180")}
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
          {JOBS_TABS.map((tab) => {
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
                  {counts[tab.id as JobsTabId] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      )}
        </div>

        <button
          type="button"
          onClick={goNext}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center text-slate-600 dark:text-slate-300",
            TAB_CONTROL_SURFACE
          )}
          aria-label={`Next tab: ${JOBS_TABS.find((t) => t.id === nextTabId)?.label ?? ""}`}
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>
      )}
    </div>
  );
}
