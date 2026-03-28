import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

/** Collapsed: active tab only; tap opens list, pick tab, closes. */
export function JobsTabBar({ menuAlign = "right" }: JobsTabBarProps) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
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
    if (typeof window === "undefined") return;
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (isMobile) return;
    const close = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open, isMobile]);

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
          supabase
            .from("job_confirmations")
            .select("job_id,status")
            .eq("freelancer_id", user.id),
        ]);

        const lockedActive = (jobsRes.data || []).filter((j: any) => j.status === "locked" || j.status === "active").length;
        const past = (jobsRes.data || []).filter((j: any) => j.status === "completed" || j.status === "cancelled").length;

        const confirmedIds = new Set((confRes.data || []).filter((c: any) => c.status === "available").map((c: any) => c.job_id));
        const pending = (notifsRes.data || []).filter((n: any) => confirmedIds.has(n.job_id)).length;
        const requests = (notifsRes.data || []).length - pending;

        setCounts({
          my_requests: myReqRes.count || 0,
          requests: Math.max(0, requests),
          pending: Math.max(0, pending),
          jobs: lockedActive,
          past,
        });
      } catch {
        // keep zeros on error
      }
    }
    loadCounts();
  }, [user?.id]);

  function select(id: string) {
    setSearchParams({ tab: id }, { replace: true });
    setOpen(false);
  }

  const ActiveIcon = active.icon;
  const canPortal = typeof document !== "undefined";

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "flex h-10 max-w-[min(72vw,16rem)] items-center gap-2 rounded-full border px-3.5 py-1.5 text-left text-[14px] font-semibold shadow-sm transition-colors",
          "border-slate-200 bg-white text-slate-900",
          "hover:bg-slate-50",
          "dark:border-zinc-600 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800",
          "md:max-w-[17rem] md:justify-center md:gap-2.5 md:px-4 md:text-[16px] md:font-bold"
        )}
      >
        <ActiveIcon className="h-4 w-4 shrink-0 text-primary md:h-[1.125rem] md:w-[1.125rem]" aria-hidden />
        <span className="min-w-0 flex-1 truncate md:flex-none md:text-center">{active.label}</span>
        <span
          className="inline-flex min-w-[1.75rem] shrink-0 items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
          aria-label={`${counts[activeId] ?? 0} items`}
        >
          {counts[activeId] ?? 0}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform dark:text-zinc-400", open && "rotate-180")}
        />
      </button>

      {open && !isMobile && (
        <div
          className={cn(
            "absolute top-full z-[80] mt-2 w-[min(calc(100vw-2rem),17rem)] rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg dark:border-zinc-600 dark:bg-zinc-900",
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
                <span className="truncate">{tab.label}</span>
                <span
                  className={cn(
                    "ml-auto inline-flex min-w-[1.9rem] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold leading-none",
                    selected
                      ? "bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-200"
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

      {open && isMobile && canPortal &&
        createPortal(
        <>
          <button
            type="button"
            className="fixed inset-0 z-[260] bg-black/35 backdrop-blur-[1px] md:hidden"
            aria-label="Close tab picker"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-[270] rounded-t-[1.75rem] border border-slate-200/90 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_45px_rgba(0,0,0,0.18)] backdrop-blur-xl dark:border-zinc-700/80 dark:bg-zinc-900/95 md:hidden">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-zinc-600" />
            <div className="mb-3 border-b border-slate-200/70 px-1 pb-2 dark:border-zinc-700/70">
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-400">Switch jobs tab</p>
            </div>

            <div className="space-y-2">
              {JOBS_TABS.map((tab) => {
                const Icon = tab.icon;
                const selected = tab.id === activeId;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => select(tab.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all duration-200 active:scale-[0.99]",
                      selected
                        ? "border-orange-300/80 bg-gradient-to-r from-orange-50 to-amber-50 text-orange-800 shadow-[0_8px_20px_rgba(249,115,22,0.15)] dark:border-orange-700/70 dark:from-orange-950/50 dark:to-amber-950/40 dark:text-orange-200"
                        : "border-transparent bg-slate-50/80 text-slate-900 hover:border-slate-200 hover:bg-slate-100 dark:bg-zinc-800/70 dark:text-zinc-100 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5 shrink-0 transition-transform",
                        selected ? "text-orange-600 dark:text-orange-400" : "text-slate-600 dark:text-zinc-400"
                      )}
                    />
                    <span className="flex-1 text-[15px] font-medium">{tab.label}</span>
                    <span
                      className={cn(
                        "inline-flex min-w-[2rem] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold leading-none shadow-sm",
                        selected
                          ? "bg-orange-100 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-900/60 dark:text-orange-200 dark:ring-orange-700/60"
                          : "bg-slate-200 text-slate-600 ring-1 ring-slate-300/70 dark:bg-zinc-700 dark:text-zinc-300 dark:ring-zinc-600"
                      )}
                    >
                      {counts[tab.id as JobsTabId] ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
