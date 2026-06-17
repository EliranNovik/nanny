import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users,
  Menu,
  X,
  Home,
  MessageCircle,
  GalleryHorizontal,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { HeaderBackChevron } from "@/components/HeaderBackChevron";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";

const COMMUNITY_FEED_PATH = "/community/feed";

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
  /** Signed-out only: show Home in the right cluster (e.g. login page). */
  homeLinkRight?: boolean;
  /** Hide Post Feed nav item (e.g. already on `/community/feed`). */
  hidePostFeedLink?: boolean;
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
  /** Landing hero: plain white “Register” text — no logo or filled pill. */
  simpleRegisterCta?: boolean;
  /** Landing: open “What is tebnu?” instead of navigating home when brand is clicked. */
  onBrandClick?: () => void;
};

const brandHeaderBgClass =
  "bg-gradient-to-r from-orange-500 to-red-600 border border-white/20";
const glassyHeaderBgClass =
  "bg-white/70 dark:bg-zinc-800/40 border-0 shadow-md";
const landingScrolledBrandHeaderBgClass =
  "border-0 bg-gradient-to-r from-orange-500 to-red-600 shadow-none";

/** Floating orange pill header + optional fixed left logo or back control + mobile menu (matches landing). */
export function LandingSiteHeader({
  leftCorner = "logo",
  hideLeftLogo = false,
  leftLogoTextClassName,
  hideBackButton = false,
  hideLoginCta = false,
  homeLinkRight = false,
  hidePostFeedLink = false,
  scrollWithPage = false,
  fullWidth = false,
  className,
  variant = "brand",
  hideBackButtonMobile = false,
  mobileMatchLanding = false,
  fixedOnMobile = false,
  simpleRegisterCta = false,
  onBrandClick,
}: LandingSiteHeaderProps) {
  const hideMobileBack = hideBackButtonMobile || mobileMatchLanding;
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const dashboardPath =
    profile?.role === "freelancer" ? "/freelancer/home" : "/client/home";

  const isLandingGlass = variant === "landingGlass";

  const linkColorClass =
    variant === "glassy"
      ? "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
      : "text-white/90 hover:text-white";

  const dynamicNavLinkClass = cn(
    "text-sm font-bold transition-colors",
    linkColorClass
  );

  const headerBgClass = cn(
    isLandingGlass
      ? landingScrolledBrandHeaderBgClass
      : variant === "glassy"
        ? glassyHeaderBgClass
        : brandHeaderBgClass,
    mobileMatchLanding &&
      variant !== "landingGlass" &&
      "max-md:border max-md:border-white/20 max-md:bg-gradient-to-r max-md:from-orange-500 max-md:to-red-600 max-md:shadow-2xl",
  );

  const backBtnClass = variant === "glassy"
    ? "border-zinc-200 bg-zinc-50/50 text-zinc-700 hover:bg-zinc-100/80 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300 dark:hover:bg-zinc-900/60"
    : "border-white/25 bg-white/10 text-white hover:bg-white/15";

  const menuIconClass = cn(
    variant === "glassy"
      ? "text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white"
      : "text-white hover:text-white/80",
    mobileMatchLanding &&
      variant !== "landingGlass" &&
      "max-md:text-white max-md:hover:text-white/80",
  );

  const signInBtnClass = cn(
    variant === "glassy"
      ? "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
      : "text-white hover:bg-white/10",
    mobileMatchLanding &&
      variant !== "landingGlass" &&
      "max-md:text-white max-md:hover:bg-white/10",
  );

  const navContainerTextClass =
    variant === "glassy"
      ? "text-zinc-800 dark:text-zinc-200"
      : "text-white";

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  const postFeedLinkDesktop = !hidePostFeedLink ? (
    <Link to={COMMUNITY_FEED_PATH} className={dynamicNavLinkClass}>
      Post Feed
    </Link>
  ) : null;

  const postFeedLinkMobile = !hidePostFeedLink ? (
    <Link
      to={COMMUNITY_FEED_PATH}
      className="text-xl font-black text-slate-900 flex items-center gap-4"
      onClick={() => setIsMenuOpen(false)}
    >
      <GalleryHorizontal className="w-6 h-6 text-primary" /> Post Feed
    </Link>
  ) : null;

  const mobileMenuButton = (
    <button
      type="button"
      onClick={() => setIsMenuOpen(!isMenuOpen)}
      className={cn("md:hidden p-2 transition-colors shrink-0", menuIconClass)}
      aria-label="Toggle menu"
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
    "text-white",
  );

  return (
    <>
      {!hideLeftLogo && !scrollWithPage &&
        (leftCorner === "logo" ? (
          <Link
            to="/"
            className="fixed top-8 left-8 z-[60] hidden md:flex items-center gap-2 group/logo transition-all duration-300"
          >
            <img
              src={BRAND_LOGO_SRC}
              alt="Tebnu"
              className="h-20 w-auto md:h-24 lg:h-28 transition-transform duration-500 group-hover/logo:scale-110 group-hover/logo:rotate-3"
            />
            <span
              className={cn(
                "text-xl font-black text-white drop-shadow-md tracking-tighter hidden lg:block",
                leftLogoTextClassName,
              )}
            >
              Tebnu
            </span>
          </Link>
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
          "flex items-center px-4 transition-all duration-500 md:px-8 lg:px-12",
          isLandingGlass
            ? "fixed top-0 inset-x-0 z-50 min-h-[52px] w-full max-w-none rounded-none border-0 py-2.5 md:min-h-[60px] md:py-3"
            : cn(
                "relative min-h-[52px] py-3.5 backdrop-blur-md md:min-h-[60px] md:px-8 md:py-4",
              ),
          headerBgClass,
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
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3 md:gap-4">
            {isLandingGlass ? mobileMenuButton : null}
            {isLandingGlass ? (
              onBrandClick ? (
                <button
                  type="button"
                  onClick={onBrandClick}
                  className="flex shrink-0 items-center gap-2.5 rounded-lg transition-opacity hover:opacity-90 active:scale-[0.99] md:gap-3"
                  aria-label="What is Tebnu?"
                >
                  <img
                    src={BRAND_LOGO_SRC}
                    alt="Tebnu"
                    className="h-9 w-auto md:h-11 lg:h-12"
                    loading="eager"
                    decoding="async"
                  />
                  <span className={landingBrandTextClass}>Tebnu</span>
                </button>
              ) : (
                <Link
                  to="/"
                  className="flex shrink-0 items-center gap-2.5 md:gap-3"
                  aria-label="Tebnu home"
                >
                  <img
                    src={BRAND_LOGO_SRC}
                    alt="Tebnu"
                    className="h-9 w-auto md:h-11 lg:h-12"
                    loading="eager"
                    decoding="async"
                  />
                  <span className={landingBrandTextClass}>Tebnu</span>
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
            {!isLandingGlass ? mobileMenuButton : null}
          </div>

          <div
            className={cn(
              "flex min-w-0 flex-1 items-center justify-center gap-2 md:gap-8",
              !isLandingGlass && "md:justify-start md:pl-2",
              homeLinkRight && !user && "md:justify-center md:pl-0",
            )}
          >
            {user ? (
              <div className="flex items-center gap-4 md:gap-8 min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-9 w-9 border border-white/30 flex-shrink-0">
                    <AvatarImage src={profile?.photo_url || undefined} alt="" />
                    <AvatarFallback className="bg-white/20 text-white text-xs font-bold">
                      {profile?.full_name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-bold text-white truncate">
                    Hi, {profile?.full_name?.split(" ")[0] || "User"}
                  </span>
                </div>
                <div className="hidden md:flex items-center gap-6 lg:gap-8 text-white shrink-0">
                  <Link to="/about" className={navLinkClass}>
                    About Us
                  </Link>
                  <Link to="/contact" className={navLinkClass}>
                    Contact
                  </Link>
                  {postFeedLinkDesktop}
                </div>
              </div>
            ) : (
              <div className={cn("hidden md:flex items-center gap-6 lg:gap-8", navContainerTextClass)}>
                <Link to="/about" className={dynamicNavLinkClass}>
                  About Us
                </Link>
                <Link to="/contact" className={dynamicNavLinkClass}>
                  Contact
                </Link>
                {postFeedLinkDesktop}
                {!homeLinkRight ? (
                  <Link to="/" className={dynamicNavLinkClass}>
                    Home
                  </Link>
                ) : null}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {homeLinkRight && !user ? (
              <>
                <Link
                  to="/"
                  className={cn("hidden md:inline-flex rounded-full px-4 py-2 text-sm font-bold transition-colors", signInBtnClass)}
                >
                  Home
                </Link>
                <Link
                  to="/"
                  className={cn("md:hidden inline-flex px-2 py-2 text-sm font-bold", variant === "glassy" ? "text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white" : "text-white hover:text-white/90")}
                >
                  Home
                </Link>
              </>
            ) : null}
            {!hideLoginCta && !user ? (
              <div className="flex items-center gap-1.5 md:gap-2">
                <Button
                  variant="ghost"
                  onClick={() => navigate("/login")}
                  className={cn(
                    "rounded-full px-3 text-sm font-bold md:px-5",
                    isLandingGlass
                      ? "text-white hover:bg-white/10 hover:text-white"
                      : signInBtnClass,
                  )}
                >
                  Sign in
                </Button>
                <Button
                  onClick={() => navigate("/onboarding")}
                  className={cn(
                    "rounded-full px-3 text-sm font-bold md:px-4",
                    simpleRegisterCta
                      ? "text-white shadow-none hover:bg-white/10 hover:text-white/90"
                      : isLandingGlass
                        ? "bg-white text-orange-600 hover:bg-white/90 shadow-sm"
                        : cn(
                            "shadow-sm",
                            variant === "glassy"
                              ? "bg-orange-600 text-white hover:bg-orange-700"
                              : "bg-white text-orange-600 hover:bg-white/90",
                            mobileMatchLanding &&
                              "max-md:bg-white max-md:text-orange-600 max-md:hover:bg-white/90",
                          ),
                  )}
                >
                  Register
                </Button>
              </div>
            ) : user ? (
              <div className="hidden md:flex items-center gap-6 text-white border-l border-white/20 pl-6">
                <Link
                  to={dashboardPath}
                  className="flex items-center gap-1.5 text-sm font-bold hover:text-white/80 transition-colors"
                >
                  <Home className="w-4 h-4" /> Dashboard
                </Link>
              </div>
            ) : null}
            {user ? (
              <button
                type="button"
                onClick={() => navigate(dashboardPath)}
                className="md:hidden p-2 text-white"
              >
                <Home className="w-6 h-6" />
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {isMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[92%] bg-white/95 backdrop-blur-xl rounded-[2rem] p-8 shadow-2xl border border-white/40">
            <div className="flex flex-col gap-6">
              <Link
                to="/about"
                className="text-xl font-black text-slate-900 flex items-center gap-4"
                onClick={() => setIsMenuOpen(false)}
              >
                <Users className="w-6 h-6 text-primary" /> About Us
              </Link>
              <Link
                to="/contact"
                className="text-xl font-black text-slate-900 flex items-center gap-4"
                onClick={() => setIsMenuOpen(false)}
              >
                <MessageCircle className="w-6 h-6 text-primary" /> Contact
              </Link>
              {postFeedLinkMobile}
              <Link
                to="/"
                className="text-xl font-black text-slate-900 flex items-center gap-4"
                onClick={() => setIsMenuOpen(false)}
              >
                <Home className="w-6 h-6 text-primary" /> Home
              </Link>
              {(user || !hideLoginCta) && (
                <>
                  <div className="h-[1px] bg-slate-100 my-2" />
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
                        Register
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsMenuOpen(false);
                          navigate("/login");
                        }}
                        className="w-full h-14 rounded-2xl font-bold text-lg"
                      >
                        Sign in
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsMenuOpen(false)}
              className="mt-8 w-full py-4 text-slate-400 font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
