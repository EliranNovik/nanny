import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SERVICE_CATEGORIES } from "@/lib/serviceCategories";
import { buildJobsUrl } from "@/components/jobs/jobsPerspective";
import { useDiscoverShortcutsCounts } from "@/hooks/useDiscoverShortcutsCounts";

type DiscoverRole = "client" | "freelancer";

export function DiscoverHomeContent({ role }: { role: DiscoverRole }) {
  const navigate = useNavigate();
  const isClient = role === "client";

  const dashboardPath = isClient ? "/dashboard" : "/freelancer/dashboard";
  const { myPostedRequestsCount, incomingRequestsCount } = useDiscoverShortcutsCounts();
  const myPostedUrl = buildJobsUrl("client", "my_requests");
  const incomingUrl = buildJobsUrl("freelancer", "requests");

  const onCategoryClick = (id: string) => {
    navigate(`/public/posts?category=${encodeURIComponent(id)}`);
  };

  return (
    <div className="min-h-screen gradient-mesh pb-32 md:pb-24">
      <div className="app-desktop-shell pt-[calc(0.5rem+env(safe-area-inset-top,0px))] md:pt-6">
        <div className="app-desktop-centered-wide max-w-lg md:max-w-2xl">
          <header className="mb-6 px-1">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white md:text-3xl">
              Discover
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a category to see who is offering help, or use shortcuts below.
            </p>
          </header>

          <section className="mb-5 px-1" aria-label={isClient ? "Find helpers" : "Browse requests"}>
            {isClient ? (
              <button
                type="button"
                onClick={() => navigate("/client/helpers")}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl border border-border/60 bg-card/80 px-2.5 py-2 text-left shadow-sm outline-none transition-colors",
                  "hover:bg-muted/60 active:scale-[0.99]",
                  "focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400">
                  <Search className="h-3.5 w-3.5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 leading-none">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Find people
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-foreground">Find helpers</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate(buildJobsUrl("freelancer", "requests"))}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl border border-border/60 bg-card/80 px-2.5 py-2 text-left shadow-sm outline-none transition-colors",
                  "hover:bg-muted/60 active:scale-[0.99]",
                  "focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                  <Users className="h-3.5 w-3.5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 leading-none">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Open work
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-foreground">Browse requests</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            )}
          </section>

          <section className="mb-8" aria-label="Service categories">
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Categories
              </span>
              <Sparkles className="h-4 w-4 text-orange-500" aria-hidden />
            </div>
            <div className="-mx-1 grid grid-cols-3 gap-x-2 gap-y-3 px-1 md:flex md:gap-4 md:overflow-x-auto md:pb-2 md:pt-1 md:[scrollbar-width:thin]">
              {SERVICE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onCategoryClick(cat.id)}
                  className={cn(
                    "group flex w-full flex-col items-center gap-1.5 rounded-2xl bg-transparent p-0 text-center shadow-none outline-none",
                    "md:w-[6.75rem] md:shrink-0 md:gap-2",
                    "transition-transform active:scale-[0.98]",
                    "focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  )}
                >
                  <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-2xl md:aspect-auto md:h-[4.75rem]">
                    <img
                      src={cat.imageSrc}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <span className="px-0.5 text-[11px] font-bold leading-snug text-slate-800 dark:text-slate-100">
                    {cat.label}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="px-1 pb-8">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Shortcuts
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Link
                to={myPostedUrl}
                className={cn(
                  "relative flex flex-col items-center gap-1.5 rounded-2xl border border-black/10 bg-transparent px-2 py-3 text-center transition",
                  "hover:border-black/15 hover:bg-black/[0.02] active:scale-[0.99]",
                  "dark:border-white/10 dark:hover:border-white/15 dark:hover:bg-white/[0.04]"
                )}
              >
                {myPostedRequestsCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -right-0.5 -top-0.5 flex h-7 min-w-7 items-center justify-center border-[3px] border-background px-1.5 text-xs font-black leading-none shadow-sm"
                  >
                    {myPostedRequestsCount > 99 ? "99+" : myPostedRequestsCount}
                  </Badge>
                )}
                <ClipboardList className="h-6 w-6 text-orange-500" aria-hidden />
                <span className="text-[10px] font-bold leading-tight sm:text-xs">My posted requests</span>
              </Link>
              <Link
                to={incomingUrl}
                className={cn(
                  "relative flex flex-col items-center gap-1.5 rounded-2xl border border-black/10 bg-transparent px-2 py-3 text-center transition",
                  "hover:border-black/15 hover:bg-black/[0.02] active:scale-[0.99]",
                  "dark:border-white/10 dark:hover:border-white/15 dark:hover:bg-white/[0.04]"
                )}
              >
                {incomingRequestsCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -right-0.5 -top-0.5 flex h-7 min-w-7 items-center justify-center border-[3px] border-background px-1.5 text-xs font-black leading-none shadow-sm"
                  >
                    {incomingRequestsCount > 99 ? "99+" : incomingRequestsCount}
                  </Badge>
                )}
                <Bell className="h-6 w-6 text-amber-500" aria-hidden />
                <span className="text-[10px] font-bold leading-tight sm:text-xs">Incoming requests</span>
              </Link>
              <Link
                to={dashboardPath}
                className={cn(
                  "relative flex flex-col items-center gap-1.5 rounded-2xl border border-black/10 bg-transparent px-2 py-3 text-center transition",
                  "hover:border-black/15 hover:bg-black/[0.02] active:scale-[0.99]",
                  "dark:border-white/10 dark:hover:border-white/15 dark:hover:bg-white/[0.04]"
                )}
              >
                <LayoutDashboard className="h-6 w-6 text-violet-500" aria-hidden />
                <span className="text-[10px] font-bold leading-tight sm:text-xs">Dashboard</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
