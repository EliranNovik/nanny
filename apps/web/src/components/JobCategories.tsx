import { Baby, Sparkles, ShoppingCart, ChefHat, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface JobCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  bgColor: string;
}

const categories: JobCategory[] = [
  {
    id: "childcare",
    title: "Childcare",
    description: "Find trusted nannies and babysitters for your children. Professional childcare services tailored to your family's needs.",
    icon: Baby,
    iconColor: "text-purple-600",
    bgColor: "bg-purple-100",
  },
  {
    id: "house-cleaning",
    title: "House Cleaning",
    description: "Professional cleaning services to keep your home spotless. Regular or one-time deep cleaning available.",
    icon: Sparkles,
    iconColor: "text-orange-600",
    bgColor: "bg-orange-100",
  },
  {
    id: "house-keeping",
    title: "House Keeping",
    description: "Comprehensive housekeeping services including organization, maintenance, and daily household management.",
    icon: Home,
    iconColor: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  {
    id: "shopping",
    title: "Shopping",
    description: "Personal shopping assistance and grocery delivery services. Save time and let us handle your shopping needs.",
    icon: ShoppingCart,
    iconColor: "text-green-600",
    bgColor: "bg-green-100",
  },
  {
    id: "cooking",
    title: "Cooking",
    description: "Professional chefs and cooks for meal preparation, cooking classes, and personalized meal planning services.",
    icon: ChefHat,
    iconColor: "text-pink-600",
    bgColor: "bg-pink-100",
  },
];

export default function JobCategories() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <div
              key={category.id}
              className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg"
            >
              {/* Icon and Title Section */}
              <div className="flex items-center gap-4 mb-4">
                <div className={cn(
                  "h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0",
                  category.bgColor
                )}>
                  <Icon className={cn("w-7 h-7", category.iconColor)} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  {category.title}
                </h3>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-700 leading-relaxed">
                {category.description}
              </p>
            </div>
          );
        })}
      </div>
      <p className="text-center text-white/70 italic">
        (and more...)
      </p>
    </div>
  );
}
