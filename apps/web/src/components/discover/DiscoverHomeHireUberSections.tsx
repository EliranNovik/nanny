import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ClipboardList,
  Heart,
  MessageCircle,
  Radio,
} from "lucide-react";
import {
  ALL_HELP_CATEGORY_ID,
  DISCOVER_HOME_CATEGORIES,
  SERVICE_CATEGORIES,
} from "@/lib/serviceCategories";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { DISCOVER_PRIMARY_HERO_IMAGES } from "@/components/discover/discoverHomeHeroImages";
import {
  DISCOVER_STROKE,
  discoverIcon,
} from "@/components/discover/discoverHomeIcons";
import { buildJobsUrl } from "@/components/jobs/jobsPerspective";
import { HIRE_CATEGORY_TILE_UI } from "@/lib/discoverCategoryTileIcons";

const TILE =
  "rounded-[14px] bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)] ring-1 ring-black/[0.06] transition-transform active:scale-[0.98] dark:bg-zinc-900/90 dark:ring-white/10";

type Props = {
  explorePath: string;
  createRequestPath: string;
};

/**
 * “I need help” only — category grid + Uber-style shortcuts below the main hero.
 */
export function DiscoverHomeHireUberSections({
  explorePath,
  createRequestPath,
}: Props) {
  const jobsMyRequests = buildJobsUrl("client", "my_requests");
  const exploreThumb =
    DISCOVER_HOME_CATEGORIES.find((c) => c.id === ALL_HELP_CATEGORY_ID)
      ?.imageSrc ?? DISCOVER_PRIMARY_HERO_IMAGES.work;

  return (
    <div className="mt-8 space-y-10 pb-2">
      {/* 1. Category tiles — icon-led panels (no photos) */}
      <section aria-labelledby="discover-hire-categories-heading">
        <h2
          id="discover-hire-categories-heading"
          className="px-0.5 text-xl font-bold tracking-tight text-foreground"
        >
          What do you need?
        </h2>
        <p className="mt-1 px-0.5 text-sm text-muted-foreground">
          Tap a category to start your request
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-3.5">
          {SERVICE_CATEGORIES.map((cat) => {
            const ui = HIRE_CATEGORY_TILE_UI[cat.id];
            const Icon = ui.Icon;
            return (
              <Link
                key={cat.id}
                to={`${createRequestPath}?service=${encodeURIComponent(cat.id)}`}
                onClick={() =>
                  trackEvent("discover_hire_category_tile", {
                    category: cat.id,
                  })
                }
                className="group block outline-none focus-visible:ring-2 focus-visible:ring-[#7B61FF]/45 focus-visible:ring-offset-2"
              >
                <div
                  className={cn(
                    "relative flex aspect-[5/4] items-center justify-center overflow-hidden rounded-[14px] shadow-[0_1px_0_rgba(0,0,0,0.06)] ring-2 transition-transform duration-300 group-hover:scale-[1.02] active:scale-[0.98] dark:shadow-none",
                    ui.tileClass,
                  )}
                >
                  <Icon
                    className={cn(
                      "h-12 w-12 shrink-0 sm:h-14 sm:w-14",
                      ui.iconClass,
                    )}
                    strokeWidth={DISCOVER_STROKE}
                    aria-hidden
                  />
                </div>
                <p className="mt-2 text-center text-[13px] font-bold leading-tight text-foreground sm:text-sm">
                  {cat.label}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 2. Uber-style: two wide actions + four compact shortcuts */}
      <section aria-labelledby="discover-hire-more-heading">
        <h2
          id="discover-hire-more-heading"
          className="px-0.5 text-xl font-bold tracking-tight text-foreground"
        >
          More ways to get help
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link
            to={createRequestPath}
            onClick={() => trackEvent("discover_hire_wide_new_request", {})}
            className={cn(
              TILE,
              "relative flex min-h-[5.5rem] flex-col justify-end overflow-hidden p-3 pt-10 sm:min-h-[6rem] sm:p-4",
            )}
          >
            <img
              src={DISCOVER_PRIMARY_HERO_IMAGES.hire}
              alt=""
              className="pointer-events-none absolute right-1 top-1 h-[4.5rem] w-[4.5rem] rounded-lg object-cover object-center opacity-95 sm:h-[5.25rem] sm:w-[5.25rem]"
            />
            <span className="relative z-[1] max-w-[70%] text-left text-[15px] font-bold leading-snug text-foreground sm:text-base">
              New request
            </span>
          </Link>
          <Link
            to={explorePath}
            onClick={() => trackEvent("discover_hire_wide_explore", {})}
            className={cn(
              TILE,
              "relative flex min-h-[5.5rem] flex-col justify-end overflow-hidden p-3 pt-10 sm:min-h-[6rem] sm:p-4",
            )}
          >
            <img
              src={exploreThumb}
              alt=""
              className="pointer-events-none absolute right-1 top-1 h-[4.5rem] w-[4.5rem] rounded-lg object-cover object-center opacity-95 sm:h-[5.25rem] sm:w-[5.25rem]"
            />
            <span className="relative z-[1] max-w-[70%] text-left text-[15px] font-bold leading-snug text-foreground sm:text-base">
              Explore
            </span>
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          <ShortcutTile
            to="/liked"
            label="Liked"
            icon={
              <Heart
                className={discoverIcon.md}
                strokeWidth={DISCOVER_STROKE}
              />
            }
            event="discover_hire_shortcut_liked"
          />
          <ShortcutTile
            to={jobsMyRequests}
            label="My jobs"
            icon={
              <ClipboardList
                className={discoverIcon.md}
                strokeWidth={DISCOVER_STROKE}
              />
            }
            event="discover_hire_shortcut_jobs"
          />
          <ShortcutTile
            to={explorePath}
            label="Hires"
            icon={
              <Radio
                className={discoverIcon.md}
                strokeWidth={DISCOVER_STROKE}
              />
            }
            event="discover_hire_shortcut_hires"
          />
          <ShortcutTile
            to="/messages"
            label="Chat"
            icon={
              <MessageCircle
                className={discoverIcon.md}
                strokeWidth={DISCOVER_STROKE}
              />
            }
            event="discover_hire_shortcut_messages"
          />
        </div>
      </section>
    </div>
  );
}

function ShortcutTile({
  to,
  label,
  icon,
  event,
}: {
  to: string;
  label: string;
  icon: ReactNode;
  event: string;
}) {
  return (
    <Link
      to={to}
      onClick={() => trackEvent(event, {})}
      className={cn(
        TILE,
        "flex flex-col items-center gap-1.5 py-3",
        "outline-none focus-visible:ring-2 focus-visible:ring-[#7B61FF]/40 focus-visible:ring-offset-2",
      )}
    >
      <span className="text-[#7B61FF] dark:text-violet-300">{icon}</span>
      <span className="max-w-full truncate px-0.5 text-center text-[10px] font-bold leading-tight text-foreground">
        {label}
      </span>
    </Link>
  );
}
