import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users,
  Menu,
  X,
  Home,
  LogIn,
  MessageCircle,
  GalleryHorizontal,
  Moon,
  Sun,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { HeaderBackChevron } from "@/components/HeaderBackChevron";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";
import { publicProfileHeaderGlassIconBtnClass } from "@/lib/discoverHomeHeaderChrome";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";

const COMMUNITY_FEED_PATH = "/community/feed";

/** Guest Global Posts chrome: full-bleed zinc bar (not the orange pill). */
export const guestSiteHeaderChromeProps = {
  hideLeftLogo: true,
  hideBackButton: true,
  hideBackButtonMobile: true,
  fullBleedTop: true,
} as const;

const navLinkClass =
  "text-sm font-bold hover:text-white/80 transition-colors";

export type LandingSiteHeaderProps = {
  /** `logo` = fixed Tebnu mark (landing). `back` = return to home (About / Contact). */
  leftCorner?: "logo" | "back";
  /** Omit fixed top-left mark (e.g. login page shows brand in the card). */
  hideLeftLogo?: boolean;
  /** Optional class override for the fixed top-left "Tebnu" text. */
  leftLogoTextClassName?: string;
  /** Hide the in-header back button (defaults to visible). */
  hideBackButton?: boolean;
  /** Omit Login / Get started when already on the sign-in screen. */
  hideLoginCta?: boolean;
  /** Hide only the Sign in control (e.g. already on `/login`). */
  hideSignInCta?: boolean;
  /** Signed-out only: show Home in the right cluster (e.g. login page). */
  homeLinkRight?: boolean;
  /** Hide Post Feed nav item (e.g. already on `/community/feed`). */
  hidePostFeedLink?: boolean;
  /** Hide About / Contact / Home in the desktop header (moved to a guest sidebar). */
  hideDesktopNavLinks?: boolean;
  /** Hide the in-header “Tebnu” wordmark. */
  hideBrand?: boolean;
  /** Replaces the desktop center nav (e.g. category filters on the guest feed). */
  centerContent?: ReactNode;
  /** In document flow — scrolls with the page instead of fixed overlay. */
  scrollWithPage?: boolean;
  /** Full-bleed bar (e.g. community feed guest header). */
  fullWidth?: boolean;
  className?: string;
  variant?: "brand" | "glassy" | "landingGlass";
  hideBackButtonMobile?: boolean;
  /** Mobile: orange pill header matching the landing page (desktop keeps other props). */
  mobileMatchLanding?: boolean;
  /** Keep the pill fixed at the top on mobile (e.g. guest community feed). */
  fixedOnMobile?: boolean;
  /**
   * Edge-to-edge bar pinned at the top (community feed). Solid zinc matching profile
   * cards, then frosted glass once the page is scrolled over content.
   */
  fullBleedTop?: boolean;
  /** Use a white bar instead of the guest-feed zinc chrome. */
  whiteHeader?: boolean;
  /** Landing hero: plain white “Register” text — no logo or filled pill. */
  simpleRegisterCta?: boolean;
  /** Hide the light/dark theme toggle. */
  hideThemeToggle?: boolean;
  /** Landing: open “What is tebnu?” instead of navigating home when brand is clicked. */
  onBrandClick?: () => void;
  /** Guest feed: desktop hamburger that expands/collapses the left sidebar. */
  desktopSidebarOpen?: boolean;
  onDesktopSidebarToggle?: () => void;
  /** Mobile: transparent bar over a full-bleed photo, with glassy icon badges. */
  overlayOnHero?: boolean;
  /** Landing: sit on the hero photo, then a frosted glass bar after scroll. */
  heroOverlay?: boolean;
  /** When set with heroOverlay, true means the hero is past and glass should show. */
  heroOverlayScrolled?: boolean;
};

const brandHeaderBgClass =
  "bg-gradient-to-r from-orange-500 to-red-600 border border-white/20";
const glassyHeaderBgClass =
  "bg-white/70 dark:bg-background border-0 shadow-md";

/** Floating orange pill header + optional fixed left logo or back control + mobile menu (matches landing). */
export function LandingSiteHeader({
  leftCorner = "logo",
  hideLeftLogo = false,
  leftLogoTextClassName,
  hideBackButton = false,
  hideLoginCta = false,
  hideSignInCta = false,
  homeLinkRight = false,
  hidePostFeedLink = false,
  hideDesktopNavLinks = false,
  hideBrand = false,
  centerContent,
  scrollWithPage = false,
  fullWidth = false,
  className,
  variant = "brand",
  hideBackButtonMobile = false,
  mobileMatchLanding = false,
  fixedOnMobile = false,
  fullBleedTop = false,
  simpleRegisterCta = false,
  hideThemeToggle = false,
  onBrandClick,
  desktopSidebarOpen = false,
  onDesktopSidebarToggle,
  overlayOnHero = false,
  heroOverlay = false,
  heroOverlayScrolled,
}: LandingSiteHeaderProps) {
  const hideMobileBack = hideBackButtonMobile || mobileMatchLanding;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDarkTheme = theme === "dark";
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuPanelRef.current?.contains(target)) return;
      if (menuButtonRef.current?.contains(target)) return;
      setIsMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!fullBleedTop && !(heroOverlay && heroOverlayScrolled === undefined)) return;
    const onScroll = () => setHeaderScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [fullBleedTop, heroOverlay, heroOverlayScrolled]);

  const overlayScrolled = heroOverlayScrolled ?? headerScrolled;
  const heroOverPhoto = heroOverlay && !overlayScrolled;

  const dashboardPath =
    profile?.role === "freelancer" ? "/freelancer/home" : "/client/home";

  const isLandingGlass = variant === "landingGlass";
  const isFeedChrome = fullBleedTop;
  const isMutedChrome = variant === "glassy" || isFeedChrome;

  const landingHeaderInkClass = "text-zinc-800 dark:text-zinc-100";

  const linkColorClass = heroOverlay
    ? cn(
        landingHeaderInkClass,
        "hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-white/10 dark:hover:text-orange-400",
        heroOverPhoto &&
          "md:text-white/90 md:hover:bg-white/20 md:hover:text-white",
      )
    : isFeedChrome
    ? "text-zinc-800 hover:bg-orange-50 hover:text-orange-600 dark:text-zinc-100 dark:hover:bg-white/10 dark:hover:text-orange-400"
    : variant === "glassy"
      ? "text-zinc-600 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
      : "text-white/90 hover:bg-white/15 hover:text-white";

  const dynamicNavLinkClass = cn(
    "rounded-full px-2.5 py-1 text-sm font-bold transition-all duration-200",
    linkColorClass,
  );

  const overlayGlassIconClass = publicProfileHeaderGlassIconBtnClass;

  const landingSolidBarClass =
    "border-0 bg-white shadow-none ring-0 backdrop-blur-none dark:bg-background";

  const headerBgClass = heroOverlay
    ? cn(
        landingSolidBarClass,
        heroOverPhoto && "md:bg-transparent md:dark:bg-transparent",
      )
    : overlayOnHero
    ? "max-md:border-0 max-md:bg-transparent max-md:shadow-none max-md:ring-0 md:border-0 md:shadow-none md:ring-0 md:bg-white dark:md:bg-background"
    : isFeedChrome
    ? cn(
        "border-0 bg-white shadow-none ring-0 dark:bg-background",
        "md:bg-white dark:md:bg-background",
        headerScrolled &&
          "md:bg-white/85 md:backdrop-blur-xl md:backdrop-saturate-150 dark:md:bg-background dark:md:backdrop-blur-none",
      )
    : cn(
        isLandingGlass
          ? "max-md:border-0 max-md:bg-white/95 max-md:shadow-none max-md:backdrop-blur-md max-md:dark:bg-background max-md:dark:backdrop-blur-none md:bg-gradient-to-r md:from-orange-500 md:to-red-600 md:border md:border-white/20 md:shadow-2xl md:backdrop-blur-none"
          : variant === "glassy"
            ? glassyHeaderBgClass
            : brandHeaderBgClass,
        mobileMatchLanding &&
          variant !== "landingGlass" &&
          "max-md:border max-md:border-white/20 max-md:bg-gradient-to-r max-md:from-orange-500 max-md:to-red-600 max-md:shadow-2xl",
      );

  const backBtnClass = isMutedChrome
    ? "border-zinc-200 bg-zinc-50/50 text-zinc-700 hover:bg-zinc-100/80 dark:border-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-300 dark:hover:bg-zinc-900/60"
    : "border-white/25 bg-white/10 text-white hover:bg-white/15";

  const menuIconClass = cn(
    heroOverlay
      ? cn(landingHeaderInkClass, heroOverPhoto && "md:text-white")
      : isFeedChrome
      ? "text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white"
      : variant === "glassy"
        ? "text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white"
        : isLandingGlass
          ? "max-md:text-slate-900 max-md:hover:text-slate-700 md:text-white md:hover:text-white/80"
          : "text-white hover:text-white/80",
    !heroOverlay &&
      !isFeedChrome &&
      mobileMatchLanding &&
      variant !== "landingGlass" &&
      "max-md:text-white max-md:hover:text-white/80",
  );

  const signInBtnClass = cn(
    heroOverlay
      ? cn(
          landingHeaderInkClass,
          "hover:bg-transparent hover:text-orange-600 dark:hover:text-orange-400",
          heroOverPhoto && "md:text-white md:hover:bg-white/10 md:hover:text-white",
        )
      : isFeedChrome
      ? "text-zinc-800 hover:bg-transparent hover:text-orange-600 dark:text-zinc-100 dark:hover:bg-transparent dark:hover:text-orange-400"
      : variant === "glassy"
        ? "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
        : isLandingGlass
          ? "max-md:text-slate-900 max-md:hover:bg-slate-100 max-md:hover:text-slate-950 md:text-white md:hover:bg-white/10"
          : "text-white hover:bg-white/10",
    !heroOverlay &&
      !isFeedChrome &&
      mobileMatchLanding &&
      variant !== "landingGlass" &&
      "max-md:text-white max-md:hover:bg-white/10",
  );

  const navContainerTextClass = heroOverlay
    ? cn(landingHeaderInkClass, heroOverPhoto && "md:text-white")
    : isMutedChrome
    ? "text-zinc-800 dark:text-zinc-200"
    : "text-white";

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  const postFeedLinkDesktop = !hidePostFeedLink ? (
    <Link to={COMMUNITY_FEED_PATH} className={dynamicNavLinkClass}>
      {t("siteNav.postFeed")}
    </Link>
  ) : null;

  const postFeedLinkMobile = !hidePostFeedLink ? (
    <Link
      to={COMMUNITY_FEED_PATH}
      className="flex items-center gap-4 text-xl font-black text-slate-900 dark:text-zinc-100"
      onClick={() => setIsMenuOpen(false)}
    >
      <GalleryHorizontal className="w-6 h-6 text-primary" /> {t("siteNav.postFeed")}
    </Link>
  ) : null;

  const mobileMenuButton = (
    <button
      ref={menuButtonRef}
      type="button"
      onClick={() => setIsMenuOpen(!isMenuOpen)}
      className={cn(
        "md:hidden shrink-0 border-0 bg-transparent shadow-none outline-none ring-0 transition-colors focus-visible:outline-none focus-visible:ring-0",
        heroOverlay
          ? cn("p-2 pe-0.5", menuIconClass)
          : overlayOnHero
            ? cn(overlayGlassIconClass, "border-0 shadow-none ring-0")
            : cn("p-2 pe-0.5", menuIconClass),
      )}
      aria-label="Toggle menu"
      aria-expanded={isMenuOpen}
    >
      {isMenuOpen ? (
        <X className="w-6 h-6" />
      ) : (
        <Menu className="w-6 h-6" />
      )}
    </button>
  );

  const landingBrandTextClass = cn(
    "hidden text-lg font-black tracking-tight md:inline md:text-xl lg:text-2xl",
    isFeedChrome ? "text-zinc-900 dark:text-white" : "text-white",
    leftLogoTextClassName,
  );

  const headerBrandMark = isFeedChrome || heroOverlay ? (
    <span className="flex items-center gap-0">
      <img
        src={BRAND_LOGO_SRC}
        alt=""
        className="h-10 w-auto sm:h-12 md:h-14 lg:h-16"
        loading="eager"
        decoding="async"
      />
      <span
        className={cn(
          "hidden -ml-1 text-lg font-black tracking-tight md:inline md:-ml-1.5 md:text-xl lg:text-2xl",
          landingHeaderInkClass,
          heroOverPhoto &&
            "md:text-white md:drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]",
        )}
      >
        tebnu
      </span>
    </span>
  ) : (
    <span className={landingBrandTextClass}>Tebnu</span>
  );

  return (
    <>
      {!hideLeftLogo && !scrollWithPage &&
        (leftCorner === "logo" ? (
          onBrandClick ? (
            <button
              type="button"
              onClick={onBrandClick}
              className="fixed top-5 left-8 z-[60] hidden md:block group/logo transition-all duration-300"
              aria-label={t("whatIsTebnu.title")}
            >
              <img
                src={BRAND_LOGO_SRC}
                alt="Tebnu"
                className="h-20 w-auto md:h-24 lg:h-28 transition-transform duration-500 group-hover/logo:scale-110 group-hover/logo:rotate-3"
              />
            </button>
          ) : (
            <Link
              to="/"
              className="fixed top-5 left-8 z-[60] hidden md:block group/logo transition-all duration-300"
              aria-label="Tebnu home"
            >
              <img
                src={BRAND_LOGO_SRC}
                alt="Tebnu"
                className="h-20 w-auto md:h-24 lg:h-28 transition-transform duration-500 group-hover/logo:scale-110 group-hover/logo:rotate-3"
              />
            </Link>
          )
        ) : (
          <Link
            to="/"
            className="fixed top-8 left-8 z-[60] hidden md:flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 text-white hover:from-orange-600 hover:to-red-700 border border-white/30 px-4 py-2.5 font-bold text-sm shadow-lg shadow-orange-900/20 transition-all active:scale-[0.98]"
          >
            <HeaderBackChevron className="opacity-95" />
            Back to home
          </Link>
        ))}

      <header
        className={cn(
          "flex items-center px-4 transition-all duration-300 md:px-8 lg:px-12",
          heroOverlay
            ? "fixed inset-x-0 top-0 z-50 min-h-[52px] w-full max-w-none rounded-none rounded-b-[1.75rem] px-2 py-1.5 pt-[max(0.4rem,env(safe-area-inset-top))] md:min-h-[64px] md:rounded-none md:px-2.5 md:py-1.5 md:pt-[max(0.45rem,env(safe-area-inset-top))] lg:px-3"
            : overlayOnHero
            ? "max-md:fixed max-md:inset-x-0 max-md:top-0 max-md:z-50 max-md:min-h-16 max-md:w-full max-md:max-w-none max-md:rounded-none max-md:px-3 max-md:py-1.5 max-md:pt-[var(--app-safe-top,env(safe-area-inset-top,0px))] md:relative md:sticky md:top-0 md:z-50 md:min-h-[64px] md:w-full md:max-w-none md:rounded-none md:px-2.5 md:py-1.5 md:pt-[max(0.45rem,env(safe-area-inset-top))] lg:px-3"
            : isFeedChrome
            ? "relative sticky top-0 z-50 min-h-[52px] w-full max-w-none rounded-none rounded-b-[1.75rem] px-2 py-1.5 pt-[max(0.4rem,env(safe-area-inset-top))] md:min-h-[64px] md:rounded-none md:px-2.5 md:py-1.5 md:pt-[max(0.45rem,env(safe-area-inset-top))] lg:px-3"
            : isLandingGlass
              ? "fixed top-0 inset-x-0 z-50 min-h-[52px] w-full max-w-none rounded-none border-0 py-2.5 md:fixed md:top-6 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[92%] md:max-w-5xl md:rounded-full md:min-h-[60px] md:py-3"
              : cn(
                  "relative min-h-[52px] py-3.5 backdrop-blur-md md:min-h-[60px] md:px-8 md:py-4",
                ),
          headerBgClass,
          !heroOverlay &&
          !isFeedChrome &&
            !isLandingGlass &&
            (scrollWithPage && (fullWidth || isLandingGlass)
              ? mobileMatchLanding
                ? "relative z-auto mb-4 max-md:mx-auto max-md:w-[92%] max-md:max-w-5xl max-md:rounded-full max-md:shadow-2xl md:community-feed-guest-header md:w-full md:max-w-none md:rounded-none md:border-x-0 md:shadow-md"
                : "community-feed-guest-header relative z-auto mb-4 w-full max-w-none rounded-none border-x-0 shadow-md"
              : scrollWithPage
                ? "relative z-auto mx-auto mb-4 w-full max-w-5xl rounded-full shadow-2xl"
                : fixedOnMobile || !mobileMatchLanding
                  ? "fixed top-4 left-1/2 z-50 w-[92%] max-w-5xl -translate-x-1/2 rounded-full shadow-2xl md:top-6"
                  : "max-md:relative max-md:z-auto max-md:mx-auto max-md:mb-4 max-md:w-[92%] max-md:max-w-5xl max-md:rounded-full max-md:shadow-2xl md:fixed md:top-6 md:left-1/2 md:-translate-x-1/2 md:z-50 md:w-[92%] md:max-w-5xl md:rounded-full md:shadow-2xl"),
          className,
        )}
      >
        <div className="relative grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 md:flex md:justify-between md:gap-3">
          <div className="flex min-w-0 items-center justify-start gap-0 sm:gap-3 md:gap-3">
            {onDesktopSidebarToggle ? (
              <button
                type="button"
                onClick={onDesktopSidebarToggle}
                className={cn(
                  "hidden h-10 w-16 shrink-0 items-center justify-center rounded-2xl transition-colors md:inline-flex",
                  menuIconClass,
                  desktopSidebarOpen && "bg-zinc-200/70 dark:bg-zinc-800",
                )}
                aria-label={desktopSidebarOpen ? "Collapse menu" : "Open menu"}
                aria-expanded={desktopSidebarOpen}
              >
                {desktopSidebarOpen ? (
                  <X className="h-7 w-7" strokeWidth={2.2} />
                ) : (
                  <Menu className="h-7 w-7" strokeWidth={2.2} />
                )}
              </button>
            ) : null}
            {mobileMenuButton}
            {!isLandingGlass && !hideBrand ? (
              onBrandClick ? (
                <button
                  type="button"
                  onClick={onBrandClick}
                  className={cn(
                    "hidden shrink-0 items-center rounded-lg transition-opacity hover:opacity-90 active:scale-[0.99] md:flex",
                    overlayOnHero && "max-md:hidden",
                  )}
                  aria-label={t("whatIsTebnu.title")}
                >
                  {headerBrandMark}
                </button>
              ) : (
                <Link
                  to="/"
                  className={cn(
                    "hidden shrink-0 items-center md:flex",
                    overlayOnHero && "max-md:hidden",
                  )}
                  aria-label="Tebnu home"
                >
                  {headerBrandMark}
                </Link>
              )
            ) : null}
            {!hideBackButton ? (
              <>
                <button
                  type="button"
                  onClick={goBack}
                  className={cn("hidden md:inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition-colors border active:scale-[0.99]", backBtnClass)}
                  aria-label="Go back"
                >
                  <HeaderBackChevron className="opacity-95" />
                  Back
                </button>
                {!hideMobileBack ? (
                  <button
                    type="button"
                    onClick={goBack}
                    className={cn("md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors border active:scale-[0.99]", backBtnClass)}
                    aria-label="Go back"
                  >
                    <HeaderBackChevron className="opacity-95" />
                  </button>
                ) : null}
              </>
            ) : null}
          </div>

          {!isLandingGlass && !hideBrand ? (
            onBrandClick ? (
              <button
                type="button"
                onClick={onBrandClick}
                className={cn(
                  "flex items-center justify-center rounded-lg transition-opacity hover:opacity-90 active:scale-[0.99] md:hidden",
                  overlayOnHero && "max-md:hidden",
                )}
                aria-label={t("whatIsTebnu.title")}
              >
                {headerBrandMark}
              </button>
            ) : (
              <Link
                to="/"
                className={cn(
                  "flex items-center justify-center md:hidden",
                  overlayOnHero && "max-md:hidden",
                )}
                aria-label="Tebnu home"
              >
                {headerBrandMark}
              </Link>
            )
          ) : (
            <span className="md:hidden" aria-hidden />
          )}
          <div
            className={cn(
              "hidden min-w-0 flex-1 items-center justify-center gap-2 md:flex md:gap-8",
              !isLandingGlass && !centerContent && user && "md:justify-start md:pl-2",
              (homeLinkRight && !user) && "md:justify-center md:pl-0",
            )}
          >
            {centerContent ? (
              <div className="pointer-events-none absolute inset-x-0 top-1/2 z-[1] hidden -translate-y-1/2 justify-center px-20 sm:px-24 md:flex md:px-36">
                <div className="pointer-events-auto min-w-0 max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {centerContent}
                </div>
              </div>
            ) : user ? (
              <div className="flex items-center gap-4 md:gap-8 min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className={cn(
                    "h-9 w-9 flex-shrink-0 border",
                    isLandingGlass
                      ? "max-md:border-slate-200 md:border-white/30"
                      : "border-white/30"
                  )}>
                    <AvatarImage src={profile?.photo_url || undefined} alt="" />
                    <AvatarFallback className={cn(
                      "text-xs font-bold",
                      isLandingGlass
                        ? "max-md:bg-slate-100 max-md:text-slate-700 md:bg-white/20 md:text-white"
                        : "bg-white/20 text-white",
                    )}>
                      {profile?.full_name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className={cn(
                    "text-sm font-bold truncate",
                    isLandingGlass ? "text-slate-900 md:text-white" : "text-white",
                  )}>
                    Hi, {profile?.full_name?.split(" ")[0] || "User"}
                  </span>
                </div>
                <div className="hidden md:flex items-center gap-6 lg:gap-8 text-white shrink-0">
                  <Link to="/about" className={navLinkClass}>
                    {t("siteNav.aboutUs")}
                  </Link>
                  <Link to="/contact" className={navLinkClass}>
                    {t("siteNav.contact")}
                  </Link>
                  {postFeedLinkDesktop}
                </div>
              </div>
            ) : hideDesktopNavLinks ? null : (
              <div className="pointer-events-none absolute inset-x-0 top-1/2 z-[1] hidden -translate-y-1/2 justify-center md:flex">
                <div className={cn("pointer-events-auto flex items-center gap-6 lg:gap-8", navContainerTextClass)}>
                <Link to="/about" className={dynamicNavLinkClass}>
                  {t("siteNav.aboutUs")}
                </Link>
                <Link to="/contact" className={dynamicNavLinkClass}>
                  {t("siteNav.contact")}
                </Link>
                {postFeedLinkDesktop}
                {!homeLinkRight ? (
                  <Link to="/" className={dynamicNavLinkClass}>
                    {t("siteNav.home")}
                  </Link>
                ) : null}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 md:gap-4">
            <LanguageSwitcher
              variant="compact"
              className="hidden md:block"
              triggerClassName={cn(
                heroOverlay
                  ? cn(
                      landingHeaderInkClass,
                      "hover:bg-black/5 hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white",
                      heroOverPhoto &&
                        "md:text-white md:hover:bg-white/15 md:hover:text-white",
                    )
                  : isFeedChrome || variant === "glassy"
                    ? "text-zinc-800 hover:bg-black/5 hover:text-zinc-950 dark:text-zinc-200 dark:hover:bg-white/10"
                    : "text-white hover:bg-white/15 hover:text-white",
              )}
            />
            {hideThemeToggle ? null : (
              <button
                type="button"
                role="switch"
                aria-checked={isDarkTheme}
                onClick={toggleTheme}
                className={cn(
                  "hidden h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors md:inline-flex",
                  heroOverlay
                    ? cn(
                        landingHeaderInkClass,
                        "hover:bg-black/5 hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white",
                        heroOverPhoto && "md:text-white md:hover:bg-white/15",
                      )
                    : overlayOnHero
                      ? cn(overlayGlassIconClass, "max-md:h-11 max-md:w-11")
                      : isFeedChrome || variant === "glassy"
                        ? "text-zinc-800 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10"
                        : "text-white hover:bg-white/15",
                )}
                aria-label={isDarkTheme ? "Switch to light mode" : "Switch to dark mode"}
                title={isDarkTheme ? "Dark mode" : "Light mode"}
              >
                {isDarkTheme ? (
                  <Sun className="h-5 w-5" strokeWidth={2.25} aria-hidden />
                ) : (
                  <Moon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
                )}
              </button>
            )}
            {homeLinkRight && !user ? (
              <>
                <Link
                  to="/"
                  className={cn("hidden md:inline-flex rounded-full px-4 py-2 text-sm font-bold transition-colors", signInBtnClass)}
                >
                  {t("siteNav.home")}
                </Link>
                <Link
                  to="/"
                  className={cn("md:hidden inline-flex px-2 py-2 text-sm font-bold", isMutedChrome ? "text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white" : "text-white hover:text-white/90")}
                >
                  {t("siteNav.home")}
                </Link>
              </>
            ) : null}
            {!hideLoginCta && !user ? (
              <>
              {heroOverlay || isFeedChrome ? (
                <div className="flex overflow-hidden rounded-full bg-orange-600 shadow-sm">
                  {hideSignInCta ? null : (
                    <>
                      <button
                        type="button"
                        onClick={() => navigate("/login")}
                        className="flex h-9 w-9 shrink-0 items-center justify-center text-white transition-colors hover:bg-orange-700 md:h-10 md:w-10"
                        aria-label={t("siteNav.signIn")}
                      >
                        <LogIn className="h-4 w-4" strokeWidth={2.4} aria-hidden />
                      </button>
                      <span className="my-2 w-px shrink-0 bg-white/35" aria-hidden />
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate("/onboarding")}
                    className="h-9 px-3 text-sm font-bold text-white transition-colors hover:bg-orange-700 md:h-10 md:px-4"
                  >
                    {t("siteNav.register")}
                  </button>
                </div>
              ) : null}
              <div className={cn("flex items-center gap-1.5 md:gap-2", (heroOverlay || isFeedChrome) && "hidden")}>
                {hideSignInCta ? null : (
                <Button
                  variant="ghost"
                  onClick={() => navigate("/login")}
                  className={cn(
                    "rounded-full px-3 text-sm font-bold md:px-5",
                    overlayOnHero && "max-md:hidden",
                    heroOverlay
                      ? cn(
                          landingHeaderInkClass,
                          "hover:bg-transparent hover:text-orange-600 dark:hover:text-orange-400",
                          heroOverPhoto &&
                            "md:text-white md:hover:bg-white/10 md:hover:text-white",
                        )
                      : isLandingGlass
                      ? "max-md:text-slate-900 max-md:hover:bg-slate-100 max-md:hover:text-slate-950 md:text-white md:hover:bg-white/10 md:hover:text-white"
                      : isFeedChrome
                        ? "text-zinc-800 hover:bg-transparent hover:text-orange-600 dark:text-zinc-100 dark:hover:bg-transparent dark:hover:text-orange-400"
                        : signInBtnClass,
                  )}
                >
                  {t("siteNav.signIn")}
                </Button>
                )}
                <Button
                  onClick={() => navigate("/onboarding")}
                  className={cn(
                    "rounded-full px-3 text-sm font-bold md:px-4",
                    overlayOnHero && "max-md:hidden",
                    heroOverlay
                      ? "bg-orange-600 text-white shadow-sm hover:bg-orange-700"
                      : simpleRegisterCta
                      ? "max-md:text-slate-900 max-md:hover:bg-slate-100 md:text-white md:hover:bg-white/10 md:hover:text-white/90"
                      : isLandingGlass
                        ? "max-md:bg-orange-600 max-md:text-white max-md:hover:bg-orange-700 md:bg-white md:text-orange-600 md:hover:bg-white/90 shadow-sm"
                        : cn(
                            "shadow-sm",
                            isMutedChrome
                              ? "bg-orange-600 text-white hover:bg-orange-700"
                              : "bg-white text-orange-600 hover:bg-white/90",
                            !isFeedChrome &&
                              mobileMatchLanding &&
                              "max-md:bg-white max-md:text-orange-600 max-md:hover:bg-white/90",
                          ),
                  )}
                >
                  {t("siteNav.register")}
                </Button>
              </div>
              </>
            ) : user ? (
              <div className={cn(
                "hidden md:flex items-center gap-6 border-l pl-6",
                isFeedChrome
                  ? "border-zinc-300/70 text-zinc-800 dark:border-white/20 dark:text-white"
                  : "border-white/20 text-white",
              )}>
                <Link
                  to={dashboardPath}
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-bold transition-colors",
                    isFeedChrome ? "hover:text-zinc-950 dark:hover:text-white/80" : "hover:text-white/80",
                  )}
                >
                  <Home className="w-4 h-4" /> Dashboard
                </Link>
              </div>
            ) : null}
            {user ? (
              <button
                type="button"
                onClick={() => navigate(dashboardPath)}
                className={cn(
                  "md:hidden p-2 transition-colors",
                  isFeedChrome
                    ? "text-zinc-800 dark:text-white"
                    : isLandingGlass
                      ? "text-slate-900 md:text-white"
                      : "text-white",
                )}
              >
                <Home className="w-6 h-6" />
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {isMenuOpen && (
        <div
          className="fixed inset-0 z-[60] md:hidden"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            aria-label={t("common.close")}
            onClick={() => setIsMenuOpen(false)}
          />
          <div
            ref={menuPanelRef}
            className="absolute inset-y-0 left-0 flex h-[100dvh] w-full flex-col overflow-y-auto bg-white px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-start shadow-2xl animate-in slide-in-from-left duration-300 dark:bg-zinc-900"
          >
            <div className="mb-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="-ms-2 inline-flex h-11 w-11 items-center justify-center border-0 bg-transparent p-0 text-slate-900 shadow-none outline-none ring-0 dark:text-zinc-100"
                aria-label={t("common.close")}
              >
                <X className="h-7 w-7" strokeWidth={2.25} />
              </button>
              <div className="flex items-center gap-2">
                <LanguageSwitcher
                  variant="compact"
                  triggerClassName="px-2 py-1 text-sm font-black text-slate-900 dark:text-zinc-100"
                />
                {hideThemeToggle ? null : <ThemeToggle />}
              </div>
            </div>
            <div className="flex flex-col items-start gap-6">
              <Link
                to="/about"
                className="flex items-center gap-4 text-xl font-black text-slate-900 dark:text-zinc-100"
                onClick={() => setIsMenuOpen(false)}
              >
                <Users className="w-6 h-6 text-primary" /> {t("siteNav.aboutUs")}
              </Link>
              <Link
                to="/contact"
                className="flex items-center gap-4 text-xl font-black text-slate-900 dark:text-zinc-100"
                onClick={() => setIsMenuOpen(false)}
              >
                <MessageCircle className="w-6 h-6 text-primary" /> {t("siteNav.contact")}
              </Link>
              {postFeedLinkMobile}
              <Link
                to="/"
                className="flex items-center gap-4 text-xl font-black text-slate-900 dark:text-zinc-100"
                onClick={() => setIsMenuOpen(false)}
              >
                <Home className="w-6 h-6 text-primary" /> {t("siteNav.home")}
              </Link>
              {(user || !hideLoginCta) && (
                <>
                  <div className="my-2 h-px bg-slate-100 dark:bg-zinc-800" />
                  {user ? (
                    <Button
                      onClick={() => {
                        setIsMenuOpen(false);
                        navigate(dashboardPath);
                      }}
                      className="w-full h-14 rounded-2xl bg-primary text-white font-bold text-lg"
                    >
                      Dashboard
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant={simpleRegisterCta ? "ghost" : "default"}
                        onClick={() => {
                          setIsMenuOpen(false);
                          navigate("/onboarding");
                        }}
                        className={cn(
                          "w-full h-14 rounded-2xl font-bold text-lg",
                          simpleRegisterCta
                            ? "bg-transparent text-slate-900 hover:bg-slate-50"
                            : "bg-primary text-white",
                        )}
                      >
                        {t("siteNav.register")}
                      </Button>
                      {hideSignInCta ? null : (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsMenuOpen(false);
                          navigate("/login");
                        }}
                        className="h-14 w-full rounded-2xl text-lg font-bold dark:border-0 dark:shadow-none dark:ring-0"
                      >
                        {t("siteNav.signIn")}
                      </Button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsMenuOpen(false)}
              className="mt-8 w-full py-4 font-bold text-slate-400 dark:text-zinc-500"
            >
              {t("common.close")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
