import { useState, useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Search, X, Loader2, Sparkles } from "lucide-react";
import { useSmartSearch, type SmartResult } from "@/hooks/useSmartSearch";
import { SearchResultItem } from "./SearchResultItem";

interface UserSearchProps {
  className?: string;
  /** Minimal underline-style field (e.g. mobile header next to icon) — no filled rounded box */
  variant?: "default" | "inline";
  autoFocus?: boolean;
  onResultSelect?: () => void;
  inputClassName?: string;
  size?: "default" | "lg";
  placeholder?: string;
  /** Open the results beside the field, lined up with it, instead of underneath. */
  resultsBeside?: boolean;
  /** Sits inside the field, on the right. */
  endSlot?: ReactNode;
  /** Marks this field for the first-run page guide. */
  guideId?: string;
}

export function UserSearch({
  className,
  inputClassName,
  variant = "default",
  autoFocus = false,
  onResultSelect,
  size = "default",
  placeholder = "Search anything...",
  resultsBeside = false,
  endSlot,
  guideId,
}: UserSearchProps) {
  const isLarge = size === "lg";
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { results, loading, addRecent } = useSmartSearch(query);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [autoFocus]);

  const isInline = variant === "inline";

  const handleSelect = (result: SmartResult) => {
    addRecent({
      id: result.id,
      kind: result.kind as any,
      title: result.title,
      subtitle: result.subtitle,
      to: result.to
    });
    navigate(result.to);
    setIsOpen(false);
    setQuery("");
    onResultSelect?.();
  };

  const handleAction = (action: string, result: SmartResult) => {
    if (action === "message") {
      navigate(`/chat/${result.id}`);
      setIsOpen(false);
      setQuery("");
      onResultSelect?.();
    }
  };

  const showPanel = isOpen; // Show even when empty for "Recents"
  const hasQuery = query.trim().length > 0;

  return (
    <div
      ref={searchRef}
      data-guide={guideId}
      data-guide-rank={guideId ? "primary" : undefined}
      className={cn(
        "group relative w-full",
        isLarge ? "mx-auto max-w-xl" : "max-w-[220px] sm:max-w-xs md:max-w-xs lg:max-w-sm",
        className,
      )}
    >
      <div className="relative">
        <Search
          className={cn(
            "absolute top-1/2 -translate-y-1/2 transition-colors",
            isLarge ? "left-5 h-6 w-6" : "left-3 h-[18px] w-[18px]",
            isInline
              ? "left-0 text-slate-400 group-focus-within:text-orange-500 dark:group-focus-within:text-orange-400"
              : "text-orange-500 dark:text-orange-400",
          )}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(
            "w-full text-[14px] transition-all placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-0",
            isLarge
              ? "h-16 rounded-full border-0 bg-zinc-100 pl-14 text-[17px] text-zinc-900 shadow-none placeholder:text-zinc-400 focus:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              : isInline
              ? "h-9 border-0 border-b-2 border-slate-400/45 bg-transparent py-1 pl-8 text-slate-900 focus:border-orange-500 dark:border-white/35 dark:text-white dark:focus:border-orange-400"
              : "h-11 rounded-2xl border-0 bg-zinc-100 pl-10 shadow-none text-zinc-900 placeholder:text-zinc-500 focus:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:bg-zinc-700",
            endSlot ? (isLarge ? "pr-16" : "pr-14") : isLarge ? "pr-12" : "pr-10",
            inputClassName,
          )}
        />
        {query || endSlot ? (
          <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="rounded-full p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5 text-slate-400" />
              </button>
            ) : null}
            {endSlot}
          </div>
        ) : null}
      </div>

      {showPanel && (
        <div
          className={cn(
            resultsBeside
              ? "absolute start-full top-0 z-[100] ms-3 w-[min(36rem,calc(100vw-22rem))] rounded-2xl shadow-lg animate-in fade-in slide-in-from-left-2 duration-200"
              : isLarge
                ? "absolute inset-x-0 top-full z-[100] mt-2 rounded-3xl shadow-lg"
                : "absolute end-0 top-full z-[100] mt-2 w-[min(36rem,calc(100vw-8rem))] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.18)]",
            "overflow-hidden border border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-950",
            "max-h-[min(70vh,28rem)] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          )}
        >
          <div className="p-2.5">
            {loading && results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                <p className="text-xs font-medium text-slate-400 animate-pulse">Searching the community...</p>
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-4">
                {/* Visual grouping of results */}
                {(() => {
                  const groups: Record<string, SmartResult[]> = {};
                  const groupOrder = ["Offers", "Events", "Posts", "People", "Pages", "Recent"];
                  results.forEach(r => {
                    const groupName =
                      r.kind === "recent" ? "Recent" :
                      r.kind === "person" ? "People" :
                      r.kind === "offer" ? "Offers" :
                      r.kind === "event" ? "Events" :
                      r.kind === "post" ? "Posts" :
                      "Pages";
                    if (!groups[groupName]) groups[groupName] = [];
                    groups[groupName].push(r);
                  });

                  return groupOrder.filter((name) => groups[name]?.length).map((groupName) => {
                    const groupItems = groups[groupName];
                    return (
                    <div key={groupName} className="space-y-1">
                      <h3 className="px-3 pb-1 pt-2 text-sm font-semibold tracking-wide text-zinc-500">
                        {groupName}
                      </h3>
                      {groupItems.map(item => (
                        <SearchResultItem
                          key={item.id}
                          result={item}
                          query={query}
                          onSelect={handleSelect}
                          onAction={handleAction}
                        />
                      ))}
                    </div>
                  );
                  });
                })()}
              </div>
            ) : (
              <div className="py-10 px-6 text-center">
                <div className="mx-auto w-12 h-12 bg-slate-50 dark:bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm text-slate-500 font-semibold mb-1">
                  {hasQuery ? `No results for "${query}"` : "Try searching for..."}
                </p>
                <p className="text-xs text-slate-400 max-w-[200px] mx-auto leading-relaxed">
                  {hasQuery ? "Try a name, an offer, or an event" : "Search offers, events, posts, and people"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
