import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Search, X, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface SearchResult {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  role: string | null;
}

interface UserSearchProps {
  className?: string;
  /** Minimal underline-style field (e.g. mobile header next to icon) — no filled rounded box */
  variant?: "default" | "inline";
}

export function UserSearch({ className, variant = "default" }: UserSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);

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
    const searchUsers = async () => {
      if (query.trim().length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url, role")
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
            "absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-colors group-focus-within:text-primary",
            isInline && "left-0 w-[18px] h-[18px] text-slate-500 dark:text-slate-400"
          )}
        />
        <input
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
            "w-full text-sm transition-all placeholder:text-slate-400",
            isInline
              ? "h-9 border-0 border-b-2 border-slate-400/45 bg-transparent py-1 pl-7 pr-8 text-slate-900 shadow-none focus-visible:outline-none focus-visible:ring-0 focus:border-primary dark:border-white/35 dark:text-white dark:focus:border-primary"
              : "h-10 rounded-2xl border-none bg-black/5 pl-10 pr-10 focus:ring-2 focus:ring-primary/20 dark:bg-white/5"
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
              ? "rounded-xl border border-slate-200/50 bg-white/90 shadow-md backdrop-blur-md dark:border-white/10 dark:bg-zinc-950/90"
              : "rounded-2xl border border-slate-200/50 bg-white/95 shadow-[0_20px_50px_rgba(0,0,0,0.15)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/95 dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
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
                    <p className="text-sm font-bold truncate group-hover/item:text-primary transition-colors">
                      {result.full_name}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-0.5">
                      {result.role || "User"}
                    </p>
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
