import { cn } from "@/lib/utils";

export const SERVICE_TYPES = [
    { id: "cleaning", label: "Cleaning", icon: "🧹" },
    { id: "cooking", label: "Cooking", icon: "👨‍🍳" },
    { id: "pickup_delivery", label: "Pick up - delivery", icon: "🚗" },
    { id: "nanny", label: "Nanny", icon: "👶" },
    { id: "other_help", label: "Other help", icon: "🛠️" },
];

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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {SERVICE_TYPES.map((type) => (
                <button
                    key={type.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleCategory(type.id)}
                    className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed",
                        selectedCategories.includes(type.id)
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border hover:border-primary/50 text-muted-foreground"
                    )}
                >
                    <span className="text-2xl mb-1">{type.icon}</span>
                    <span className="text-sm">{type.label}</span>
                </button>
            ))}
        </div>
    );
}
