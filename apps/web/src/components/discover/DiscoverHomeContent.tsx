import { useToast } from "@/components/ui/toast";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useMobileShellScrollCollapse } from "@/hooks/useMobileShellScrollCollapse";
import { DiscoverHomeActionFirst } from "@/components/discover/DiscoverHomeActionFirst";
import {
  readDiscoverHomeIntent,
  subscribeDiscoverHomeIntent,
  writeDiscoverHomeIntent,
  type DiscoverHomeIntent,
} from "@/lib/discoverHomeIntent";

type DiscoverRole = "client" | "freelancer";

export function DiscoverHomeContent({ role }: { role: DiscoverRole }) {
  /** Enable scroll-linked collapse for mobile shell. */
  useMobileShellScrollCollapse(true);

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
        "relative flex min-h-0 flex-1 flex-col bg-white dark:bg-background",
        homeMode === "work" || homeMode === "hire"
          ? "max-md:pb-[calc(6.25rem+max(0.5rem,env(safe-area-inset-bottom,0px)))]"
          : "max-md:pb-0",
        "md:min-h-screen md:flex-none md:overflow-visible md:pb-12 md:overflow-y-auto",
      )}
      data-discover-home-page=""
      data-discover-home-mode={homeMode}
    >
      <div
        className={cn(
          "app-desktop-shell flex min-h-0 flex-1 flex-col max-md:!px-0 max-md:transition-none",
          "pt-2 md:pt-7",
        )}
      >
        <div className="mx-auto flex min-h-0 w-full flex-1 flex-col overflow-visible px-0 md:mx-0 md:max-w-none md:px-4 md:overflow-hidden">
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
