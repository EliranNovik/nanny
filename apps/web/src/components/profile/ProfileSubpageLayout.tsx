interface ProfileSubpageLayoutProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

/** Page title block; back navigation is provided by BottomNav on profile hub/sub-routes. */
export function ProfileSubpageLayout({ title, description, children }: ProfileSubpageLayoutProps) {
  return (
    <div className="min-h-screen gradient-mesh pb-64 md:pb-32">
      <div className="app-desktop-shell pt-10 md:pt-12">
        <div className="app-desktop-centered-wide">
          <div className="mb-8">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
            {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
