import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LogIn,
  Users,
  Menu,
  X,
  Home,
  MessageCircle,
  ChevronLeft,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";

export type LandingSiteHeaderProps = {
  /** `logo` = fixed Tebnu mark (landing). `back` = return to home (About / Contact). */
  leftCorner?: "logo" | "back";
  /** Omit fixed top-left mark (e.g. login page shows brand in the card). */
  hideLeftLogo?: boolean;
  /** Omit Login / Get started when already on the sign-in screen. */
  hideLoginCta?: boolean;
  /** Signed-out only: show Home in the right cluster (e.g. login page). */
  homeLinkRight?: boolean;
};

/** Floating orange pill header + optional fixed left logo or back control + mobile menu (matches landing). */
export function LandingSiteHeader({
  leftCorner = "logo",
  hideLeftLogo = false,
  hideLoginCta = false,
  homeLinkRight = false,
}: LandingSiteHeaderProps) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const dashboardPath =
    profile?.role === "freelancer" ? "/freelancer/home" : "/client/home";

  return (
    <>
      {!hideLeftLogo &&
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
            <span className="text-xl font-black text-white drop-shadow-md tracking-tighter hidden lg:block opacity-0 group-hover/logo:opacity-100 transition-opacity duration-300">
              Tebnu
            </span>
          </Link>
        ) : (
          <Link
            to="/"
            className="fixed top-8 left-8 z-[60] hidden md:flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 text-white hover:from-orange-600 hover:to-red-700 border border-white/30 px-4 py-2.5 font-bold text-sm shadow-lg shadow-orange-900/20 transition-all active:scale-[0.98]"
          >
            <ChevronLeft className="h-5 w-5 shrink-0 opacity-95" aria-hidden />
            Back to home
          </Link>
        ))}

      <header className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-5xl min-h-[52px] md:min-h-[60px] bg-gradient-to-r from-orange-500 to-red-600 backdrop-blur-md rounded-full border border-white/20 shadow-2xl flex items-center px-4 md:px-8 py-3.5 md:py-4 transition-all duration-500">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-1 sm:gap-2 md:gap-6">
            {leftCorner === "back" && (
              <Link
                to="/"
                className="md:hidden inline-flex items-center gap-0.5 py-2 pl-1 pr-1 text-sm font-bold text-white hover:text-white/90 active:text-white/80 transition-colors -mr-1"
              >
                <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
                Back
              </Link>
            )}
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-white hover:text-white/80 transition-colors shrink-0"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>

          <div
            className={cn(
              "flex items-center gap-2 md:gap-8 min-w-0 flex-1 justify-center md:justify-start md:pl-2",
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
                <div className="hidden md:flex items-center gap-8 text-white shrink-0">
                  <Link
                    to="/about"
                    className="text-sm font-bold hover:text-white/80 transition-colors"
                  >
                    About Us
                  </Link>
                  <Link
                    to="/contact"
                    className="text-sm font-bold hover:text-white/80 transition-colors"
                  >
                    Contact
                  </Link>
                </div>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-8 text-white">
                <Link
                  to="/about"
                  className="text-sm font-bold hover:text-white/80 transition-colors"
                >
                  About Us
                </Link>
                <Link
                  to="/contact"
                  className="text-sm font-bold hover:text-white/80 transition-colors"
                >
                  Contact
                </Link>
                {!homeLinkRight ? (
                  <Link
                    to="/"
                    className="flex items-center gap-1.5 text-sm font-bold hover:text-white/80 transition-colors"
                  >
                    <Home className="w-4 h-4" /> Home
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
                  className="hidden md:inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-white/10"
                >
                  <Home className="h-4 w-4 shrink-0" aria-hidden />
                  Home
                </Link>
                <Link
                  to="/"
                  className="md:hidden inline-flex p-2 text-white hover:text-white/90"
                  aria-label="Home"
                >
                  <Home className="h-6 w-6" />
                </Link>
              </>
            ) : null}
            {!hideLoginCta && !user ? (
              <Button
                variant="ghost"
                onClick={() => navigate("/login")}
                className="text-white hover:bg-white/10 font-bold hidden md:flex rounded-full px-6"
              >
                Login
              </Button>
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
            {!hideLoginCta && !user ? (
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="md:hidden p-2 text-white"
              >
                <LogIn className="w-6 h-6" />
              </button>
            ) : user ? (
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
                    <Button
                      onClick={() => {
                        setIsMenuOpen(false);
                        navigate("/login");
                      }}
                      className="w-full h-14 rounded-2xl bg-primary text-white font-bold text-lg"
                    >
                      Get Started
                    </Button>
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
