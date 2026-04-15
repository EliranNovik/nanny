import { useNavigate } from "react-router-dom";
import { ChevronDown, ListFilter } from "lucide-react";
import {
  ALL_HELP_CATEGORY_ID,
  SERVICE_CATEGORIES,
  isAllHelpCategory,
  isServiceCategoryId,
} from "@/lib/serviceCategories";
import { cn } from "@/lib/utils";

function categorySelectValue(categoryParam: string | null | undefined): string {
  if (!categoryParam) return ALL_HELP_CATEGORY_ID;
  if (isAllHelpCategory(categoryParam)) return ALL_HELP_CATEGORY_ID;
  if (isServiceCategoryId(categoryParam)) return categoryParam;
  return ALL_HELP_CATEGORY_ID;
}

/**
 * Mobile: native `<select>` so the OS category picker opens (iOS/Android).
 * Options: All help (all categories), then each service type.
 */
export function CommunityPostsCategoryNativeSelect({
  basePath,
  categoryParam,
  className,
  variant = "default",
}: {
  basePath: string;
  categoryParam: string | null;
  className?: string;
  /** Compact pill for fixed app header (next to search). */
  variant?: "default" | "header";
}) {
  const navigate = useNavigate();
  const value = categorySelectValue(categoryParam);
  const isHeader = variant === "header";

  return (
    <div
      className={cn(
        isHeader ? "relative w-full min-w-0" : "relative w-full max-w-md",
        className,
      )}
    >
      <ListFilter
        className={cn(
          "pointer-events-none absolute top-1/2 z-[1] -translate-y-1/2 text-muted-foreground",
          isHeader ? "left-2 h-3 w-3" : "left-3 h-4 w-4",
        )}
        aria-hidden
      />
      <select
        aria-label="Filter by category"
        className={cn(
          "w-full cursor-pointer appearance-none border border-border bg-card font-semibold text-foreground shadow-sm",
          isHeader
            ? "h-9 rounded-full py-1 pl-8 pr-8 text-[11px] leading-tight"
            : "h-11 rounded-2xl py-2 pl-10 pr-10 text-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        )}
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          const path = `${basePath}?category=${encodeURIComponent(v)}`;
          navigate(path, { replace: true });
        }}
      >
        <option value={ALL_HELP_CATEGORY_ID}>All help</option>
        {SERVICE_CATEGORIES.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
          isHeader ? "right-2 h-3 w-3" : "right-3 h-4 w-4",
        )}
        aria-hidden
      />
    </div>
  );
}
