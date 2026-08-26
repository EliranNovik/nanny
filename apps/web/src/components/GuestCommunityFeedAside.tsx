import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home, MessageCircle, Scale, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  COMMUNITY_FEED_POST_TYPE_TABS,
  type CommunityFeedPostTypeFilter,
} from "@/components/community/CommunityFeedHeader";

const LEGAL_PATHS = ["/terms", "/disclaimer", "/privacy", "/cookies"];

const GUEST_NAV = [
  { to: "/about", labelKey: "siteNav.aboutUs", icon: Users, match: (path: string) => path === "/about" },
  { to: "/contact", labelKey: "siteNav.contact", icon: MessageCircle, match: (path: string) => path === "/contact" },
  { to: "/", labelKey: "siteNav.home", icon: Home, match: (path: string) => path === "/" },
  {
    to: "/terms",
    labelKey: "siteNav.legalHub",
    icon: Scale,
    match: (path: string) => LEGAL_PATHS.includes(path),
  },
] as const;

export const GUEST_ASIDE_COLLAPSED_WIDTH_CLASS = "w-[6.5rem] lg:w-[7rem]";
export const GUEST_ASIDE_EXPANDED_WIDTH_CLASS = "w-[15.5rem]";

const itemClass = (active: boolean, expanded: boolean) =>
  cn(
    "group rounded-2xl transition-colors",
    expanded
      ? "flex w-full flex-row items-center gap-3 px-3 py-2.5 text-left"
      : "flex flex-col items-center gap-2 px-1.5 py-2.5 text-center",
    "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950",
    "dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white",
    active && "bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-white",
  );

/** Desktop left column for unsigned users on `/community/feed`. */
export function GuestCommunityFeedAside({
  className,
  expanded = false,
  postTypeFilter,
  onPostTypeFilterChange,
}: {
  className?: string;
  expanded?: boolean;
  postTypeFilter?: CommunityFeedPostTypeFilter;
  onPostTypeFilterChange?: (filter: CommunityFeedPostTypeFilter) => void;
}) {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const widthClass = expanded
    ? GUEST_ASIDE_EXPANDED_WIDTH_CLASS
    : GUEST_ASIDE_COLLAPSED_WIDTH_CLASS;

  return (
    <>
      <div className={cn("hidden shrink-0 md:block", widthClass)} aria-hidden />
      <aside
        className={cn(
          "hidden md:fixed md:left-0 md:top-[4.75rem] md:z-40 md:flex",
          widthClass,
          "flex-col px-2 pb-8 pt-3 transition-[width] duration-200",
          className,
        )}
      >
        <nav className="flex flex-col items-stretch gap-1" aria-label="Site">
          {GUEST_NAV.map(({ to, labelKey, icon: Icon, match }) => {
            const active = match(pathname);
            const label = t(labelKey);
            return (
              <Link
                key={to}
                to={to}
                title={label}
                className={itemClass(active, expanded)}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-6 w-6 shrink-0" strokeWidth={2.2} aria-hidden />
                <span
                  className={cn(
                    "leading-tight tracking-tight",
                    expanded ? "text-sm font-bold" : "text-[10px] font-semibold",
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        {postTypeFilter && onPostTypeFilterChange ? (
          <nav
            className="mt-4 flex flex-col items-stretch gap-1 border-t border-zinc-200/70 pt-4 dark:border-white/10"
            aria-label={t("feed.filters.filterPostsByType")}
          >
            {COMMUNITY_FEED_POST_TYPE_TABS.map(({ id, labelKey, Icon }) => {
              const active = id === postTypeFilter;
              const label = t(labelKey);
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  title={label}
                  aria-selected={active}
                  onClick={() => onPostTypeFilterChange(id)}
                  className={itemClass(active, expanded)}
                >
                  <Icon className="h-6 w-6 shrink-0" strokeWidth={2.2} aria-hidden />
                  <span
                    className={cn(
                      "leading-tight tracking-tight",
                      expanded ? "text-sm font-bold" : "text-[10px] font-semibold",
                    )}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </nav>
        ) : null}
      </aside>
    </>
  );
}
