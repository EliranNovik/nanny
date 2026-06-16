import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";
import { cn } from "@/lib/utils";
import { TEBNU_JOIN_COMMUNITY_BUTTON_CLASS } from "@/lib/tebnuBrandButton";
import { HelpCircle } from "lucide-react";
import { WhatIsTebnuDialog } from "@/components/WhatIsTebnuDialog";

/** Desktop left column for unsigned users on `/community/feed` — fills the nav sidebar slot. */
export function GuestCommunityFeedAside({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex w-[220px] shrink-0 flex-col self-start sticky top-32 max-h-[calc(100dvh-8rem)] overflow-y-auto",
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

      <WhatIsTebnuDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </aside>
  );
}
