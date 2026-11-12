import { cn } from "@/lib/utils";
import type { SmartResult } from "@/hooks/useSmartSearch";
import { 
  BadgeCheck,
  MessageCircle, 
  History, 
  ChevronRight, 
  Search,
  Star,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface SearchResultItemProps {
  result: SmartResult;
  query: string;
  onSelect: (result: SmartResult) => void;
  onAction?: (action: string, result: SmartResult) => void;
  className?: string;
}

export const SearchResultItem = ({
  result,
  query,
  onSelect,
  onAction,
  className,
}: SearchResultItemProps) => {
  const Icon = result.icon || Search;
  const isPerson = result.kind === "person";
  const isListing = result.kind === "offer" || result.kind === "event" || result.kind === "post";
  const isRecent = result.kind === "recent";
  const isAction = result.kind === "action";
  const isCategory = result.kind === "category";
  const imageUrl = result.imageUrl?.trim() || "";
  const authorName = result.metadata?.authorName?.trim() || "";
  const authorPhotoUrl = result.metadata?.authorPhotoUrl?.trim() || "";
  const authorRating = result.metadata?.authorRating ?? 0;
  const authorRatingCount = result.metadata?.authorRatingCount ?? 0;

  // Simple highlight helper
  const renderHighlighted = (text: string, q: string) => {
    if (!q.trim()) return text;
    const parts = text.split(new RegExp(`(${q})`, "gi"));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === q.toLowerCase() ? (
            <mark key={i} className="bg-orange-500/20 text-orange-700 dark:text-orange-400 p-0 rounded-sm">
              {part}
            </mark>
          ) : part
        )}
      </span>
    );
  };

  return (
    <div
      onClick={() => onSelect(result)}
      className={cn(
        "group flex gap-2 p-2 md:gap-3.5 md:p-3 rounded-2xl cursor-pointer transition-all",
        isListing ? "items-start" : "items-center",
        "hover:bg-muted/80 active:bg-muted/60",
        className
      )}
    >
      {/* Icon / Avatar Area */}
      <div className="shrink-0">
        {isPerson ? (
          <Avatar className="h-8 w-8 border border-border/50 md:h-10 md:w-10">
            <AvatarImage src={imageUrl || undefined} alt="" />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
              {result.title.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
        ) : isListing && imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="h-14 w-14 rounded-xl object-cover md:h-28 md:w-28 md:rounded-2xl"
          />
        ) : (
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg md:h-10 md:w-10 md:rounded-xl",
            isAction ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-500" :
            isCategory ? "bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-500" :
            isRecent ? "bg-muted text-muted-foreground" :
            "bg-primary/10 text-primary"
          )}>
            {isRecent ? <History className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="min-w-0 flex-1">
        {isListing && authorName ? (
          <div className="mb-1.5 flex items-center gap-2">
            <Avatar className="h-5 w-5 shrink-0 border border-border/50 md:h-7 md:w-7">
              <AvatarImage src={authorPhotoUrl || undefined} alt="" />
              <AvatarFallback className="bg-primary/10 text-[11px] font-bold text-primary">
                {authorName.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <p className="flex min-w-0 items-center gap-1 text-xs font-medium leading-none text-foreground md:text-sm">
                <span className="truncate">by {authorName}</span>
                {result.metadata?.authorVerified ? (
                  <BadgeCheck
                    className="h-4 w-4 shrink-0 fill-sky-500 text-white"
                    aria-label="Verified"
                  />
                ) : null}
              </p>
              {authorRating > 0 ? (
                <p className="flex shrink-0 items-center gap-1 text-xs leading-none">
                  <Star
                    className="h-3.5 w-3.5 fill-current text-slate-950 dark:text-neutral-200"
                    aria-hidden
                  />
                  <span className="font-black text-slate-900 dark:text-slate-100">
                    {authorRating.toFixed(1)}
                  </span>
                  {authorRatingCount > 0 ? (
                    <span className="font-medium text-slate-600 dark:text-slate-400">
                      ({authorRatingCount})
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <p className={cn(
            "min-w-0 font-semibold leading-snug text-foreground",
            isListing ? "line-clamp-2 text-[13px] md:text-base" : "truncate text-[13px] md:text-base",
          )}>
            {renderHighlighted(result.title, query)}
          </p>
          {isPerson && result.metadata?.authorVerified ? (
            <BadgeCheck
              className="h-4 w-4 shrink-0 fill-sky-500 text-white"
              aria-label="Verified"
            />
          ) : null}
          {result.metadata?.own ? (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase tracking-tighter opacity-70">
              Yours
            </Badge>
          ) : null}
          {result.metadata?.matchType === "phone" && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase tracking-tighter opacity-70">
              Phone match
            </Badge>
          )}
        </div>
        {result.subtitle && (
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground line-clamp-2 md:mt-1 md:text-sm">
            {result.subtitle}
          </p>
        )}
      </div>

      {/* Action Area */}
      <div className="flex shrink-0 items-center gap-1">
        {isPerson && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAction?.("message", result);
            }}
            className="rounded-full p-2 text-primary opacity-0 transition-opacity hover:bg-primary/10 group-hover:opacity-100"
            title="Send Message"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
        )}
        <div className="p-1 text-muted-foreground md:p-2">
          <ChevronRight className="h-4 w-4 rtl-flip-icon" />
        </div>
      </div>
    </div>
  );
};
