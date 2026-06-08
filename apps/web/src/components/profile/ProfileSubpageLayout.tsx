import { cn } from "@/lib/utils";

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
  return (
    <div
      className={cn(
        "min-h-screen bg-slate-50/50 pb-6 dark:bg-background md:pb-8",
        className,
      )}
    >
      <div className="app-desktop-shell pt-10 md:pt-12">
        <div className="app-desktop-centered-wide">
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
