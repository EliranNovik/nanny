import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Briefcase, Bell, ClipboardList, Hourglass, CheckCircle2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeId = (searchParams.get("tab") || "requests") as JobsTabId;
  const active = JOBS_TABS.find((t) => t.id === activeId) ?? JOBS_TABS.find((t) => t.id === "requests")!;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
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

  function select(id: string) {
    setSearchParams({ tab: id }, { replace: true });
    setOpen(false);
  }

  const ActiveIcon = active.icon;

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "flex h-9 max-w-[min(72vw,15rem)] items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-[13px] font-semibold shadow-sm transition-colors",
          "border-slate-200 bg-white text-slate-900",
          "hover:bg-slate-50",
          "dark:border-zinc-600 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800",
          "md:max-w-[14rem]"
        )}
      >
        <ActiveIcon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{active.label}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform dark:text-zinc-400", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute top-full z-[80] mt-1.5 w-[min(calc(100vw-2rem),15rem)] rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-zinc-600 dark:bg-zinc-900",
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
                  "flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium transition-colors",
                  selected
                    ? "bg-orange-50 text-orange-800 dark:bg-orange-950/60 dark:text-orange-200"
                    : "text-slate-900 hover:bg-slate-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    selected ? "text-orange-600 dark:text-orange-400" : "text-slate-600 dark:text-zinc-400"
                  )}
                  aria-hidden
                />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
