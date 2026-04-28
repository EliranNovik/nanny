import { useState } from "react";
import { ProfilePostsFeed, ComposeModal, type ProfileSnippet } from "@/components/profile/ProfilePostsFeed";
import { PageFrame } from "@/components/page-frame";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Plus, Search, X, SortDesc, SortAsc } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function GlobalPostsPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [composeOpen, setComposeOpen] = useState(false);
  
  const [showTaggedMe, setShowTaggedMe] = useState(false);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [authorSearch, setAuthorSearch] = useState("");
  
  const authorProfile: ProfileSnippet | null = user ? {
    id: user.id,
    full_name: profile?.full_name ?? null,
    photo_url: profile?.photo_url ?? null,
  } : null;

  return (
    <PageFrame variant="fullBleed" className="bg-white dark:bg-black">
      {/* 
        Standard Flow Header: Not fixed, not sticky. 
        It will naturally scroll away as the user moves down the feed.
      */}
      <div className="border-b border-slate-200/60 bg-white dark:border-white/5 dark:bg-zinc-950">
        {/* Simple pro header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_-20%,rgba(249,115,22,0.08),transparent_55%)]" />
          <div className="app-desktop-shell relative z-10 px-4 pb-4 pt-8 md:px-4 md:pb-5 md:pt-10">
            <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
              <div className="min-w-0">
                <h1 className="truncate text-[22px] font-extrabold leading-tight tracking-tight text-slate-950 dark:text-white md:text-[26px]">
                  Community{" "}
                  <span className="text-orange-600 dark:text-orange-400">Pulse</span>
                </h1>
                <p className="mt-1 hidden text-sm font-medium text-slate-500 dark:text-slate-400 md:block">
                  Share updates, shout-outs, and quick wins.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    navigate("/login");
                    return;
                  }
                  setComposeOpen(true);
                }}
                className={cn(
                  "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-[12px] font-extrabold tracking-tight",
                  "bg-orange-600 text-white shadow-lg shadow-orange-500/15 transition-all",
                  "hover:bg-orange-700 active:scale-[0.98]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                  "dark:focus-visible:ring-offset-zinc-950",
                  "whitespace-nowrap",
                )}
              >
                <Plus className="h-4 w-4" strokeWidth={3} />
                Share a post
              </button>
            </div>
          </div>
        </div>

        {/* Ultra Compact Filter Row */}
        <div className="app-desktop-shell px-4 pb-4 md:px-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors" />
                <input 
                  type="text"
                  placeholder="Search @name…"
                  value={authorSearch}
                  onChange={(e) => setAuthorSearch(e.target.value)}
                  className={cn(
                    "h-10 w-full rounded-xl border border-slate-200/70 bg-white pl-10 pr-9 text-[12px] font-semibold text-slate-900",
                    "shadow-sm transition-colors",
                    "placeholder:text-slate-400",
                    "focus:outline-none focus:ring-2 focus:ring-orange-500/25",
                    "dark:border-white/10 dark:bg-zinc-950 dark:text-white dark:placeholder:text-white/40",
                  )}
                />
                {authorSearch && (
                  <button
                    type="button"
                    onClick={() => setAuthorSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-white"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 md:justify-end">
                {/* Tagged me check */}
                <div className="flex shrink-0 items-center gap-2">
                  <Switch 
                    id="tagged-me" 
                    checked={showTaggedMe} 
                    onCheckedChange={setShowTaggedMe}
                    className="scale-75 data-[state=checked]:bg-orange-600"
                  />
                  <Label htmlFor="tagged-me" className="cursor-pointer text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Tagged me
                  </Label>
                </div>
                
                {/* Sort Toggle */}
                <button
                  onClick={() => setSortOrder(prev => prev === "newest" ? "oldest" : "newest")}
                  className={cn(
                    "flex h-10 items-center gap-2 rounded-xl border border-slate-200/70 bg-white px-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-700 shadow-sm",
                    "hover:bg-slate-50 active:scale-[0.99]",
                    "dark:border-white/10 dark:bg-zinc-950 dark:text-white/85 dark:hover:bg-white/5",
                  )}
                >
                  {sortOrder === "newest" ? <SortDesc className="h-4 w-4 text-orange-500" /> : <SortAsc className="h-4 w-4 text-orange-500" />}
                  {sortOrder === "newest" ? "Newest" : "Oldest"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="app-desktop-shell py-6 md:py-8 px-0 md:px-4">
        <div className="max-w-3xl mx-auto">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <ProfilePostsFeed 
              filterTaggedUserId={showTaggedMe ? user?.id : undefined}
              authorNameFilter={authorSearch}
              sortOrder={sortOrder}
            />
          </div>
        </div>
      </div>

      {authorProfile && (
        <ComposeModal
          open={composeOpen}
          onClose={() => setComposeOpen(false)}
          onPosted={() => {
            window.location.reload(); 
          }}
          authorProfile={authorProfile}
        />
      )}
    </PageFrame>
  );
}
