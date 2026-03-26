import type { LucideIcon } from "lucide-react";
import { Sparkles, ChefHat, Truck, Baby, Wrench, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const SERVICE_TYPES: { id: string; label: string; Icon: LucideIcon }[] = [
  { id: "cleaning", label: "Cleaning", Icon: Sparkles },
  { id: "cooking", label: "Cooking", Icon: ChefHat },
  { id: "pickup_delivery", label: "Pick up & delivery", Icon: Truck },
  { id: "nanny", label: "Nanny", Icon: Baby },
  { id: "other_help", label: "Other help", Icon: Wrench },
];

export function serviceLabelsForIds(ids: string[]): string {
  const labels = SERVICE_TYPES.filter((t) => ids.includes(t.id)).map((t) => t.label);
  return labels.length ? labels.join(" · ") : "—";
}

interface ServiceCategoriesPickerProps {
  selectedCategories: string[];
  onChange: (categories: string[]) => void;
  disabled?: boolean;
}

export function ServiceCategoriesPicker({
  selectedCategories,
  onChange,
  disabled = false,
}: ServiceCategoriesPickerProps) {
  function toggleCategory(categoryId: string) {
    if (disabled) return;

    if (selectedCategories.includes(categoryId)) {
      onChange(selectedCategories.filter((id) => id !== categoryId));
    } else {
      onChange([...selectedCategories, categoryId]);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
      {SERVICE_TYPES.map((type) => {
        const selected = selectedCategories.includes(type.id);
        const Icon = type.Icon;
        return (
          <button
            key={type.id}
            type="button"
            disabled={disabled}
            onClick={() => toggleCategory(type.id)}
            aria-pressed={selected}
            className={cn(
              "group relative flex flex-col items-start gap-2.5 rounded-2xl px-3.5 py-3.5 text-left transition-colors",
              "disabled:cursor-not-allowed disabled:opacity-45",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected
                ? "border-2 border-primary bg-primary/12 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] dark:bg-primary/18 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                : "border border-border/70 bg-muted/25 hover:border-border hover:bg-muted/40 dark:bg-muted/15"
            )}
          >
            {selected && (
              <span
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background"
                aria-hidden
              >
                <Check className="h-3.5 w-3.5 stroke-[2.5]" />
              </span>
            )}
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
                selected
                  ? "border-primary/35 bg-background/90 text-primary dark:bg-background/70"
                  : "border-transparent bg-muted/60 text-muted-foreground group-hover:text-foreground/85"
              )}
            >
              <Icon className="h-[18px] w-[18px] stroke-[1.5]" aria-hidden />
            </span>
            <span
              className={cn(
                "pr-5 text-[13px] leading-snug tracking-tight",
                selected ? "font-semibold text-foreground" : "font-medium text-muted-foreground group-hover:text-foreground/90"
              )}
            >
              {type.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
