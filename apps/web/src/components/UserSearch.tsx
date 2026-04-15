import { useState, useEffect, useRef } from "react";
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
}

export function UserSearch({
  className,
  variant = "default",
  autoFocus = false,
  onResultSelect,
}: UserSearchProps) {
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
      className={cn(
        "group relative w-full max-w-[240px] sm:max-w-sm",
        className,
      )}
    >
      <div className="relative">
        <Search
          className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 transition-colors group-focus-within:text-orange-500 dark:group-focus-within:text-orange-400",
            isInline && "left-0",
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
          placeholder="Search anything..."
          autoComplete="off"
          className={cn(
            "w-full text-[14px] transition-all placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-0",
            isInline
              ? "h-9 border-0 border-b-2 border-slate-400/45 bg-transparent py-1 pl-8 pr-8 text-slate-900 focus:border-orange-500 dark:border-white/35 dark:text-white dark:focus:border-orange-400"
              : "h-11 rounded-2xl border border-slate-300/70 bg-black/[0.03] pl-10 pr-10 shadow-sm focus:border-orange-400/50 focus:bg-white dark:border-zinc-700 dark:bg-white/5 dark:focus:border-orange-500/50 dark:focus:bg-zinc-900",
          )}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="h-3.5 w-3.5 text-slate-400" />
          </button>
        )}
      </div>

      {showPanel && (
        <div
          className={cn(
            "absolute left-[-20px] right-[-20px] sm:left-0 sm:right-0 top-full z-[100] mt-3 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200",
            "rounded-3xl border border-slate-200/60 bg-white/95 shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-950/95 dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)]",
            "max-h-[min(80vh,32rem)] overflow-y-auto"
          )}
        >
          <div className="p-2.5">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                <p className="text-xs font-medium text-slate-400 animate-pulse">Searching the community...</p>
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-4">
                {/* Visual grouping of results */}
                {(() => {
                  const groups: Record<string, SmartResult[]> = {};
                  results.forEach(r => {
                    const groupName = r.kind === "recent" ? "Recent" : (r.kind === "person" ? "People" : "Suggestions");
                    if (!groups[groupName]) groups[groupName] = [];
                    groups[groupName].push(r);
                  });

                  return Object.entries(groups).map(([groupName, groupItems]) => (
                    <div key={groupName} className="space-y-1">
                      <h3 className="px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400/80 mb-1.5">
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
                  ));
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
                  {hasQuery ? "Try checking your spelling or search for categories like 'Cleaning'" : "Search for people, categories like 'Nanny', or pages like 'Messages'"}
                </p>
              </div>
            )}
          </div>
          
          {/* Subtle footer */}
          <div className="px-5 py-3 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between">
             <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Smart Search v2</span>
             <div className="flex gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10 text-[9px] font-bold bg-white dark:bg-zinc-800 text-slate-400 shadow-sm">ESC</kbd>
                <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10 text-[9px] font-bold bg-white dark:bg-zinc-800 text-slate-400 shadow-sm">↵</kbd>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
