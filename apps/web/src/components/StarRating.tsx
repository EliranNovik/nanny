import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
    rating: number; // 0-5, supports decimals
    totalRatings?: number;
    size?: "sm" | "md" | "lg";
    showCount?: boolean;
    interactive?: boolean;
    onChange?: (rating: number) => void;
    className?: string;
    numberClassName?: string;
    starClassName?: string;
    emptyStarClassName?: string;
}

export function StarRating({
    rating,
    totalRatings,
    size = "md",
    showCount = true,
    interactive = false,
    onChange,
    className,
    numberClassName,
    starClassName,
    emptyStarClassName,
}: StarRatingProps) {
    const [hoverRating, setHoverRating] = useState<number | null>(null);

    const sizeClasses = {
        sm: "w-3 h-3",
        md: "w-4 h-4",
        lg: "w-5 h-5",
    };

    const textSizeClasses = {
        sm: "text-xs",
        md: "text-sm",
        lg: "text-base",
    };

    const displayRating = hoverRating !== null ? hoverRating : rating;
    const fullStars = Math.floor(displayRating);
    const hasHalfStar = displayRating % 1 >= 0.5;

    const handleStarClick = (starIndex: number) => {
        if (interactive && onChange) {
            onChange(starIndex);
        }
    };

    const handleStarHover = (starIndex: number | null) => {
        if (interactive) {
            setHoverRating(starIndex);
        }
    };

    return (
        <div className={cn("flex items-center gap-1", className)}>
            <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((starIndex) => {
                    const isFilled = starIndex <= fullStars;
                    const isHalf = starIndex === fullStars + 1 && hasHalfStar;

                    return (
                        <div
                            key={starIndex}
                            className={cn(
                                "relative",
                                interactive && "cursor-pointer transition-transform hover:scale-110"
                            )}
                            onClick={() => handleStarClick(starIndex)}
                            onMouseEnter={() => handleStarHover(starIndex)}
                            onMouseLeave={() => handleStarHover(null)}
                        >
                            {/* Background star (empty) */}
                            <Star
                                className={cn(
                                    sizeClasses[size],
                                    emptyStarClassName || "text-muted-foreground/30"
                                )}
                                fill="none"
                            />

                            {/* Filled star overlay */}
                            {(isFilled || isHalf) && (
                                <div
                                    className="absolute inset-0 overflow-hidden"
                                    style={{ width: isHalf ? "50%" : "100%" }}
                                >
                                    <Star
                                        className={cn(
                                            sizeClasses[size],
                                            starClassName || "text-yellow-500"
                                        )}
                                        fill="currentColor"
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Rating number and count */}
            <div className={cn("flex items-center gap-1", textSizeClasses[size])}>
                <span className={cn("font-black", numberClassName || "text-slate-900 dark:text-slate-100")}>
                    {rating > 0 ? rating.toFixed(1) : "New"}
                </span>
                {showCount && totalRatings !== undefined && totalRatings > 0 && (
                    <span className="text-slate-600 dark:text-slate-400">
                        ({totalRatings})
                    </span>
                )}
            </div>
        </div>
    );
}
