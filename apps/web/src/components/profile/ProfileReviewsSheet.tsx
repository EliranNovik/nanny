import { Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StarRating } from "@/components/StarRating";
import { DiscoverOverlaySnapSheet } from "@/lib/discoverSheetDialog";
import { avatarUrl } from "@/lib/imageTransform";
import { cn } from "@/lib/utils";

export type ProfileReviewItem = {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  reviewer: {
    full_name: string | null;
    photo_url: string | null;
  };
};

const REVIEW_CARD_GRADIENTS = [
  "from-blue-400 to-orange-500",
  "from-green-400 to-teal-500",
  "from-orange-400 to-pink-500",
  "from-red-400 to-indigo-500",
  "from-orange-400 to-blue-500",
] as const;

function reviewGradient(index: number) {
  return REVIEW_CARD_GRADIENTS[index % REVIEW_CARD_GRADIENTS.length];
}

function reviewQuote(text: string | null) {
  return `"${text?.trim() || "No comments provided."}"`;
}

type ProfileReviewPreviewCardProps = {
  review: ProfileReviewItem;
  index: number;
  onClick?: () => void;
  className?: string;
};

export function ProfileReviewPreviewCard({
  review,
  index,
  onClick,
  className,
}: ProfileReviewPreviewCardProps) {
  const gradient = reviewGradient(index);
  const CardTag = onClick ? "button" : "div";

  return (
    <CardTag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      role={onClick ? undefined : "listitem"}
      className={cn(
        "group relative flex w-[min(19rem,calc(100vw-2.5rem))] max-w-sm shrink-0 snap-start snap-always flex-col rounded-3xl bg-white p-6 pt-12 text-left shadow-md transition-all duration-500 dark:bg-zinc-900 dark:shadow-black/20",
        onClick &&
          "cursor-pointer outline-none hover:shadow-lg active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-orange-500/50",
        className,
      )}
    >
      <div
        className={cn(
          "absolute -top-10 left-6 h-20 w-20 rounded-full bg-gradient-to-br p-1.5 shadow-xl transition-transform duration-500 group-hover:scale-110",
          gradient,
        )}
      >
        <Avatar className="h-full w-full border-4 border-white dark:border-zinc-900">
          <AvatarImage
            src={avatarUrl.xs(review.reviewer.photo_url)}
            className="object-cover"
          />
          <AvatarFallback className="bg-transparent text-2xl font-bold text-white">
            {review.reviewer.full_name?.slice(0, 2).toUpperCase() || "??"}
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 pr-2">
            <h4 className="truncate text-lg font-bold text-gray-900 transition-colors group-hover:text-primary dark:text-white">
              {review.reviewer.full_name}
            </h4>
            <p className="mt-0.5 text-[11px] font-medium text-slate-400">
              {new Date(review.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 self-start rounded-full border border-yellow-400/20 bg-yellow-400/10 px-2.5 py-1">
            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            <span className="text-[12px] font-black text-yellow-700 dark:text-yellow-500">
              {review.rating}
            </span>
          </div>
        </div>
        <p className="line-clamp-4 text-base italic leading-relaxed text-gray-700 dark:text-slate-300">
          {reviewQuote(review.review_text)}
        </p>
      </div>
    </CardTag>
  );
}

function ProfileReviewListItem({
  review,
  index,
}: {
  review: ProfileReviewItem;
  index: number;
}) {
  const gradient = reviewGradient(index);

  return (
    <article className="flex gap-4 border-b border-border/40 pb-6 last:border-b-0 last:pb-0">
      <div
        className={cn(
          "h-14 w-14 shrink-0 rounded-full bg-gradient-to-br p-1 shadow-md",
          gradient,
        )}
      >
        <Avatar className="h-full w-full border-2 border-white dark:border-zinc-900">
          <AvatarImage
            src={avatarUrl.sm(review.reviewer.photo_url)}
            className="object-cover"
          />
          <AvatarFallback className="bg-transparent text-sm font-bold text-white">
            {review.reviewer.full_name?.slice(0, 2).toUpperCase() || "??"}
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-slate-900 dark:text-white">
              {review.reviewer.full_name || "Anonymous"}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-400">
              {new Date(review.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-yellow-400/20 bg-yellow-400/10 px-2 py-0.5">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span className="text-[11px] font-black text-yellow-700 dark:text-yellow-500">
              {review.rating}
            </span>
          </div>
        </div>
        <p className="mt-3 text-sm italic leading-relaxed text-slate-700 dark:text-slate-300">
          {reviewQuote(review.review_text)}
        </p>
      </div>
    </article>
  );
}

type ProfileReviewsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviews: ProfileReviewItem[];
  averageRating?: number;
  totalRatings?: number;
};

export function ProfileReviewsSheet({
  open,
  onOpenChange,
  reviews,
  averageRating = 0,
  totalRatings = 0,
}: ProfileReviewsSheetProps) {
  return (
    <DiscoverOverlaySnapSheet
      open={open}
      onOpenChange={onOpenChange}
      title="User reviews"
    >
      <div className="flex min-h-0 flex-col">
        <div className="shrink-0 border-b border-border/40 px-5 pb-4 pt-2">
          <div className="flex items-center gap-2.5">
            <Star
              className="h-5 w-5 fill-amber-500 text-amber-500"
              aria-hidden
            />
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
              User Reviews
            </h2>
            <span className="text-sm font-semibold tabular-nums text-slate-500 dark:text-slate-400">
              ({reviews.length})
            </span>
          </div>
          {totalRatings > 0 ? (
            <div className="mt-3">
              <StarRating
                rating={averageRating}
                totalRatings={totalRatings}
                size="sm"
                className="justify-start"
              />
            </div>
          ) : null}
        </div>

        <div className="space-y-6 px-5 py-5">
          {reviews.map((review, idx) => (
            <ProfileReviewListItem key={review.id} review={review} index={idx} />
          ))}
        </div>
      </div>
    </DiscoverOverlaySnapSheet>
  );
}
