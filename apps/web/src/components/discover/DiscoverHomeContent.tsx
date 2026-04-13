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
} from "@/lib/serviceCategories";
import { supabase } from "@/lib/supabase";
import { buildJobsUrl } from "@/components/jobs/jobsPerspective";
import { useDiscoverShortcutsCounts } from "@/hooks/useDiscoverShortcutsCounts";
import { DiscoverHomeActivitySection } from "@/components/discover/DiscoverHomeActivitySection";
 
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

  const hireCategoryScrollRef = useRef<HTMLDivElement>(null);
  const [hireCategoryScroll, setHireCategoryScroll] = useState({
    canScrollLeft: false,
    canScrollRight: false,
  });

  const refreshHireCategoryScroll = useCallback(() => {
    const el = hireCategoryScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const max = scrollWidth - clientWidth;
    setHireCategoryScroll({
      canScrollLeft: scrollLeft > 2,
      canScrollRight: max > 2 && scrollLeft < max - 2,
    });
  }, []);

  useLayoutEffect(() => {
    if (homeMode !== "hire") return;
    const el = hireCategoryScrollRef.current;
    if (!el) return;
    refreshHireCategoryScroll();
    el.addEventListener("scroll", refreshHireCategoryScroll, { passive: true });
    const ro = new ResizeObserver(() => refreshHireCategoryScroll());
    ro.observe(el);
    window.addEventListener("resize", refreshHireCategoryScroll);
    return () => {
      el.removeEventListener("scroll", refreshHireCategoryScroll);
      ro.disconnect();
      window.removeEventListener("resize", refreshHireCategoryScroll);
    };
  }, [homeMode, refreshHireCategoryScroll, livePostsByCategory, livePostsCountLoading]);

  const scrollHireCategories = useCallback((dir: "left" | "right") => {
    const el = hireCategoryScrollRef.current;
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
          <div className="app-desktop-centered-wide max-w-lg px-1 py-2 md:max-w-2xl">
            <div
              role="tablist"
              aria-label="What are you here for?"
            >
              <div
                className={cn(
                  "relative mx-auto grid h-11 w-full max-w-[15.5rem] grid-cols-2 gap-0.5 rounded-full p-1 sm:max-w-[17rem]",
                  "bg-muted/50 ring-1 ring-inset ring-black/[0.06] dark:bg-muted/35 dark:ring-white/[0.08]",
                  "shadow-[inset_0_1px_1px_rgba(255,255,255,0.45)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]"
                )}
              >
                {/* Sliding thumb — animates between segments */}
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute top-1 bottom-1 left-1 rounded-full bg-background",
                    "w-[calc((100%-0.625rem)/2)] will-change-transform",
                    "shadow-[0_2px_10px_-3px_rgba(15,23,42,0.18),0_1px_0_rgba(255,255,255,0.85)_inset] ring-1",
                    "transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]",
                    "dark:bg-zinc-900/95 dark:shadow-[0_4px_16px_-6px_rgba(0,0,0,0.55)]",
                    homeMode === "hire"
                      ? "translate-x-0 ring-orange-200/90 dark:shadow-[0_4px_18px_-6px_rgba(249,115,22,0.35)] dark:ring-orange-500/30"
                      : "translate-x-[calc(100%+0.125rem)] ring-emerald-200/90 dark:shadow-[0_4px_18px_-6px_rgba(52,211,153,0.28)] dark:ring-emerald-500/28"
                  )}
                />
                <button
                  type="button"
                  role="tab"
                  aria-selected={homeMode === "hire"}
                  aria-label={homeMode === "hire" ? undefined : "I need a helper"}
                  onClick={() => setHomeMode("hire")}
                  className={cn(
                    "relative z-10 flex h-full min-w-0 items-center justify-center rounded-full px-1.5 py-2 transition-colors duration-300 ease-out",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "active:scale-[0.98] motion-reduce:transition-none",
                    homeMode === "hire"
                      ? "gap-1.5 text-orange-600 dark:text-orange-400 sm:gap-2"
                      : "text-muted-foreground hover:text-foreground/85"
                  )}
                >
                  <HeartHandshake
                    className={cn(
                      "h-[1.125rem] w-[1.125rem] shrink-0 transition-transform duration-300 sm:h-5 sm:w-5",
                      homeMode === "hire" && "scale-105"
                    )}
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  {homeMode === "hire" && (
                    <span className="animate-in fade-in slide-in-from-left-1 truncate text-[11px] font-semibold leading-none tracking-tight duration-300 sm:text-xs">
                      I need a helper
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={homeMode === "work"}
                  aria-label={homeMode === "work" ? undefined : "I want to help"}
                  onClick={() => setHomeMode("work")}
                  className={cn(
                    "relative z-10 flex h-full min-w-0 items-center justify-center rounded-full px-1.5 py-2 transition-colors duration-300 ease-out",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "active:scale-[0.98] motion-reduce:transition-none",
                    homeMode === "work"
                      ? "gap-1.5 text-emerald-700 dark:text-emerald-400 sm:gap-2"
                      : "text-muted-foreground hover:text-foreground/85"
                  )}
                >
                  <HelpingHand
                    className={cn(
                      "h-[1.125rem] w-[1.125rem] shrink-0 transition-transform duration-300 sm:h-5 sm:w-5",
                      homeMode === "work" && "scale-105"
                    )}
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  {homeMode === "work" && (
                    <span className="animate-in fade-in slide-in-from-right-1 truncate text-[11px] font-semibold leading-none tracking-tight duration-300 sm:text-xs">
                      I want to help
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
          /** Match fixed tab strip: py-2 + h-11 + border-b + extra gap below tabs */
          "pt-[calc(0.5rem+2.75rem+0.5rem+1px+1rem)]"
        )}
      >
        <div className="app-desktop-centered-wide max-w-lg md:max-w-2xl">
          <section className="mb-5 px-1" aria-label={homeMode === "hire" ? "Find helpers" : "Get work"}>
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

          <DiscoverHomeActivitySection mode={homeMode} />

          {homeMode === "hire" && (
          <section
            className={cn(
              "mb-8 mt-6",
              "-mx-4 w-[calc(100%+2rem)] px-2 sm:-mx-6 sm:w-[calc(100%+3rem)] sm:px-3",
              "md:mx-0 md:w-full md:px-0"
            )}
            aria-label="Service categories"
          >
            <div className="relative">
              <div
                ref={hireCategoryScrollRef}
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
                      "group relative aspect-square shrink-0 grow-0 snap-start overflow-hidden rounded-xl text-left outline-none",
                      /** Three tiles per viewport; 2× gap-2 (0.5rem) between three columns */
                      "basis-[calc((100%-1rem)/3)] md:rounded-2xl",
                      "transition-transform active:scale-[0.98]",
                      "focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-inset",
                    )}
                  >
                    <img
                      src={cat.imageSrc}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      aria-hidden
                    />
                    <span
                      className={cn(
                        "absolute left-1.5 top-1.5 z-[2] flex min-h-[1.35rem] min-w-[1.35rem] items-center justify-center rounded-full px-1.5 text-[10px] font-black tabular-nums leading-none sm:left-2 sm:top-2 sm:min-h-[1.5rem] sm:min-w-[1.5rem] sm:px-2 sm:text-[11px]",
                        "backdrop-blur-md backdrop-saturate-150",
                        "bg-white/55 text-slate-900 shadow-[0_1px_10px_rgba(0,0,0,0.08)] ring-1 ring-white/70",
                        "dark:bg-black/45 dark:text-white dark:shadow-[0_2px_14px_rgba(0,0,0,0.55)] dark:ring-white/12"
                      )}
                      aria-hidden
                    >
                      {liveCountLabel(cat.id)}
                    </span>
                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-10 pb-2 px-1.5 sm:pt-12 sm:pb-2.5 sm:px-2"
                      aria-hidden
                    />
                    <span className="absolute inset-x-0 bottom-0 z-[1] px-1.5 pb-2 pt-5 text-center text-[10px] font-bold uppercase leading-tight tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] sm:px-2 sm:pb-2.5 sm:pt-6 sm:text-xs md:text-sm">
                      {cat.label}
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                aria-label="Scroll categories left"
                disabled={!hireCategoryScroll.canScrollLeft}
                onClick={() => scrollHireCategories("left")}
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
                disabled={!hireCategoryScroll.canScrollRight}
                onClick={() => scrollHireCategories("right")}
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
          )}

          <section className="mt-8 px-1 pb-8" aria-label="Shortcuts">
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
