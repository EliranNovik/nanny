import { useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { DiscoverHomeLatestOwnPosts } from "@/components/discover/DiscoverHomeLatestOwnPosts";
import { ExploreClientHireInterests } from "@/components/discover/ExploreClientHireInterests";
import { ExploreYourMatches } from "@/components/discover/ExploreYourMatches";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";

const EXPLORE_TABS = ["matches", "my_hires", "others_hires"] as const;
type ExploreTab = (typeof EXPLORE_TABS)[number];

function normalizeExploreTab(raw: string | null): ExploreTab {
  if (raw === "my_hires" || raw === "hires") return "my_hires";
  if (raw === "others_hires") return "others_hires";
  return "matches";
}

function exploreSubtitle(tab: ExploreTab): string {
  if (tab === "matches") {
    return "Live jobs paired from availability or requests.";
  }
  if (tab === "my_hires") {
    return "Posts where you tapped Connect / Hire now on someone else’s availability.";
  }
  return "Hire interest others sent on your own live availability posts.";
}

/**
 * Explore: **Your matches** | **My hire requests** (outgoing) | **Others hire requests** (incoming on your posts).
 */
export default function ExplorePage() {
  const location = useLocation();
  const isClientExplore = location.pathname.startsWith("/client/");
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = normalizeExploreTab(searchParams.get("tab"));

  useEffect(() => {
    trackEvent("explore_open", {
      tab,
      viewer: isClientExplore ? "client" : "freelancer",
    });
  }, [tab, isClientExplore]);

  function setTab(next: ExploreTab) {
    trackEvent("explore_tab", { tab: next });
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set("tab", next);
        return n;
      },
      { replace: true },
    );
  }

  return (
    <div
      className="min-h-screen bg-background pb-8 md:pb-10"
      data-explore-page=""
    >
      <div className="app-desktop-shell max-md:transition-none pt-6 md:pt-8">
        <div className="mb-5 px-1">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white md:text-3xl">
            Explore
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {exploreSubtitle(tab)}
          </p>
        </div>

        <div className="mb-6 px-1">
          <div
            className="grid w-full grid-cols-3 gap-0.5 rounded-xl bg-muted/80 p-1 sm:gap-1"
            role="tablist"
            aria-label="Explore sections"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "matches"}
              onClick={() => setTab("matches")}
              className={cn(
                "rounded-lg px-1 py-2 text-center text-[10px] font-bold leading-tight transition-colors sm:px-2 sm:py-2.5 sm:text-sm",
                tab === "matches"
                  ? "bg-background text-foreground shadow-sm ring-1 ring-black/[0.06] dark:bg-zinc-900 dark:ring-white/10"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Your matches
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "my_hires"}
              onClick={() => setTab("my_hires")}
              className={cn(
                "rounded-lg px-1 py-2 text-center text-[10px] font-bold leading-tight transition-colors sm:px-2 sm:py-2.5 sm:text-sm",
                tab === "my_hires"
                  ? "bg-background text-foreground shadow-sm ring-1 ring-black/[0.06] dark:bg-zinc-900 dark:ring-white/10"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              My hire requests
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "others_hires"}
              onClick={() => setTab("others_hires")}
              className={cn(
                "rounded-lg px-1 py-2 text-center text-[10px] font-bold leading-tight transition-colors sm:px-2 sm:py-2.5 sm:text-sm",
                tab === "others_hires"
                  ? "bg-background text-foreground shadow-sm ring-1 ring-black/[0.06] dark:bg-zinc-900 dark:ring-white/10"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Others hire requests
            </button>
          </div>
        </div>

        <div className="px-1">
          {tab === "matches" ? (
            <ExploreYourMatches embeddedInExplore />
          ) : tab === "my_hires" ? (
            <ExploreClientHireInterests />
          ) : (
            <DiscoverHomeLatestOwnPosts
              variant="page"
              embeddedInExplore
            />
          )}
        </div>
      </div>
    </div>
  );
}
