import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ChevronLeft, Loader2, Search, X, Sparkles } from "lucide-react";
import { useSmartSearch, type SmartResult } from "@/hooks/useSmartSearch";
import { Button } from "@/components/ui/button";
import { SearchResultItem } from "./SearchResultItem";

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenNotifications?: () => void;
};

export function MobileSmartSearchOverlay({
  open,
  onClose,
  onOpenNotifications,
}: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { results, loading, addRecent } = useSmartSearch(query);

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

  const handleSelect = (result: SmartResult) => {
    addRecent({
      id: result.id,
      kind: result.kind as any,
      title: result.title,
      subtitle: result.subtitle,
      to: result.to
    });
    navigate(result.to);
    onClose();
  };

  const handleAction = (action: string, result: SmartResult) => {
    if (action === "message") {
      navigate(`/chat/${result.id}`);
      onClose();
    }
  };

  const hasQuery = query.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-background md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <header
        className="shrink-0 border-b border-border/50 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
        style={{
          paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right))",
        }}
      >
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={onClose}
            aria-label="Close search"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search anything..."
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
              <Bell className="h-6 w-6" strokeWidth={2} />
            </Button>
          ) : null}
        </div>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-1 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
        style={{
          paddingLeft: "max(0.4rem, env(safe-area-inset-left))",
          paddingRight: "max(0.4rem, env(safe-area-inset-right))",
        }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">Searching...</p>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-6">
            {(() => {
              const groups: Record<string, SmartResult[]> = {};
              results.forEach(r => {
                const groupName = r.kind === "recent" ? "Recent" : (r.kind === "person" ? "People" : "Suggestions");
                if (!groups[groupName]) groups[groupName] = [];
                groups[groupName].push(r);
              });

              return Object.entries(groups).map(([groupName, groupItems]) => (
                <section key={groupName} className="space-y-1">
                  <h2 className="px-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-2">
                    {groupName}
                  </h2>
                  <div className="flex flex-col gap-1">
                    {groupItems.map(item => (
                      <SearchResultItem
                        key={item.id}
                        result={item}
                        query={query}
                        onSelect={handleSelect}
                        onAction={handleAction}
                        className="py-3.5 px-3"
                      />
                    ))}
                  </div>
                </section>
              ));
            })()}
          </div>
        ) : (
          <div className="py-20 px-8 text-center flex flex-col items-center">
             <div className="w-16 h-16 bg-muted rounded-3xl flex items-center justify-center mb-6">
                <Sparkles className="h-8 w-8 text-muted-foreground/40" />
             </div>
             <p className="text-base font-bold text-foreground mb-2">
                {hasQuery ? `No matches found` : "Start searching"}
             </p>
             <p className="text-sm text-muted-foreground leading-relaxed max-w-[240px]">
                {hasQuery ? `We couldn't find anything matching "${query}". Try a different term or category.` : "Find helpers, category shortcuts, actions, and frequent pages."}
             </p>
          </div>
        )}
      </div>
    </div>
  );
}
