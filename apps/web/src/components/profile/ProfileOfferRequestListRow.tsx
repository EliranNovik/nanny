import { formatDistanceToNow } from "date-fns";
import { ChevronRight, HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { dateFnsLocaleFor } from "@/lib/dateFnsLocale";
import {
  HIRE_CATEGORY_TILE_UI,
  OTHER_HELP_SUBCATEGORY_UI,
  categoryIllustrationSrc,
  helpCategoryIdFromServiceDetails,
  resolveHelpCategoryIconId,
} from "@/lib/discoverCategoryTileIcons";
import {
  feedCategoryLabel,
  feedLocationDisplayLabel,
  feedPostLocationAddress,
  feedPostServiceCategoryMeta,
  feedPostTitle,
  feedPostTypeId,
} from "@/lib/globalFeedPostUi";
import { parseGeneratedPostCopy } from "@/lib/generatedPostCopy";
import { listingCityPart } from "@/lib/localizedListingCopy";
import { jobRequestImageUrls } from "@/lib/openHelpRequestFeedPost";
import { publicProfileMediaPublicUrl } from "@/lib/publicProfileMedia";
import { isServiceCategoryId } from "@/lib/serviceCategories";
import { cn } from "@/lib/utils";
import type { FeedPost, ProfilePost } from "@/components/profile/ProfilePostsFeed"; // type-only
import type { JobRequestFeedPost } from "@/lib/openHelpRequestFeedPost";

type OfferOrRequestPost = ProfilePost | JobRequestFeedPost;

function CategoryGlyph({
  categoryId,
  customCategory,
  className,
}: {
  categoryId: string | null;
  customCategory?: string | null;
  className?: string;
}) {
  const id = resolveHelpCategoryIconId(categoryId, customCategory);
  const ui =
    (id ? OTHER_HELP_SUBCATEGORY_UI[id] : null) ??
    (id && isServiceCategoryId(id) ? HIRE_CATEGORY_TILE_UI[id] : null);
  const Icon = ui?.Icon ?? HelpCircle;
  return <Icon className={className} aria-hidden />;
}

function trimUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/** Compact offer/request row — same layout as home “Offers / Requests near you” boxes. */
export function ProfileOfferRequestListRow({
  post,
  onOpen,
  className,
}: {
  post: FeedPost;
  onOpen: () => void;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  if (!isProfileOfferOrRequestPost(post)) return null;
  const listing = post as OfferOrRequestPost;
  const typeId = feedPostTypeId(listing);
  const isOffer = typeId === "offer_service";

  const categoryMeta = feedPostServiceCategoryMeta(t, listing);
  const categoryId = categoryMeta?.id ?? null;
  const meta = listing.post_metadata as Record<string, unknown> | null | undefined;
  const customCategory =
    typeof meta?.other_type === "string"
      ? meta.other_type
      : typeof meta?.custom_category === "string"
        ? meta.custom_category
        : listing.source === "job_request"
          ? helpCategoryIdFromServiceDetails(listing.row.service_details)
          : null;

  const postMedia =
    listing.media_type === "image" && listing.storage_path
      ? publicProfileMediaPublicUrl(listing.storage_path)
      : listing.source === "job_request"
        ? jobRequestImageUrls(
            (listing.row.service_details as Record<string, unknown> | null) ??
              null,
          )[0] ?? null
        : null;
  const authorPhoto = trimUrl(listing.author?.photo_url);
  const thumbUrl =
    trimUrl(postMedia) ||
    authorPhoto ||
    categoryIllustrationSrc(categoryId, customCategory);

  const freeText =
    (listing.source === "job_request"
      ? listing.row.notes?.trim()
      : listing.caption?.trim()) || "";
  const generatedCopy = parseGeneratedPostCopy(listing.ai_generated_copy);
  const fallbackTitle = feedPostTitle(
    t,
    listing,
    generatedCopy,
    categoryMeta?.label,
  );
  const title = freeText || fallbackTitle || categoryMeta?.label || "Post";

  const locationRaw = feedLocationDisplayLabel(
    t,
    listingCityPart(feedPostLocationAddress(listing)),
  );
  const timeAgo = formatDistanceToNow(new Date(listing.created_at), {
    addSuffix: true,
    locale: dateFnsLocaleFor(i18n.language),
  });

  const accentText = isOffer
    ? "text-orange-700 dark:text-orange-400"
    : "text-emerald-700 dark:text-emerald-400";
  const focusRing = isOffer
    ? "focus-visible:ring-orange-500/70"
    : "focus-visible:ring-emerald-500/70";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex h-full w-full items-center gap-3 overflow-hidden rounded-[20px] p-0 pe-3 text-left md:flex-col md:items-stretch md:gap-0 md:pe-0",
        "bg-white shadow-[0_5px_20px_rgba(15,23,42,0.08)] outline-none transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_26px_rgba(15,23,42,0.12)] active:opacity-80 dark:bg-[#1d1f21] dark:shadow-none",
        "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        focusRing,
        className,
      )}
    >
      <div className="relative h-[112px] w-[112px] shrink-0 overflow-hidden bg-zinc-200 dark:bg-zinc-800 md:aspect-[4/3] md:h-auto md:w-full">
        <img
          src={thumbUrl}
          alt=""
          className="h-full w-full object-cover object-center transition-transform duration-500 md:group-hover:scale-[1.04]"
          loading="lazy"
          decoding="async"
        />
      </div>

      <div className="min-w-0 flex-1 md:px-4 md:pb-4 md:pt-3.5">
        <p
          className={cn(
            "flex min-w-0 items-center gap-1.5 text-[15px] font-semibold sm:text-[13px] md:mb-1.5 md:w-fit md:max-w-full md:rounded-full md:px-2.5 md:py-1 md:text-[12px] md:font-bold",
            accentText,
            isOffer
              ? "md:bg-orange-50 dark:md:bg-orange-500/15"
              : "md:bg-emerald-50 dark:md:bg-emerald-500/15",
          )}
        >
          <CategoryGlyph
            categoryId={categoryId}
            customCategory={customCategory}
            className="h-4 w-4 shrink-0 sm:h-3.5 sm:w-3.5"
          />
          <span className="truncate">
            {feedCategoryLabel(t, categoryId, customCategory)}
          </span>
        </p>
        <p className="mt-0.5 line-clamp-2 text-[18px] font-bold leading-snug text-zinc-900 dark:text-white sm:text-[16px]">
          {title}
        </p>
        {locationRaw ? (
          <p className="mt-0.5 truncate text-[15px] font-medium text-zinc-500 dark:text-zinc-400 sm:text-[13px]">
            {locationRaw}
          </p>
        ) : null}
        <p className="mt-0.5 truncate text-[15px] font-medium text-zinc-500 dark:text-zinc-400 sm:text-[13px]">
          {timeAgo}
        </p>
      </div>

      <ChevronRight
        className="h-6 w-6 shrink-0 text-zinc-300 rtl-flip-icon dark:text-zinc-600 sm:h-5 sm:w-5 md:hidden"
        strokeWidth={2}
        aria-hidden
      />
    </button>
  );
}

export function isProfileOfferOrRequestPost(post: FeedPost): boolean {
  if (post.source === "job_request") return true;
  if (post.source !== "post") return false;
  const typeId = post.post_type_id ?? post.post_types?.id ?? null;
  return typeId === "offer_service" || typeId === "request_help";
}
