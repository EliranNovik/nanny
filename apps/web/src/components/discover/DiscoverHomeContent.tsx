import { useToast } from "@/components/ui/toast";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useMobileShellScrollCollapse } from "@/hooks/useMobileShellScrollCollapse";
import { DiscoverHomeActionFirst } from "@/components/discover/DiscoverHomeActionFirst";
import { DiscoverHomeModeSegmentedControl } from "@/components/discover/DiscoverHomeModeSegmentedControl";
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
    readDiscoverHomeIntent(),
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
          <div className="pointer-events-auto w-full max-w-[26rem] px-2 py-2 sm:max-w-[28rem]">
            <DiscoverHomeModeSegmentedControl
              mode={homeMode}
              onModeChange={setHomeMode}
              variant="page"
            />
          </div>
        </div>
      </div>

      <div
        className={cn(
          "app-desktop-shell flex min-h-0 flex-1 flex-col overflow-hidden max-md:px-2.5 max-md:transition-none",
          "max-md:pt-[calc(0.5rem+4.5rem+0.5rem+1px+0.75rem)]",
          "md:pt-7",
        )}
      >
        <div className="mx-auto flex min-h-0 w-full max-w-[26rem] flex-1 flex-col overflow-hidden sm:max-w-[28rem] md:mx-0 md:max-w-none">
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
