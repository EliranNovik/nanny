import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Search, X, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StarRating } from "@/components/StarRating";

interface SearchResult {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  average_rating: number | null;
  total_ratings: number | null;
}

interface UserSearchProps {
  className?: string;
  /** Minimal underline-style field (e.g. mobile header next to icon) — no filled rounded box */
  variant?: "default" | "inline";
  autoFocus?: boolean;
  onResultSelect?: () => void;
}

export function UserSearch({ className, variant = "default", autoFocus = false, onResultSelect }: UserSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
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

  useEffect(() => {
    const searchUsers = async () => {
      if (query.trim().length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url, average_rating, total_ratings")
        .ilike("full_name", `%${query}%`)
        .limit(5);

      if (!error && data) {
        setResults(data);
      }
      setLoading(false);
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const isInline = variant === "inline";

  return (
    <div ref={searchRef} className={cn("group relative w-full max-w-[200px] sm:max-w-xs", className)}>
      <div className="relative">
        <Search
          className={cn(
            "absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-colors group-focus-within:text-slate-600 dark:group-focus-within:text-slate-300",
            isInline && "left-0 w-[18px] h-[18px] text-slate-500 dark:text-slate-400"
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
          placeholder="Search helpers..."
          autoComplete="off"
          className={cn(
            "w-full text-sm transition-all placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-0",
            isInline
              ? "h-9 border-0 border-b-2 border-slate-400/45 bg-transparent py-1 pl-7 pr-8 text-slate-900 shadow-none focus-visible:outline-none focus-visible:ring-0 focus:border-slate-600 dark:border-white/35 dark:text-white dark:focus:border-slate-300"
              : "h-10 rounded-2xl border border-slate-300/70 bg-black/5 pl-10 pr-10 shadow-none focus:border-slate-400 dark:border-zinc-600/70 dark:bg-white/5 dark:focus:border-zinc-500"
          )}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 p-0.5 transition-colors",
              isInline ? "right-0 hover:opacity-70" : "right-3 hover:bg-black/10 dark:hover:bg-white/10 rounded-full"
            )}
          >
            <X className="h-3.5 w-3.5 text-slate-400" />
          </button>
        )}
      </div>

      {isOpen && query.length > 0 && (
        <div
          className={cn(
            "absolute left-0 right-0 top-full z-[100] mt-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200",
            isInline
              ? "rounded-xl border border-slate-200/50 bg-card/90 shadow-md backdrop-blur-md dark:border-border/40 dark:bg-card/90"
              : "rounded-2xl border border-slate-200/50 bg-card/95 shadow-[0_20px_50px_rgba(0,0,0,0.15)] backdrop-blur-xl dark:border-border/50 dark:bg-card/95 dark:shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
          )}
        >
          <div className="p-2 space-y-1">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
            ) : results.length > 0 ? (
              results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => {
                    navigate(`/profile/${result.id}`);
                    setIsOpen(false);
                    setQuery("");
                    onResultSelect?.();
                  }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-all group/item text-left"
                >
                  <Avatar className="w-9 h-9 border border-black/5 dark:border-white/5">
                    <AvatarImage src={result.photo_url || undefined} className="object-cover" />
                    <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold uppercase">
                      {result.full_name?.slice(0, 2) || "??"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate transition-colors group-hover/item:text-slate-700 dark:group-hover/item:text-slate-200">
                      {result.full_name}
                    </p>
                    <div className="mt-0.5">
                      <StarRating
                        rating={result.average_rating || 0}
                        totalRatings={result.total_ratings || 0}
                        size="sm"
                        className="gap-1"
                        starClassName="text-slate-500 dark:text-slate-300"
                        emptyStarClassName="text-slate-300 dark:text-slate-600"
                        numberClassName="text-[11px] text-slate-600 dark:text-slate-300"
                      />
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="py-8 px-4 text-center">
                <p className="text-sm text-slate-400 font-medium">No results found for "{query}"</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
