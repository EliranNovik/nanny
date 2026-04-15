import { cn } from "@/lib/utils";
import type { SmartResult } from "@/hooks/useSmartSearch";
import { 
  MessageCircle, 
  History, 
  ChevronRight, 
  Search,
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
  const isRecent = result.kind === "recent";
  const isAction = result.kind === "action";
  const isCategory = result.kind === "category";

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
        "group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all",
        "hover:bg-muted/80 active:bg-muted/60",
        className
      )}
    >
      {/* Icon / Avatar Area */}
      <div className="shrink-0">
        {isPerson ? (
          <Avatar className="h-10 w-10 border border-border/50">
            <AvatarImage src={undefined /* No photo in SmartResult yet, need to add or fetch */} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
              {result.title.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
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
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm leading-tight text-foreground truncate">
            {renderHighlighted(result.title, query)}
          </p>
          {result.metadata?.matchType === "phone" && (
            <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase tracking-tighter opacity-70">
              Phone match
            </Badge>
          )}
        </div>
        {result.subtitle && (
          <p className="mt-0.5 text-[12px] text-muted-foreground leading-tight truncate">
            {result.subtitle}
          </p>
        )}
      </div>

      {/* Action Area */}
      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isPerson && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAction?.("message", result);
            }}
            className="p-2 rounded-full hover:bg-primary/10 text-primary transition-colors"
            title="Send Message"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
        )}
        <div className="p-2 text-muted-foreground">
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
};
