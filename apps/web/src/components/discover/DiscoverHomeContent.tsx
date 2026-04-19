import { useToast } from "@/components/ui/toast";
import { useEffect, useState } from "react";
import { HeartHandshake, HelpingHand } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMobileShellScrollCollapse } from "@/hooks/useMobileShellScrollCollapse";
import { DiscoverHomeActionFirst } from "@/components/discover/DiscoverHomeActionFirst";
import {
  DISCOVER_STROKE,
  discoverIcon,
} from "@/components/discover/discoverHomeIcons";

type DiscoverRole = "client" | "freelancer";
type DiscoverHomeMode = "hire" | "work";
const HOME_INTENT_STORAGE_KEY = "mamalama_discover_home_intent_v1";

function readStoredHomeMode(): DiscoverHomeMode | null {
  try {
    const v = localStorage.getItem(HOME_INTENT_STORAGE_KEY);
    if (v === "hire" || v === "work") return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function DiscoverHomeContent({ role }: { role: DiscoverRole }) {
  useMobileShellScrollCollapse(true);
  const { addToast } = useToast();
  const isClient = role === "client";
  const [homeMode, setHomeMode] = useState<DiscoverHomeMode>(() => {
    const stored = readStoredHomeMode();
    if (stored) return stored;
    return "hire";
  });

  useEffect(() => {
    try {
      localStorage.setItem(HOME_INTENT_STORAGE_KEY, homeMode);
    } catch {
      addToast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "error",
      });
    }
  }, [homeMode, addToast]);

  const explorePath = isClient ? "/client/explore" : "/freelancer/explore";
  const workPrimaryPath = "/availability/post-now";
  const createRequestPath = "/client/create";

  return (
    <div
      className={cn(
        "relative min-h-screen bg-white pb-6 md:pb-12 dark:bg-background",
      )}
      data-discover-home-page=""
      data-discover-home-mode={homeMode}
    >
      <div
        className={cn(
          "fixed inset-x-0 z-[55] pointer-events-none border-b-0 shadow-none",
          "bg-white dark:bg-background",
          "max-md:top-0",
          "md:top-[calc(env(safe-area-inset-top,0px)+3.5rem)]",
        )}
      >
        <div
          aria-hidden
          className={cn(
            "shrink-0 md:hidden max-md:transition-none dark:bg-background",
            "bg-white",
          )}
          style={{
            height:
              "calc(env(safe-area-inset-top, 0px) + (1 - var(--mobile-shell-collapse-progress, 0)) * 3.5rem)",
          }}
        />
        <div className="app-desktop-shell pointer-events-auto max-md:px-2.5">
          <div className="w-full px-2 py-2">
            <div role="tablist" aria-label="What are you here for?">
              <div
                className={cn(
                  "relative isolate mx-auto grid min-h-[56px] w-full max-w-[26rem] grid-cols-2 items-stretch gap-1 overflow-hidden rounded-[28px] p-1.5 sm:max-w-[28rem] md:max-w-[30rem] sm:min-h-[64px]",
                  "border border-slate-200/90 bg-slate-100/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
                  "dark:border-zinc-700/80 dark:bg-zinc-800/90 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
                  "leading-none",
                )}
              >
                {/* Sliding white “pill” — iOS-style thumb; labels stay purple / green when active */}
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute top-1.5 bottom-1.5 left-1.5 z-[5] rounded-[22px]",
                    "w-[calc((100%-1rem)/2)] will-change-transform",
                    "bg-white shadow-[0_2px_8px_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.04)]",
                    "ring-1 ring-black/[0.05]",
                    "dark:bg-zinc-100 dark:shadow-[0_2px_10px_rgba(0,0,0,0.35)] dark:ring-white/10",
                    "transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                    homeMode === "hire"
                      ? "translate-x-0"
                      : "translate-x-[calc(100%+0.25rem)]",
                  )}
                />
                <button
                  type="button"
                  role="tab"
                  aria-selected={homeMode === "hire"}
                  aria-label={homeMode === "hire" ? undefined : "I need help"}
                  onClick={() => setHomeMode("hire")}
                  className={cn(
                    "relative z-10 flex h-full min-h-[54px] w-full min-w-0 items-center justify-center gap-1 rounded-[22px] px-2 py-2.5 sm:min-h-[62px] sm:gap-1.5 sm:px-3",
                    "transition-[color,transform] duration-300 ease-out",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B61FF]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    "active:scale-[0.98] motion-reduce:transition-none",
                    homeMode === "hire"
                      ? "text-[#7B61FF]"
                      : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200",
                  )}
                >
                  <HeartHandshake
                    className={cn(
                      discoverIcon.md,
                      "shrink-0 transition-colors duration-300 sm:h-6 sm:w-6",
                      homeMode === "hire"
                        ? "text-[#7B61FF]"
                        : "text-slate-400 dark:text-zinc-500",
                    )}
                    strokeWidth={DISCOVER_STROKE}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 text-center text-[13px] font-bold leading-tight tracking-tight sm:text-[16px]",
                      homeMode === "hire"
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
                  aria-selected={homeMode === "work"}
                  aria-label={homeMode === "work" ? undefined : "Help others"}
                  onClick={() => setHomeMode("work")}
                  className={cn(
                    "relative z-10 flex h-full min-h-[54px] w-full min-w-0 items-center justify-center gap-1 rounded-[22px] px-2 py-2.5 sm:min-h-[62px] sm:gap-1.5 sm:px-3",
                    "transition-[color,transform] duration-300 ease-out",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#065f46]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    "active:scale-[0.98] motion-reduce:transition-none",
                    homeMode === "work"
                      ? "text-[#065f46]"
                      : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200",
                  )}
                >
                  <HelpingHand
                    className={cn(
                      discoverIcon.md,
                      "shrink-0 transition-colors duration-300 sm:h-6 sm:w-6",
                      homeMode === "work"
                        ? "text-[#065f46]"
                        : "text-slate-400 dark:text-zinc-500",
                    )}
                    strokeWidth={DISCOVER_STROKE}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 text-center text-[13px] font-bold leading-tight tracking-tight sm:text-[16px]",
                      homeMode === "work"
                        ? "text-[#065f46]"
                        : "text-slate-500 dark:text-zinc-400",
                    )}
                  >
                    Help others
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="app-desktop-shell max-md:transition-none max-md:px-2.5 pt-[calc(0.5rem+4.5rem+0.5rem+1px+0.75rem)]">
        <div className="mx-auto w-full max-w-[26rem] sm:max-w-[28rem] md:max-w-[30rem]">
          <DiscoverHomeActionFirst
            homeMode={homeMode}
            explorePath={explorePath}
            workPrimaryPath={workPrimaryPath}
            createRequestPath={createRequestPath}
          />
        </div>
      </div>
    </div>
  );
}
