import { useToast } from "@/components/ui/toast";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useMobileShellScrollCollapse } from "@/hooks/useMobileShellScrollCollapse";
import { ChevronRight } from "lucide-react";
import { DiscoverHomeActionFirst } from "@/components/discover/DiscoverHomeActionFirst";
import {
  readDiscoverHomeIntent,
  subscribeDiscoverHomeIntent,
  writeDiscoverHomeIntent,
  type DiscoverHomeIntent,
} from "@/lib/discoverHomeIntent";

type DiscoverRole = "client" | "freelancer";

export function DiscoverHomeContent({ role }: { role: DiscoverRole }) {
  /** Keep `--mobile-shell-collapse-progress` at 0 on Discover — tab strip stays fixed (no scroll-linked collapse). */
  useMobileShellScrollCollapse(false);
  const { addToast } = useToast();
  const isClient = role === "client";
  const [homeMode, setHomeMode] = useState<DiscoverHomeIntent>(() =>
    readDiscoverHomeIntent(isClient ? "hire" : "work"),
  );

  useEffect(() => {
    return subscribeDiscoverHomeIntent((m) => {
      setHomeMode((prev) => (prev === m ? prev : m));
    });
  }, []);

  useEffect(() => {
    if (!writeDiscoverHomeIntent(homeMode)) {
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
        "relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-background",
        "max-md:h-full max-md:pb-0",
        "md:min-h-screen md:flex-none md:overflow-visible md:pb-12",
      )}
      data-discover-home-page=""
      data-discover-home-mode={homeMode}
    >
      {/* Mobile only: fixed tab strip under status bar (desktop uses header toggle in BottomNav). */}
      <div
        data-discover-toggle-strip=""
        className={cn(
          "fixed inset-x-0 z-[55] pointer-events-none md:hidden",
          "bg-white dark:bg-background",
          "top-0",
        )}
      >
        <div
          aria-hidden
          className={cn(
            "shrink-0 max-md:transition-none dark:bg-background",
            "bg-white",
          )}
          style={{
            height: "calc(env(safe-area-inset-top, 0px) + 3.5rem)",
          }}
        />
        <div className="app-desktop-shell pointer-events-none flex max-md:justify-stretch max-md:px-2.5">
          <div className="pointer-events-auto flex w-full max-w-[26rem] items-center justify-between px-2 py-2 sm:max-w-[28rem]">
            {homeMode === "hire" ? (
              <>
                <h1 className="text-[17px] font-black tracking-tight text-slate-900 dark:text-white pl-2">
                  Get help now
                </h1>
                <button
                  type="button"
                  onClick={() => setHomeMode("work")}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100/80 px-3.5 py-2 text-[13px] font-bold text-slate-700 backdrop-blur-md transition-colors hover:bg-slate-200 dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:bg-zinc-700 shadow-sm"
                >
                  Help others?
                  <ChevronRight className="-mr-0.5 h-4 w-4 opacity-70" aria-hidden />
                </button>
              </>
            ) : (
              <>
                <h1 className="text-[17px] font-black tracking-tight text-slate-900 dark:text-white pl-2">
                  Help others now
                </h1>
                <button
                  type="button"
                  onClick={() => setHomeMode("hire")}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100/80 px-3.5 py-2 text-[13px] font-bold text-slate-700 backdrop-blur-md transition-colors hover:bg-slate-200 dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:bg-zinc-700 shadow-sm"
                >
                  Get help?
                  <ChevronRight className="-mr-0.5 h-4 w-4 opacity-70" aria-hidden />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className={cn(
          "app-desktop-shell flex min-h-0 flex-1 flex-col overflow-hidden max-md:!px-0 max-md:transition-none",
          "max-md:pt-[calc(env(safe-area-inset-top,0px)+3.75rem)]",
          "md:pt-7",
        )}
      >
        <div className="mx-auto flex min-h-0 w-full flex-1 flex-col overflow-hidden md:mx-0 md:max-w-none">
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
