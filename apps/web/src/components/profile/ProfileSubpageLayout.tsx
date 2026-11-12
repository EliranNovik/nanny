import { cn } from "@/lib/utils";
import { useTabletViewport } from "@/hooks/useIsTabletViewport";

interface ProfileSubpageLayoutProps {
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}

/** Page title block; back navigation is provided by BottomNav on profile hub/sub-routes. */
export function ProfileSubpageLayout({
  title,
  description,
  className,
  children,
}: ProfileSubpageLayoutProps) {
  const { isTablet } = useTabletViewport();

  return (
    <div
      className={cn(
        "bg-white pb-6 dark:bg-background md:pb-8",
        isTablet ? "min-h-full" : "min-h-screen",
        className,
      )}
    >
      <div className={cn(isTablet ? "px-8 pt-10" : "app-desktop-shell pt-10 md:pt-12")}>
        <div className={isTablet ? "mx-auto w-full max-w-3xl" : "app-desktop-centered-wide"}>
          <div className="mb-8">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {description}
              </p>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
