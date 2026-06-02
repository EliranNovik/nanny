import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";
import { cn } from "@/lib/utils";
import { TEBNU_JOIN_COMMUNITY_BUTTON_CLASS } from "@/lib/tebnuBrandButton";
import { HelpCircle } from "lucide-react";

/** Desktop left column for unsigned users on `/community/feed` — fills the nav sidebar slot. */
export function GuestCommunityFeedAside({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex w-[220px] shrink-0 flex-col self-start sticky top-0 max-h-[100dvh] overflow-y-auto",
        "border-r border-border/40 bg-background/60 px-4 pt-6 pb-8",
        className,
      )}
    >
      <Link to="/" className="mb-6 flex flex-col items-center gap-2 text-center">
        <img
          src={BRAND_LOGO_SRC}
          alt="Tebnu"
          className="h-20 w-auto"
          loading="eager"
          decoding="async"
        />
        <span className="text-base font-black tracking-tight">Tebnu</span>
      </Link>

      <p className="text-sm font-bold leading-snug text-foreground">
        Join the community
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Create a free account to find help for any need, offer yours to others,
        and connect with people nearby.
      </p>

      <div className="mt-5 flex flex-col gap-2">
        <Button
          type="button"
          onClick={() => navigate("/onboarding")}
          className={cn(
            "rounded-xl font-bold",
            TEBNU_JOIN_COMMUNITY_BUTTON_CLASS,
          )}
        >
          Register
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/login")}
          className="rounded-xl font-bold"
        >
          Sign in
        </Button>
      </div>

      <div className="mt-auto pt-6">
        <button
          type="button"
          onClick={() => setAboutOpen(true)}
          className={cn(
            "w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 px-3 py-2.5",
            "text-xs font-black text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
          aria-label="What is Tebnu?"
        >
          <HelpCircle className="h-4 w-4" aria-hidden />
          What is tebnu?
        </button>
      </div>

      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="max-w-md rounded-2xl border-0 bg-background px-6 pb-6 pt-7 shadow-2xl outline-none ring-0 focus:outline-none">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-xl font-black tracking-tight">
              What is tebnu?
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              tebnu is a community for getting help and offering help — for any
              need, big or small.
            </DialogDescription>
          </DialogHeader>

          <ul className="mt-4 space-y-2 text-sm text-foreground/90">
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              Find help near you (services, one-time tasks, ongoing support).
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              Offer your skills and connect with people who need them.
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              Share updates, reviews, and availability on the public board.
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              Message securely and build trust through community activity.
            </li>
          </ul>

          <div className="mt-6 flex flex-col gap-2">
            <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-muted/10">
              <img
                src="/ChatGPT Image Apr 19, 2026, 11_35_26 AM.png"
                alt=""
                className="h-auto w-full object-cover"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-3.5 shadow-md ring-1 ring-black/5">
                <img
                  src={BRAND_LOGO_SRC}
                  alt="Tebnu"
                  className="h-9 w-auto"
                  loading="eager"
                  decoding="async"
                />
                <span className="text-[13px] font-black tracking-tight text-slate-900">
                  Tebnu.com
                </span>
              </div>
            </div>
            <Button
              type="button"
              className={cn(
                "h-11 w-full rounded-xl text-[15px] font-black",
                TEBNU_JOIN_COMMUNITY_BUTTON_CLASS,
              )}
              onClick={() => {
                setAboutOpen(false);
                navigate("/onboarding");
              }}
            >
              Register
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl text-[15px] font-semibold"
              onClick={() => {
                setAboutOpen(false);
                navigate("/login");
              }}
            >
              Sign in
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
