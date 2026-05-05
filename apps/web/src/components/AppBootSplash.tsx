import { cn } from "@/lib/utils";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";

/** Centered logo shown while auth / session is initializing (replaces generic spinner). */
export function AppBootSplashLogo({
  className,
}: {
  className?: string;
}) {
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt=""
      decoding="async"
      className={cn(
        "w-auto max-w-[min(280px,85vw)] h-auto max-h-[40vh] object-contain motion-safe:animate-pulse",
        className,
      )}
    />
  );
}

export function AppBootSplash() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-background px-6"
      role="status"
      aria-label="Loading"
    >
      <AppBootSplashLogo />
    </div>
  );
}
