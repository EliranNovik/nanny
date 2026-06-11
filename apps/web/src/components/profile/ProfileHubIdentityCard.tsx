import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StarRating } from "@/components/StarRating";
import { cn } from "@/lib/utils";

type ProfileHubIdentityCardProps = {
  fullName: string;
  photoUrl?: string | null;
  city?: string | null;
  averageRating?: number | null;
  totalRatings?: number | null;
  cityPlaceholder?: string;
  className?: string;
};

function profileInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function ProfileHubIdentityCard({
  fullName,
  photoUrl,
  city,
  averageRating = 0,
  totalRatings = 0,
  cityPlaceholder = "Complete your details",
  className,
}: ProfileHubIdentityCardProps) {
  const displayName = fullName.trim() || "Your profile";

  return (
    <div
      className={cn(
        "mb-8 flex items-center gap-4 md:gap-5",
        "border-0 bg-transparent px-0 py-0 shadow-none",
        "dark:rounded-[18px] dark:border-0 dark:bg-zinc-900 dark:px-5 dark:py-5 dark:shadow-none",
        className,
      )}
    >
      <Avatar className="h-16 w-16 shrink-0 md:h-[4.5rem] md:w-[4.5rem]">
        <AvatarImage src={photoUrl ?? undefined} alt="" className="object-cover" />
        <AvatarFallback className="bg-muted text-lg font-semibold">
          {profileInitials(displayName)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground md:text-2xl">
            {displayName}
          </h1>
          <span className="min-w-0 max-w-full truncate text-sm text-muted-foreground">
            {city?.trim() || cityPlaceholder}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <StarRating
            rating={averageRating || 0}
            size="sm"
            showCount={false}
            className="gap-1"
            numberClassName="text-sm font-bold text-foreground/80"
          />
          {totalRatings ? (
            <span className="text-sm text-muted-foreground">{totalRatings} reviews</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
