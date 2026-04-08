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
}: {
  basePath: string;
  categoryParam: string | null;
  className?: string;
}) {
  const navigate = useNavigate();
  const value = categorySelectValue(categoryParam);

  return (
    <div className={cn("relative w-full max-w-md", className)}>
      <ListFilter
        className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <select
        aria-label="Filter by category"
        className={cn(
          "h-11 w-full cursor-pointer appearance-none rounded-2xl border border-border bg-card py-2 pl-10 pr-10 text-sm font-semibold text-foreground shadow-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}
