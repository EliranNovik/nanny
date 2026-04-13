import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  Briefcase,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  HeartHandshake,
  HelpingHand,
  LayoutDashboard,
  Search,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  ALL_HELP_CATEGORY_ID,
  DISCOVER_HOME_CATEGORIES,
  SERVICE_CATEGORIES,
} from "@/lib/serviceCategories";
import { supabase } from "@/lib/supabase";
import { buildJobsUrl } from "@/components/jobs/jobsPerspective";
import { useDiscoverShortcutsCounts } from "@/hooks/useDiscoverShortcutsCounts";
import { DiscoverHomeActivitySection } from "@/components/discover/DiscoverHomeActivitySection";
import { DiscoverHomeLiveTrackerBoard } from "@/components/discover/DiscoverHomeLiveTrackerBoard";
 
type DiscoverRole = "client" | "freelancer";

type DiscoverHomeMode = "hire" | "work";

const HOME_INTENT_STORAGE_KEY = "mamalama_discover_home_intent_v1";

/** Action-oriented lines on category tiles (hire tab) — real-time / urgent tone */
const DISCOVER_CATEGORY_ACTION_LINE: Record<string, string> = {
  cleaning: "Need cleaning now?",
  cooking: "Find a cook today",
  pickup_delivery: "Quick delivery",
  nanny: "Need childcare?",
  other_help: "Odd jobs & more",
  all_help: "Browse everything",
};

/** Work tab — CTA to post availability per service */
const DISCOVER_CATEGORY_WORK_LINE: Record<string, string> = {
  cleaning: "Post cleaning availability",
  cooking: "Post cooking availability",
  pickup_delivery: "Post delivery & errands availability",
  nanny: "Post childcare availability",
  other_help: "Post availability for odd jobs",
};

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
  const navigate = useNavigate();
  const isClient = role === "client";

  const [homeMode, setHomeMode] = useState<DiscoverHomeMode>(() => {
    const stored = readStoredHomeMode();
    if (stored) return stored;
    return isClient ? "hire" : "work";
  });

  useEffect(() => {
    try {
      localStorage.setItem(HOME_INTENT_STORAGE_KEY, homeMode);
    } catch {
      /* ignore */
    }
  }, [homeMode]);

  const dashboardPath = isClient ? "/dashboard" : "/freelancer/dashboard";
  const { myPostedRequestsCount, incomingRequestsCount } = useDiscoverShortcutsCounts();
  const myPostedUrl = buildJobsUrl("client", "my_requests");
  const clientLiveJobsUrl = buildJobsUrl("client", "jobs");
  const incomingUrl = buildJobsUrl("freelancer", "requests");

  const onCategoryClick = (id: string) => {
    navigate(`/public/posts?category=${encodeURIComponent(id)}`);
  };

  const onWorkCategoryPostAvailability = (id: string) => {
    navigate(`/availability/post-now?category=${encodeURIComponent(id)}`);
  };

  const hireHelpersPath = isClient ? "/client/helpers" : "/public/posts";
  const workPrimaryPath = isClient ? "/availability" : buildJobsUrl("freelancer", "requests");

  const [livePostsByCategory, setLivePostsByCategory] = useState<
    Record<string, number>
  >(() =>
    Object.fromEntries(DISCOVER_HOME_CATEGORIES.map((c) => [c.id, 0]))
  );
  const [livePostsCountLoading, setLivePostsCountLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLivePostsCountLoading(true);
    void (async () => {
      const { data, error } = await supabase.rpc("get_community_feed_public", {
        p_category: null,
      });
      if (cancelled) return;
      if (error) {
        console.error("[DiscoverHomeContent] category counts", error);
        setLivePostsByCategory(
          Object.fromEntries(DISCOVER_HOME_CATEGORIES.map((c) => [c.id, 0]))
        );
        setLivePostsCountLoading(false);
        return;
      }
      const rows = (data ?? []) as { category: string | null }[];
      const next: Record<string, number> = Object.fromEntries(
        DISCOVER_HOME_CATEGORIES.map((c) => [c.id, 0])
      );
      for (const row of rows) {
        const cat = row.category?.trim();
        if (
          cat &&
          cat !== ALL_HELP_CATEGORY_ID &&
          cat in next
        ) {
          next[cat] += 1;
        }
      }
      next[ALL_HELP_CATEGORY_ID] = rows.length;
      setLivePostsByCategory(next);
      setLivePostsCountLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const liveCountLabel = useMemo(
    () => (catId: string) => {
      if (livePostsCountLoading) return "…";
      const n = livePostsByCategory[catId];
      return n === undefined ? "0" : n > 99 ? "99+" : String(n);
    },
    [livePostsByCategory, livePostsCountLoading]
  );

  const discoverCategoryScrollRef = useRef<HTMLDivElement>(null);
  const [discoverCategoryScroll, setDiscoverCategoryScroll] = useState({
    canScrollLeft: false,
    canScrollRight: false,
  });

  const refreshDiscoverCategoryScroll = useCallback(() => {
    const el = discoverCategoryScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const max = scrollWidth - clientWidth;
    setDiscoverCategoryScroll({
      canScrollLeft: scrollLeft > 2,
      canScrollRight: max > 2 && scrollLeft < max - 2,
    });
  }, []);

  useLayoutEffect(() => {
    if (homeMode !== "hire" && homeMode !== "work") return;
    const el = discoverCategoryScrollRef.current;
    if (!el) return;
    refreshDiscoverCategoryScroll();
    el.addEventListener("scroll", refreshDiscoverCategoryScroll, { passive: true });
    const ro = new ResizeObserver(() => refreshDiscoverCategoryScroll());
    ro.observe(el);
    window.addEventListener("resize", refreshDiscoverCategoryScroll);
    return () => {
      el.removeEventListener("scroll", refreshDiscoverCategoryScroll);
      ro.disconnect();
      window.removeEventListener("resize", refreshDiscoverCategoryScroll);
    };
  }, [homeMode, refreshDiscoverCategoryScroll, livePostsByCategory, livePostsCountLoading]);

  const scrollDiscoverCategories = useCallback((dir: "left" | "right") => {
    const el = discoverCategoryScrollRef.current;
    if (!el) return;
    const step = Math.min(Math.round(el.clientWidth * 0.85), 360);
    el.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" });
  }, []);

  return (
    <div className="relative min-h-screen gradient-mesh pb-6 md:pb-8">
      <div
        className={cn(
          "fixed inset-x-0 z-[45] pointer-events-none",
          /** Directly under fixed BottomNav header — keep in sync with `.app-content-below-fixed-header` in index.css */
          "top-[calc(env(safe-area-inset-top,0px)+3.5rem)]",
          "border-b border-border/30 bg-background/95 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-md",
          "supports-[backdrop-filter]:bg-background/85 dark:border-border/40 dark:bg-background/95 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)]"
        )}
      >
        <div className="app-desktop-shell pointer-events-auto">
          <div className="app-desktop-centered-wide max-w-lg px-2 py-2 md:max-w-2xl">
            <div
              role="tablist"
              aria-label="What are you here for?"
            >
              {/** Full pill switches theme: hire = orange→red; work = emerald→teal (landing-style); frosted thumb */}
              <div
                className={cn(
                  "relative mx-auto grid min-h-[62px] w-full max-w-[22rem] grid-cols-2 gap-0.5 overflow-hidden rounded-full p-1 sm:max-w-[24rem] sm:min-h-[70px]",
                  "border border-white/20 shadow-2xl backdrop-blur-md",
                  "transition-shadow duration-300",
                  homeMode === "hire"
                    ? "shadow-orange-900/30"
                    : "shadow-emerald-900/35"
                )}
              >
                <div
                  className={cn(
                    "pointer-events-none absolute inset-0 z-0 rounded-[inherit] bg-gradient-to-r from-orange-500 to-red-600",
                    "transition-opacity duration-300 ease-out",
                    homeMode === "hire" ? "opacity-100" : "opacity-0"
                  )}
                  aria-hidden
                />
                <div
                  className={cn(
                    "pointer-events-none absolute inset-0 z-0 rounded-[inherit] bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-700",
                    "transition-opacity duration-300 ease-out",
                    homeMode === "work" ? "opacity-100" : "opacity-0"
                  )}
                  aria-hidden
                />
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute top-1 bottom-1 left-1 z-[5] rounded-full",
                    "w-[calc((100%-0.625rem)/2)] will-change-transform",
                    "bg-white/20 shadow-inner backdrop-blur-sm ring-1 ring-white/35",
                    "transition-[transform] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]",
                    homeMode === "hire"
                      ? "translate-x-0"
                      : "translate-x-[calc(100%+0.125rem)]"
                  )}
                />
                <button
                  type="button"
                  role="tab"
                  aria-selected={homeMode === "hire"}
                  aria-label={homeMode === "hire" ? undefined : "I need help"}
                  onClick={() => setHomeMode("hire")}
                  className={cn(
                    "relative z-10 flex h-full min-h-[54px] min-w-0 items-center justify-center rounded-full px-3 py-2.5 sm:min-h-[62px] sm:px-3.5",
                    "transition-[color,transform] duration-300 ease-out",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    "active:scale-[0.98] motion-reduce:transition-none",
                    homeMode === "hire"
                      ? "gap-2.5 text-white sm:gap-3"
                      : "gap-2.5 text-white/65 hover:text-white/85 sm:gap-3"
                  )}
                >
                  <HeartHandshake
                    className={cn(
                      "h-6 w-6 shrink-0 text-white transition-transform duration-300 sm:h-7 sm:w-7",
                      homeMode === "hire" && "scale-105 drop-shadow-sm"
                    )}
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  {homeMode === "hire" && (
                    <span className="max-w-[min(100%,11rem)] truncate text-left text-sm font-bold leading-tight tracking-tight sm:max-w-[12rem] sm:text-base">
                      I need help
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={homeMode === "work"}
                  aria-label={homeMode === "work" ? undefined : "I want to work"}
                  onClick={() => setHomeMode("work")}
                  className={cn(
                    "relative z-10 flex h-full min-h-[54px] min-w-0 items-center justify-center rounded-full px-3 py-2.5 sm:min-h-[62px] sm:px-3.5",
                    "transition-[color,transform] duration-300 ease-out",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    "active:scale-[0.98] motion-reduce:transition-none",
                    homeMode === "work"
                      ? "gap-2.5 text-white sm:gap-3"
                      : "gap-2.5 text-white/65 hover:text-white/85 sm:gap-3"
                  )}
                >
                  <HelpingHand
                    className={cn(
                      "h-6 w-6 shrink-0 text-white transition-transform duration-300 sm:h-7 sm:w-7",
                      homeMode === "work" && "scale-105 drop-shadow-sm"
                    )}
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  {homeMode === "work" && (
                    <span className="max-w-[min(100%,11rem)] truncate text-left text-sm font-bold leading-tight tracking-tight sm:max-w-[12rem] sm:text-base">
                      I want to work
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "app-desktop-shell",
          /** Tab strip: py + full-width themed pill toggle (~62–70px) + border + gap */
          "pt-[calc(0.5rem+4.5rem+0.5rem+1px+0.75rem)]"
        )}
      >
        <div className="app-desktop-centered-wide max-w-lg md:max-w-2xl">
          <section className="mb-3 px-1" aria-label={homeMode === "hire" ? "Find helpers" : "Get work"}>
            {homeMode === "hire" ? (
              <button
                type="button"
                onClick={() => navigate(hireHelpersPath)}
                className={cn(
                  "flex w-full items-center gap-3 py-1.5 text-left outline-none transition-opacity",
                  "hover:opacity-90 active:opacity-75 active:scale-[0.99]",
                  "focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
                )}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400">
                  <Search className="h-6 w-6" aria-hidden strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1 leading-none">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {isClient ? "Search" : "Browse"}
                  </p>
                  <p className="mt-0.5 text-base font-bold text-foreground">
                    {isClient ? "Find helpers" : "See who’s offering help"}
                  </p>
                </div>
                <ChevronRight className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden strokeWidth={2} />
              </button>
            ) : isClient ? (
              <button
                type="button"
                onClick={() => navigate(workPrimaryPath)}
                className={cn(
                  "flex w-full items-center gap-3 py-1.5 text-left outline-none transition-opacity",
                  "hover:opacity-90 active:opacity-75 active:scale-[0.99]",
                  "focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
                )}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                  <CalendarPlus className="h-6 w-6" aria-hidden strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1 leading-none">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Go live
                  </p>
                  <p className="mt-0.5 text-base font-bold text-foreground">Post availability</p>
                </div>
                <ChevronRight className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden strokeWidth={2} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate(workPrimaryPath)}
                className={cn(
                  "flex w-full items-center gap-3 py-1.5 text-left outline-none transition-opacity",
                  "hover:opacity-90 active:opacity-75 active:scale-[0.99]",
                  "focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
                )}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                  <Users className="h-6 w-6" aria-hidden strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1 leading-none">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Open work
                  </p>
                  <p className="mt-0.5 text-base font-bold text-foreground">Browse open requests</p>
                </div>
                <ChevronRight className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden strokeWidth={2} />
              </button>
            )}
          </section>

          <DiscoverHomeActivitySection mode={homeMode} viewerRole={role} />

          {homeMode === "work" && (
            <section
              className={cn(
                "mb-6 mt-4",
                "-mx-4 w-[calc(100%+2rem)] px-2 sm:-mx-6 sm:w-[calc(100%+3rem)] sm:px-3",
                "md:mx-0 md:w-full md:px-0"
              )}
              aria-label="Post availability by category"
            >
              <div className="relative">
                <div
                  ref={discoverCategoryScrollRef}
                  className={cn(
                    "flex w-full snap-x snap-mandatory gap-2 overflow-x-auto overflow-y-hidden",
                    "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                    "touch-pan-x"
                  )}
                >
                  {SERVICE_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      aria-label={
                        livePostsCountLoading
                          ? `${cat.label}, loading live post count`
                          : `${DISCOVER_CATEGORY_WORK_LINE[cat.id] ?? cat.label}, ${livePostsByCategory[cat.id] ?? 0} live posts in category`
                      }
                      onClick={() => onWorkCategoryPostAvailability(cat.id)}
                      className={cn(
                        "group relative aspect-square shrink-0 grow-0 snap-start overflow-hidden rounded-2xl text-left outline-none",
                        "basis-[calc((100%-0.5rem)/2)] md:basis-[calc((100%-1rem)/3)]",
                        "shadow-md transition-[transform,box-shadow] duration-300 hover:shadow-lg active:scale-[0.98]",
                        "focus-visible:ring-2 focus-visible:ring-emerald-500/65 focus-visible:ring-inset"
                      )}
                    >
                      <img
                        src={cat.imageSrc}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        aria-hidden
                      />
                      <div className="pointer-events-none absolute inset-0 z-[1] bg-black/35" aria-hidden />
                      <span
                        className={cn(
                          "absolute left-1.5 top-1.5 z-[2] flex min-h-[1.5rem] min-w-[1.5rem] items-center justify-center rounded-full px-2 text-[11px] font-black tabular-nums leading-none sm:left-2 sm:top-2 sm:min-h-[1.65rem] sm:min-w-[1.65rem] sm:px-2 sm:text-xs md:text-sm",
                          "backdrop-blur-md backdrop-saturate-150",
                          "bg-white/70 text-slate-900 shadow-[0_1px_10px_rgba(0,0,0,0.12)] ring-1 ring-white/80",
                          "dark:bg-black/55 dark:text-white dark:shadow-[0_2px_14px_rgba(0,0,0,0.55)] dark:ring-white/15"
                        )}
                        aria-hidden
                      >
                        {liveCountLabel(cat.id)}
                      </span>
                      <div
                        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-black/90 via-black/55 to-transparent pt-14 pb-2 px-1.5 sm:pt-16 sm:pb-2.5 sm:px-2"
                        aria-hidden
                      />
                      <span className="absolute inset-x-0 bottom-0 z-[2] px-2 pb-2 pt-5 text-center text-base font-semibold leading-snug tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] max-md:pt-7 md:px-1.5 md:pt-5 md:text-base lg:text-lg md:pb-2.5">
                        {DISCOVER_CATEGORY_WORK_LINE[cat.id] ?? cat.label}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  aria-label="Scroll categories left"
                  disabled={!discoverCategoryScroll.canScrollLeft}
                  onClick={() => scrollDiscoverCategories("left")}
                  className={cn(
                    "absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full sm:left-3 sm:h-11 sm:w-11",
                    "border border-white/55 bg-white/25 text-foreground shadow-lg backdrop-blur-md",
                    "transition-[opacity,transform] hover:bg-white/40 hover:shadow-xl active:scale-95",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    "dark:border-white/15 dark:bg-black/30 dark:text-white dark:hover:bg-black/45",
                    "disabled:pointer-events-none disabled:opacity-30"
                  )}
                >
                  <ChevronLeft className="h-6 w-6 drop-shadow-sm" strokeWidth={2.5} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Scroll categories right"
                  disabled={!discoverCategoryScroll.canScrollRight}
                  onClick={() => scrollDiscoverCategories("right")}
                  className={cn(
                    "absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full sm:right-3 sm:h-11 sm:w-11",
                    "border border-white/55 bg-white/25 text-foreground shadow-lg backdrop-blur-md",
                    "transition-[opacity,transform] hover:bg-white/40 hover:shadow-xl active:scale-95",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    "dark:border-white/15 dark:bg-black/30 dark:text-white dark:hover:bg-black/45",
                    "disabled:pointer-events-none disabled:opacity-30"
                  )}
                >
                  <ChevronRight className="h-6 w-6 drop-shadow-sm" strokeWidth={2.5} aria-hidden />
                </button>
              </div>
            </section>
          )}

          {homeMode === "hire" && (
          <>
          <section
            className={cn(
              "mb-6 mt-4",
              "-mx-4 w-[calc(100%+2rem)] px-2 sm:-mx-6 sm:w-[calc(100%+3rem)] sm:px-3",
              "md:mx-0 md:w-full md:px-0"
            )}
            aria-label="Service categories"
          >
            <div className="relative">
              <div
                ref={discoverCategoryScrollRef}
                className={cn(
                  "flex w-full snap-x snap-mandatory gap-2 overflow-x-auto overflow-y-hidden",
                  "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                  "touch-pan-x"
                )}
              >
                {DISCOVER_HOME_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    aria-label={
                      livePostsCountLoading
                        ? `${cat.label}, loading live post count`
                        : `${cat.label}, ${livePostsByCategory[cat.id] ?? 0} live posts`
                    }
                    onClick={() => onCategoryClick(cat.id)}
                    className={cn(
                      "group relative aspect-square shrink-0 grow-0 snap-start overflow-hidden rounded-2xl text-left outline-none",
                      /** Mobile: two larger tiles per viewport (one gap-2). md+: three per viewport. */
                      "basis-[calc((100%-0.5rem)/2)] md:basis-[calc((100%-1rem)/3)]",
                      "shadow-md transition-[transform,box-shadow] duration-300 hover:shadow-lg active:scale-[0.98]",
                      "focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-inset",
                    )}
                  >
                    <img
                      src={cat.imageSrc}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      aria-hidden
                    />
                    <div
                      className="pointer-events-none absolute inset-0 z-[1] bg-black/35"
                      aria-hidden
                    />
                    <span
                      className={cn(
                        "absolute left-1.5 top-1.5 z-[2] flex min-h-[1.5rem] min-w-[1.5rem] items-center justify-center rounded-full px-2 text-[11px] font-black tabular-nums leading-none sm:left-2 sm:top-2 sm:min-h-[1.65rem] sm:min-w-[1.65rem] sm:px-2 sm:text-xs md:text-sm",
                        "backdrop-blur-md backdrop-saturate-150",
                        "bg-white/70 text-slate-900 shadow-[0_1px_10px_rgba(0,0,0,0.12)] ring-1 ring-white/80",
                        "dark:bg-black/55 dark:text-white dark:shadow-[0_2px_14px_rgba(0,0,0,0.55)] dark:ring-white/15"
                      )}
                      aria-hidden
                    >
                      {liveCountLabel(cat.id)}
                    </span>
                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-black/90 via-black/55 to-transparent pt-14 pb-2 px-1.5 sm:pt-16 sm:pb-2.5 sm:px-2"
                      aria-hidden
                    />
                    <span className="absolute inset-x-0 bottom-0 z-[2] px-2 pb-2 pt-5 text-center text-lg font-semibold leading-snug tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] max-md:pt-7 md:px-1.5 md:pt-5 md:text-base lg:text-lg md:pb-2.5">
                      {DISCOVER_CATEGORY_ACTION_LINE[cat.id] ?? cat.label}
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                aria-label="Scroll categories left"
                disabled={!discoverCategoryScroll.canScrollLeft}
                onClick={() => scrollDiscoverCategories("left")}
                className={cn(
                  "absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full sm:left-3 sm:h-11 sm:w-11",
                  "border border-white/55 bg-white/25 text-foreground shadow-lg backdrop-blur-md",
                  "transition-[opacity,transform] hover:bg-white/40 hover:shadow-xl active:scale-95",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                  "dark:border-white/15 dark:bg-black/30 dark:text-white dark:hover:bg-black/45",
                  "disabled:pointer-events-none disabled:opacity-30"
                )}
              >
                <ChevronLeft className="h-6 w-6 drop-shadow-sm" strokeWidth={2.5} aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Scroll categories right"
                disabled={!discoverCategoryScroll.canScrollRight}
                onClick={() => scrollDiscoverCategories("right")}
                className={cn(
                  "absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full sm:right-3 sm:h-11 sm:w-11",
                  "border border-white/55 bg-white/25 text-foreground shadow-lg backdrop-blur-md",
                  "transition-[opacity,transform] hover:bg-white/40 hover:shadow-xl active:scale-95",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                  "dark:border-white/15 dark:bg-black/30 dark:text-white dark:hover:bg-black/45",
                  "disabled:pointer-events-none disabled:opacity-30"
                )}
              >
                <ChevronRight className="h-6 w-6 drop-shadow-sm" strokeWidth={2.5} aria-hidden />
              </button>
            </div>
          </section>

          <div className="mb-4 mt-10">
            <DiscoverHomeLiveTrackerBoard />
          </div>
          </>
          )}

          <section className="mt-6 px-1 pb-8" aria-label="Shortcuts">
            <div className="grid grid-cols-3 gap-1 sm:gap-2">
              {homeMode === "hire" ? (
                <>
                  <Link
                    to={myPostedUrl}
                    className="relative flex flex-col items-center gap-2 py-2 text-center outline-none transition-opacity hover:opacity-90 active:opacity-75 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-orange-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
                  >
                    {myPostedRequestsCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -right-0.5 -top-0.5 flex h-7 min-w-7 items-center justify-center border-[3px] border-background px-1.5 text-xs font-black leading-none shadow-sm"
                      >
                        {myPostedRequestsCount > 99 ? "99+" : myPostedRequestsCount}
                      </Badge>
                    )}
                    <ClipboardList className="h-8 w-8 text-orange-500" aria-hidden strokeWidth={2.25} />
                    <span className="text-xs font-bold leading-tight text-foreground sm:text-sm">My posted requests</span>
                  </Link>
                  <Link
                    to={clientLiveJobsUrl}
                    className="relative flex flex-col items-center gap-2 py-2 text-center outline-none transition-opacity hover:opacity-90 active:opacity-75 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-orange-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
                  >
                    <Briefcase className="h-8 w-8 text-orange-500" aria-hidden strokeWidth={2.25} />
                    <span className="text-xs font-bold leading-tight text-foreground sm:text-sm">
                      {isClient ? "Helping me now" : "Helping now"}
                    </span>
                  </Link>
                  <Link
                    to={dashboardPath}
                    className="relative flex flex-col items-center gap-2 py-2 text-center outline-none transition-opacity hover:opacity-90 active:opacity-75 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-orange-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
                  >
                    <LayoutDashboard className="h-8 w-8 text-violet-500" aria-hidden strokeWidth={2.25} />
                    <span className="text-xs font-bold leading-tight text-foreground sm:text-sm">Dashboard</span>
                  </Link>
                </>
              ) : isClient ? (
                <>
                  <Link
                    to="/availability"
                    className="relative flex flex-col items-center gap-2 py-2 text-center outline-none transition-opacity hover:opacity-90 active:opacity-75 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-orange-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
                  >
                    <CalendarPlus className="h-8 w-8 text-emerald-600" aria-hidden strokeWidth={2.25} />
                    <span className="text-xs font-bold leading-tight text-foreground sm:text-sm">My availability</span>
                  </Link>
                  <Link
                    to={clientLiveJobsUrl}
                    className="relative flex flex-col items-center gap-2 py-2 text-center outline-none transition-opacity hover:opacity-90 active:opacity-75 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-orange-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
                  >
                    <Briefcase className="h-8 w-8 text-orange-500" aria-hidden strokeWidth={2.25} />
                    <span className="text-xs font-bold leading-tight text-foreground sm:text-sm">
                      Helping now
                    </span>
                  </Link>
                  <Link
                    to={dashboardPath}
                    className="relative flex flex-col items-center gap-2 py-2 text-center outline-none transition-opacity hover:opacity-90 active:opacity-75 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-orange-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
                  >
                    <LayoutDashboard className="h-8 w-8 text-violet-500" aria-hidden strokeWidth={2.25} />
                    <span className="text-xs font-bold leading-tight text-foreground sm:text-sm">Dashboard</span>
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to={incomingUrl}
                    className="relative flex flex-col items-center gap-2 py-2 text-center outline-none transition-opacity hover:opacity-90 active:opacity-75 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-orange-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
                  >
                    {incomingRequestsCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -right-0.5 -top-0.5 flex h-7 min-w-7 items-center justify-center border-[3px] border-background px-1.5 text-xs font-black leading-none shadow-sm"
                      >
                        {incomingRequestsCount > 99 ? "99+" : incomingRequestsCount}
                      </Badge>
                    )}
                    <Bell className="h-8 w-8 text-amber-500" aria-hidden strokeWidth={2.25} />
                    <span className="px-0.5 text-[10px] font-bold leading-tight text-foreground sm:text-xs">
                      Community needs your help in…
                    </span>
                  </Link>
                  <Link
                    to="/availability"
                    className="relative flex flex-col items-center gap-2 py-2 text-center outline-none transition-opacity hover:opacity-90 active:opacity-75 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-orange-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
                  >
                    <CalendarPlus className="h-8 w-8 text-emerald-600" aria-hidden strokeWidth={2.25} />
                    <span className="text-xs font-bold leading-tight text-foreground sm:text-sm">My availability</span>
                  </Link>
                  <Link
                    to={dashboardPath}
                    className="relative flex flex-col items-center gap-2 py-2 text-center outline-none transition-opacity hover:opacity-90 active:opacity-75 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-orange-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
                  >
                    <LayoutDashboard className="h-8 w-8 text-violet-500" aria-hidden strokeWidth={2.25} />
                    <span className="text-xs font-bold leading-tight text-foreground sm:text-sm">Dashboard</span>
                  </Link>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
