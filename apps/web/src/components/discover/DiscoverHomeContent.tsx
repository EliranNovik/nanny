import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  Briefcase,
  CalendarPlus,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  Search,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DISCOVER_HOME_CATEGORIES } from "@/lib/serviceCategories";
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

  return (
    <div className="min-h-screen gradient-mesh pb-6 md:pb-8">
      <div className="app-desktop-shell pt-[calc(1.25rem+env(safe-area-inset-top,0px))] md:pt-8">
        <div className="app-desktop-centered-wide max-w-lg md:max-w-2xl">
          <header className="mb-4 px-1">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white md:text-3xl">
              {homeMode === "hire" ? "Find help" : "Get hired"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {homeMode === "hire"
                ? "Browse who’s available and post a request when you’re ready."
                : "See nearby jobs, post short availability, and respond fast."}
            </p>
          </header>

          <div
            className="mb-5 px-1"
            role="tablist"
            aria-label="What are you here for?"
          >
            <div className="flex h-12 w-full items-stretch gap-1 rounded-2xl border border-border/60 bg-muted/70 p-1 shadow-inner dark:border-border/50 dark:bg-muted/50">
              <button
                type="button"
                role="tab"
                aria-selected={homeMode === "hire"}
                onClick={() => setHomeMode("hire")}
                className={cn(
                  "min-w-0 flex-1 rounded-xl px-2 py-2 text-[11px] font-bold leading-tight transition-all duration-200 sm:text-xs",
                  homeMode === "hire"
                    ? "bg-background text-foreground shadow-sm dark:bg-zinc-600/95 dark:text-zinc-50 dark:shadow-sm"
                    : "text-muted-foreground hover:text-foreground/90"
                )}
              >
                I need a helper
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={homeMode === "work"}
                onClick={() => setHomeMode("work")}
                className={cn(
                  "min-w-0 flex-1 rounded-xl px-2 py-2 text-[11px] font-bold leading-tight transition-all duration-200 sm:text-xs",
                  homeMode === "work"
                    ? "bg-background text-foreground shadow-sm dark:bg-zinc-600/95 dark:text-zinc-50 dark:shadow-sm"
                    : "text-muted-foreground hover:text-foreground/90"
                )}
              >
                I want to help
              </button>
            </div>
          </div>

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
          <section className="mb-8 mt-6" aria-label="Service categories">
            <div className="mb-3 px-1 md:px-1">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Categories
              </span>
            </div>
            {/* Mobile: full-bleed grid with thin gutters; md+: horizontal strip with spacing */}
            <div
              className={cn(
                "-mx-4 w-[calc(100%+2rem)] sm:-mx-6 sm:w-[calc(100%+3rem)]",
                "md:mx-0 md:w-full"
              )}
            >
              <div
                className={cn(
                  "overflow-hidden max-md:rounded-xl max-md:bg-slate-200/55 max-md:p-1 dark:max-md:bg-white/12",
                  "md:rounded-none md:bg-transparent md:p-0"
                )}
              >
                <div
                  className={cn(
                    "grid grid-cols-3 max-md:gap-1",
                    "md:flex md:gap-4 md:overflow-x-auto md:px-1 md:pb-2 md:pt-1 md:[scrollbar-width:thin]"
                  )}
                >
                {DISCOVER_HOME_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => onCategoryClick(cat.id)}
                    className={cn(
                      "group relative block w-full shrink-0 overflow-hidden text-left outline-none",
                      "transition-transform active:scale-[0.98]",
                      "focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-inset",
                      "max-md:aspect-square max-md:rounded-none",
                      "md:h-[6.25rem] md:w-[6.75rem] md:rounded-2xl md:shadow-sm"
                    )}
                  >
                    <div className="relative h-full w-full">
                      <img
                        src={cat.imageSrc}
                        alt={cat.label}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-black/80 via-black/35 to-transparent"
                        aria-hidden
                      />
                      <span className="absolute inset-x-0 bottom-0 flex items-end justify-center px-1.5 pb-2.5 pt-10 text-center text-xs font-bold uppercase leading-tight tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] sm:text-sm">
                        {cat.label}
                      </span>
                    </div>
                  </button>
                ))}
                </div>
              </div>
            </div>
          </section>
          )}

          <section className="mt-8 px-1 pb-8" aria-label="Shortcuts">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Shortcuts
            </p>
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
                    <span className="text-xs font-bold leading-tight text-foreground sm:text-sm">Live jobs</span>
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
                    <span className="text-xs font-bold leading-tight text-foreground sm:text-sm">Live jobs</span>
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
                    <span className="text-xs font-bold leading-tight text-foreground sm:text-sm">Incoming requests</span>
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
