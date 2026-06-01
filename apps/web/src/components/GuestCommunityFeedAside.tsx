import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";
import { cn } from "@/lib/utils";

/** Desktop left column for unsigned users on `/community/feed` — fills the nav sidebar slot. */
export function GuestCommunityFeedAside({ className }: { className?: string }) {
  const navigate = useNavigate();

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
          className="rounded-xl font-bold dark:bg-white dark:text-orange-600 dark:hover:bg-white/90"
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
    </aside>
  );
}
