import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, GalleryHorizontal, Home, MessageCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const GUEST_NAV = [
  { to: "/community/feed", labelKey: "siteNav.postFeed", icon: GalleryHorizontal, match: (path: string) => path === "/community/feed" },
  { to: "/about", labelKey: "siteNav.aboutUs", icon: Users, match: (path: string) => path === "/about" },
  { to: "/contact", labelKey: "siteNav.contact", icon: MessageCircle, match: (path: string) => path === "/contact" },
  { to: "/", labelKey: "siteNav.home", icon: Home, match: (path: string) => path === "/" },
] as const;

export const GUEST_ASIDE_COLLAPSED_WIDTH_CLASS = "w-[6.5rem] lg:w-[7rem]";
export const GUEST_ASIDE_EXPANDED_WIDTH_CLASS = "w-[13.5rem]";

const itemClass = (active: boolean, expanded: boolean) =>
  cn(
    "group rounded-2xl transition-all duration-200 hover:translate-x-1 hover:shadow-sm active:scale-[0.98]",
    expanded
      ? "flex w-full flex-row items-center gap-3 px-3 py-2.5 text-left"
      : "flex flex-col items-center gap-2 px-1.5 py-2.5 text-center",
    "text-zinc-600 hover:bg-white hover:text-zinc-950",
    "dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white",
    active && "bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white",
  );

/** Desktop left column for unsigned users on `/community/feed`. */
export function GuestCommunityFeedAside({
  className,
  expanded = false,
  showSiteNav = true,
  onFindHelp,
  onOfferHelp,
}: {
  className?: string;
  expanded?: boolean;
  showSiteNav?: boolean;
  onFindHelp?: () => void;
  onOfferHelp?: () => void;
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
          "hidden md:fixed md:bottom-0 md:left-0 md:top-[4.75rem] md:z-40 md:flex",
          widthClass,
          "flex-col overflow-y-auto px-2 pb-8 pt-3 transition-[width] duration-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          className,
        )}
      >
        <nav
          className={cn(
            "flex flex-col items-stretch gap-1 transition-all duration-200",
            showSiteNav
              ? "translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-2 h-0 overflow-hidden opacity-0",
          )}
          aria-label="Site"
          aria-hidden={!showSiteNav}
        >
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

        {onFindHelp && onOfferHelp ? (
          <div className="mt-5 flex flex-col items-center gap-3 border-t border-zinc-200/70 pt-4 dark:border-white/10">
            <button
              type="button"
              onClick={onFindHelp}
              className="inline-flex w-[88%] items-center justify-center gap-2 rounded-full bg-[#F97316] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-14px_rgba(249,115,22,0.9)] transition hover:bg-orange-600 active:scale-[0.98]"
            >
              {expanded ? <span>Find help</span> : null}
              <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" strokeWidth={2.25} aria-hidden />
            </button>
            <button
              type="button"
              onClick={onOfferHelp}
              className="text-sm font-medium text-zinc-900 underline decoration-zinc-900 decoration-[1.5px] underline-offset-[6px] transition hover:text-orange-600 hover:decoration-orange-600 dark:text-zinc-100"
            >
              {expanded ? <span>Offer help</span> : null}
            </button>
          </div>
        ) : null}

        {expanded ? (
          <section className="mx-auto mt-5 min-h-[420px] w-[90%] overflow-hidden rounded-[22px] bg-gradient-to-b from-orange-50 to-white px-3 pb-4 pt-4 text-center shadow-sm dark:from-zinc-800 dark:to-zinc-900">
            <p className="text-[18px] font-black leading-[1.05] tracking-[-0.04em] text-zinc-900 dark:text-white">
              Help is closer
              <span className="mt-1 block bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text italic text-transparent">
                in the app
              </span>
            </p>
            <p className="mt-1 text-[11px] font-medium leading-snug text-zinc-500 dark:text-zinc-400">
              Find people nearby wherever you are
            </p>
            <div className="mt-3 h-64 overflow-hidden">
              <img
                src="/images/how-it-works/phone-find-help.webp"
                alt="Tebnu mobile app"
                className="mx-auto w-[168px] object-contain object-top drop-shadow-lg"
                loading="lazy"
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled
                className="flex h-9 cursor-default items-center justify-center gap-1.5 rounded-xl bg-zinc-950 px-2 text-left text-white"
              >
                <img src="/app-store-apple.svg" alt="" className="h-5 w-5" />
                <span className="text-[10px] font-bold">iOS</span>
              </button>
              <button
                type="button"
                disabled
                className="flex h-9 cursor-default items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2 text-left text-zinc-950"
              >
                <img src="/google-play-logo.svg" alt="" className="h-5 w-5" />
                <span className="text-[10px] font-bold">Android</span>
              </button>
            </div>
          </section>
        ) : null}

      </aside>
    </>
  );
}
