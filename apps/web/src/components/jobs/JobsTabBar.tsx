import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Briefcase, Bell, ClipboardList, Hourglass, CheckCircle2, ChevronDown } from "lucide-react";
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
  /** Dropdown alignment under the trigger (left = mobile top-left bar, right = desktop next to search) */
  menuAlign?: "left" | "right";
}

/** Mobile: native `<select>` (OS picker). Desktop: pill + anchored menu. */
export function JobsTabBar({ menuAlign = "right" }: JobsTabBarProps) {
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

  const ActiveIcon = active.icon;

  return (
    <div ref={containerRef} className="relative shrink-0">
      {/* Mobile: native OS picker (no bottom sheet) */}
      <div className="relative max-w-[min(72vw,16rem)] md:hidden">
        <ActiveIcon
          className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-primary"
          aria-hidden
        />
        <select
          value={activeId}
          aria-label="Jobs section"
          onChange={(e) => select(e.target.value)}
          className={cn(
            "h-10 w-full min-w-0 cursor-pointer appearance-none rounded-full border border-slate-200 bg-card py-2 pl-10 pr-[2.75rem] text-[14px] font-semibold text-slate-900 shadow-sm",
            "dark:border-border dark:bg-card dark:text-white"
          )}
        >
          {JOBS_TABS.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label}
            </option>
          ))}
        </select>
        <span
          className="pointer-events-none absolute right-9 top-1/2 z-[1] inline-flex h-5 min-w-[1.25rem] -translate-y-1/2 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[10px] font-bold leading-none tabular-nums text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
          aria-hidden
        >
          {counts[activeId] ?? 0}
        </span>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-zinc-400"
          aria-hidden
        />
      </div>

      {/* Desktop: button + anchored menu */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "hidden h-10 max-w-[17rem] items-center gap-2 rounded-full border px-4 py-0 text-left text-[16px] font-bold leading-none shadow-sm transition-colors md:inline-flex",
          "border-slate-200 bg-card text-slate-900",
          "hover:bg-slate-50",
          "dark:border-border dark:bg-card dark:text-white dark:hover:bg-muted",
          "md:justify-center md:gap-2.5"
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
            "absolute top-full z-[80] mt-2 hidden w-[min(calc(100vw-2rem),17rem)] rounded-xl border border-slate-200 bg-card py-1.5 shadow-lg dark:border-border dark:bg-card md:block",
            menuAlign === "left" ? "left-0" : "right-0"
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
  );
}
