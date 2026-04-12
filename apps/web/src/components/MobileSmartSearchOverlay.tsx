import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ChevronLeft, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StarRating } from "@/components/StarRating";
import { useDebouncedProfileSearch } from "@/hooks/useDebouncedProfileSearch";
import { filterPageSuggestions, type SmartSearchSuggestion } from "@/lib/smartSearchSuggestions";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenNotifications?: () => void;
};

export function MobileSmartSearchOverlay({ open, onClose, onOpenNotifications }: Props) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const role = profile?.role === "freelancer" ? "freelancer" : "client";
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { results: profileResults, loading: profilesLoading } = useDebouncedProfileSearch(query, 300, 10);
  const pageMatches = query.trim() ? filterPageSuggestions(query, role) : [];

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const goPage = (to: string) => {
    navigate(to);
    onClose();
  };

  const goProfile = (id: string) => {
    navigate(`/profile/${id}`);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-background md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <header
        className="shrink-0 border-b border-border/50 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
        style={{ paddingLeft: "max(0.75rem, env(safe-area-inset-left))", paddingRight: "max(0.75rem, env(safe-area-inset-right))" }}
      >
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={onClose} aria-label="Close search">
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search helpers, pages, jobs…"
              autoComplete="off"
              enterKeyHint="search"
              className="h-11 w-full rounded-2xl border border-border/60 bg-muted/40 pl-10 pr-10 text-[15px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            />
            {query ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          {onOpenNotifications ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label="Notifications"
              onClick={() => {
                onOpenNotifications();
                onClose();
              }}
            >
              <Bell className="h-5 w-5" />
            </Button>
          ) : null}
        </div>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
        style={{ paddingLeft: "max(0.75rem, env(safe-area-inset-left))", paddingRight: "max(0.75rem, env(safe-area-inset-right))" }}
      >
        {pageMatches.length > 0 ? (
          <section className="py-2">
            <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pages & tabs</h2>
            <ul className="flex flex-col gap-1">
              {pageMatches.map((s) => (
                <SuggestionRow key={s.id} item={s} onPick={() => goPage(s.to)} />
              ))}
            </ul>
          </section>
        ) : null}

        <section className={cn("py-2", pageMatches.length > 0 && "border-t border-border/40")}>
          <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">People</h2>
          {query.trim().length === 0 ? (
            <p className="px-1 py-8 text-center text-sm text-muted-foreground">
              Start typing to match pages and people.
            </p>
          ) : profilesLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : profileResults.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {profileResults.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => goProfile(r.id)}
                    className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-muted/80"
                  >
                    <Avatar className="h-11 w-11 border border-border/50">
                      <AvatarImage src={r.photo_url || undefined} className="object-cover" />
                      <AvatarFallback className="text-xs font-bold">{r.full_name?.slice(0, 2) || "??"}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">{r.full_name}</p>
                      <StarRating
                        rating={r.average_rating || 0}
                        totalRatings={r.total_ratings || 0}
                        size="sm"
                        className="gap-1"
                        starClassName="text-muted-foreground"
                        emptyStarClassName="text-muted-foreground/40"
                        numberClassName="text-[11px] text-muted-foreground"
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1 py-4 text-center text-sm text-muted-foreground">No people match “{query.trim()}”.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function SuggestionRow({ item, onPick }: { item: SmartSearchSuggestion; onPick: () => void }) {
  const Icon = item.icon;
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors",
          "hover:bg-muted/80 active:bg-muted/60"
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight text-foreground">{item.title}</p>
          {item.subtitle ? <p className="mt-0.5 text-[13px] text-muted-foreground leading-snug">{item.subtitle}</p> : null}
        </div>
      </button>
    </li>
  );
}
