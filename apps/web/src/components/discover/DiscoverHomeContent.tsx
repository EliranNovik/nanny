import { useToast } from "@/components/ui/toast";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
  /** Discover home: fixed mobile header — no scroll-linked shell collapse. */
  useMobileShellScrollCollapse(false);

  const { addToast } = useToast();
  const isClient = role === "client";
  const [searchParams] = useSearchParams();
  const homeFromUrl = searchParams.get("home");
  const [homeMode, setHomeMode] = useState<DiscoverHomeIntent>(() => {
    if (homeFromUrl === "hire" || homeFromUrl === "work") return homeFromUrl;
    return readDiscoverHomeIntent(isClient ? "hire" : "work");
  });

  useEffect(() => {
    if (homeFromUrl === "hire" || homeFromUrl === "work") {
      setHomeMode((prev) => (prev === homeFromUrl ? prev : homeFromUrl));
    }
  }, [homeFromUrl]);

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

  const workPrimaryPath = "/availability/post-now";
  const createRequestPath = "/client/create";

  return (
    <div
      className={cn(
        "relative flex flex-col bg-white dark:bg-background",
        "max-md:min-h-0 max-md:flex-1 max-md:pb-0",
        "md:h-full md:min-h-0 md:overflow-x-hidden md:overflow-y-auto md:pb-8",
      )}
      data-discover-home-page=""
      data-discover-home-mode={homeMode}
    >
      <div
        className={cn(
          "app-desktop-shell flex flex-col max-md:min-h-0 max-md:flex-1 max-md:!px-0 max-md:transition-none",
          /* Discovery home: trim the desktop shell's outer padding so carousels stretch closer to the screen edges */
          "md:!px-4 lg:!px-5 xl:!px-6 2xl:!px-8",
          "pt-0 md:pt-7",
        )}
      >
        <div className="mx-auto flex w-full flex-col px-0 max-md:min-h-0 max-md:flex-1 md:mx-0 md:max-w-none">
          <DiscoverHomeActionFirst
            homeMode={homeMode}
            workPrimaryPath={workPrimaryPath}
            createRequestPath={createRequestPath}
          />
        </div>
      </div>
    </div>
  );
}
