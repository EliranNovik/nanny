import { ClipboardList, Sparkles, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export type SavedContentTab = "posts" | "requests" | "profiles";

type Props = {
  savedTab: SavedContentTab;
  onTabChange: (tab: SavedContentTab) => void;
  loading: boolean;
  postsCount: number;
  requestsCount: number;
  profilesCount: number;
  showRequestsTab?: boolean;
  className?: string;
};

const tabOrder: SavedContentTab[] = ["posts", "requests", "profiles"];

export function SavedContentTabBar({
  savedTab,
  onTabChange,
  loading,
  postsCount,
  requestsCount,
  profilesCount,
  showRequestsTab = true,
  className,
}: Props) {
  const visibleTabs = showRequestsTab
    ? tabOrder
    : (["posts", "profiles"] as SavedContentTab[]);
  const activeIndex = visibleTabs.indexOf(savedTab);
  const columnCount = visibleTabs.length;

  return (
    <div className={cn("mx-auto flex max-w-2xl justify-center px-2 py-2 md:px-0", className)}>
      <div
        role="tablist"
        aria-label="Saved content type"
        className="flex w-full justify-center"
      >
        <div
          className={cn(
            "relative mx-auto grid min-h-[56px] w-full max-w-[28rem] gap-1 overflow-hidden rounded-full p-1.5 sm:min-h-[64px] sm:max-w-[32rem]",
            columnCount === 3 ? "grid-cols-3" : "grid-cols-2 max-w-[24rem] sm:max-w-[24rem]",
            "bg-slate-100/80 border border-slate-200/60 shadow-inner",
            "dark:bg-zinc-900/50 dark:border-zinc-800/60 leading-none",
          )}
        >
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-1.5 bottom-1.5 left-1.5 z-[5] rounded-[9999px] will-change-transform",
              "bg-white shadow-sm ring-1 ring-slate-900/5",
              "dark:bg-zinc-800 dark:ring-white/10 dark:shadow-none",
              "transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
              columnCount === 3
                ? cn(
                    "w-[calc((100%-0.5rem)/3)]",
                    activeIndex === 0 && "translate-x-0",
                    activeIndex === 1 && "translate-x-[calc(100%+0.25rem)]",
                    activeIndex === 2 && "translate-x-[calc(200%+0.5rem)]",
                  )
                : cn(
                    "w-[calc((100%-0.25rem)/2)]",
                    activeIndex === 0 && "translate-x-0",
                    activeIndex === 1 && "translate-x-[calc(100%+0.25rem)]",
                  ),
            )}
          />

          <button
            type="button"
            role="tab"
            aria-selected={savedTab === "posts"}
            onClick={() => onTabChange("posts")}
            className={cn(
              "relative z-10 flex h-full min-h-[54px] min-w-0 items-center justify-center rounded-full px-1.5 py-2.5 sm:min-h-[62px] sm:px-2",
              "transition-[color,transform] duration-300 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
              "active:scale-[0.98] motion-reduce:transition-none",
              savedTab === "posts"
                ? "gap-1.5 text-slate-900 dark:text-white sm:gap-2"
                : "gap-1.5 text-slate-500 hover:text-slate-700 sm:gap-2 dark:text-zinc-400 dark:hover:text-zinc-200",
            )}
          >
            <Sparkles
              className={cn(
                "h-5 w-5 shrink-0 transition-colors duration-300 sm:h-6 sm:w-6",
                savedTab === "posts"
                  ? "text-rose-500 dark:text-rose-500"
                  : "text-slate-400 dark:text-zinc-500",
              )}
              strokeWidth={2.25}
              aria-hidden
            />
            {savedTab === "posts" && (
              <>
                <span className="max-w-[min(100%,4.5rem)] truncate text-sm font-bold leading-tight tracking-tight sm:text-[15px]">
                  Posts
                </span>
                <span className="shrink-0 tabular-nums text-xs font-bold text-slate-500/80 dark:text-zinc-400/80 sm:text-sm">
                  ({loading ? "…" : postsCount})
                </span>
              </>
            )}
          </button>

          {showRequestsTab ? (
            <button
              type="button"
              role="tab"
              aria-selected={savedTab === "requests"}
              onClick={() => onTabChange("requests")}
              className={cn(
                "relative z-10 flex h-full min-h-[54px] min-w-0 items-center justify-center rounded-full px-1.5 py-2.5 sm:min-h-[62px] sm:px-2",
                "transition-[color,transform] duration-300 ease-out",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                "active:scale-[0.98] motion-reduce:transition-none",
                savedTab === "requests"
                  ? "gap-1.5 text-slate-900 dark:text-white sm:gap-2"
                  : "gap-1.5 text-slate-500 hover:text-slate-700 sm:gap-2 dark:text-zinc-400 dark:hover:text-zinc-200",
              )}
            >
              <ClipboardList
                className={cn(
                  "h-5 w-5 shrink-0 transition-colors duration-300 sm:h-6 sm:w-6",
                  savedTab === "requests"
                    ? "text-emerald-500 dark:text-emerald-400"
                    : "text-slate-400 dark:text-zinc-500",
                )}
                strokeWidth={2.25}
                aria-hidden
              />
              {savedTab === "requests" && (
                <>
                  <span className="max-w-[min(100%,5.5rem)] truncate text-sm font-bold leading-tight tracking-tight sm:text-[15px]">
                    Requests
                  </span>
                  <span className="shrink-0 tabular-nums text-xs font-bold text-slate-500/80 dark:text-zinc-400/80 sm:text-sm">
                    ({loading ? "…" : requestsCount})
                  </span>
                </>
              )}
            </button>
          ) : null}

          <button
            type="button"
            role="tab"
            aria-selected={savedTab === "profiles"}
            onClick={() => onTabChange("profiles")}
            className={cn(
              "relative z-10 flex h-full min-h-[54px] min-w-0 items-center justify-center rounded-full px-1.5 py-2.5 sm:min-h-[62px] sm:px-2",
              "transition-[color,transform] duration-300 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
              "active:scale-[0.98] motion-reduce:transition-none",
              savedTab === "profiles"
                ? "gap-1.5 text-slate-900 dark:text-white sm:gap-2"
                : "gap-1.5 text-slate-500 hover:text-slate-700 sm:gap-2 dark:text-zinc-400 dark:hover:text-zinc-200",
            )}
          >
            <UserRound
              className={cn(
                "h-5 w-5 shrink-0 transition-colors duration-300 sm:h-6 sm:w-6",
                savedTab === "profiles"
                  ? "text-rose-500 dark:text-rose-500"
                  : "text-slate-400 dark:text-zinc-500",
              )}
              strokeWidth={2.25}
              aria-hidden
            />
            {savedTab === "profiles" && (
              <>
                <span className="max-w-[min(100%,5rem)] truncate text-sm font-bold leading-tight tracking-tight sm:text-[15px]">
                  Profiles
                </span>
                <span className="shrink-0 tabular-nums text-xs font-bold text-slate-500/80 dark:text-zinc-400/80 sm:text-sm">
                  ({loading ? "…" : profilesCount})
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
