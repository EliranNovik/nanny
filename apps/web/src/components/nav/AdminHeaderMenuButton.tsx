import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDesktopSidePanel } from "@/context/DesktopSidePanelContext";

export function AdminHeaderMenuButton({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
  const { adminMenuOpen, setAdminMenuOpen } = useDesktopSidePanel();
  return (
    <button
      type="button"
      onClick={() => setAdminMenuOpen(!adminMenuOpen)}
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        className,
      )}
      aria-label={adminMenuOpen ? "Close menu" : "Open menu"}
      aria-expanded={adminMenuOpen}
    >
      <Menu className={cn("h-6 w-6", iconClassName)} strokeWidth={2} aria-hidden />
    </button>
  );
}
