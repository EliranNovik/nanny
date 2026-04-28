import { useState } from "react";
import { ProfilePostsFeed, ComposeModal, type ProfileSnippet } from "@/components/profile/ProfilePostsFeed";
import { PageFrame } from "@/components/page-frame";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Plus, Search, X, SortDesc, SortAsc } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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
      <div className="bg-white dark:bg-zinc-950 border-b border-slate-200/60 dark:border-white/5">
        {/* Super Compact Hero Section */}
        <div className="relative overflow-hidden pt-10 md:pt-12 pb-4 md:pb-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#f9731608,#00000000)]" />
          
          <div className="app-desktop-shell relative z-10 px-4 md:px-4">
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex-1 min-w-0">
                 <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                  Community <span className="text-orange-600 dark:orange-500 underline decoration-orange-500/20 underline-offset-4">Pulse</span>
                </h1>
              </div>
              
              <div className="shrink-0 flex items-center gap-3">
                 <button 
                  type="button"
                  onClick={() => {
                    if (!user) { navigate("/login"); return; }
                    setComposeOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-[11px] shadow-lg shadow-orange-500/10 transition-all active:scale-95"
                 >
                   <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                   Share a post
                 </button>
              </div>
            </div>
          </div>
        </div>

        {/* Ultra Compact Filter Row */}
        <div className="app-desktop-shell pb-3 px-4 md:px-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 p-1.5 md:rounded-2xl md:bg-slate-50/50 md:dark:bg-white/[0.02] md:border border-slate-200/50 dark:border-white/5">
              {/* Search Input */}
              <div className="relative flex-1 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                <input 
                  type="text"
                  placeholder="Search @name…"
                  value={authorSearch}
                  onChange={(e) => setAuthorSearch(e.target.value)}
                  className="w-full h-8 pl-9 pr-8 rounded-lg bg-slate-50 dark:bg-zinc-900 border-none text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-all"
                />
                {authorSearch && (
                  <button onClick={() => setAuthorSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-4 justify-between md:justify-end">
                {/* Tagged me check */}
                <div className="flex items-center space-x-2 shrink-0">
                  <Switch 
                    id="tagged-me" 
                    checked={showTaggedMe} 
                    onCheckedChange={setShowTaggedMe}
                    className="scale-75 data-[state=checked]:bg-orange-600"
                  />
                  <Label htmlFor="tagged-me" className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer">
                    Tagged me
                  </Label>
                </div>
                
                {/* Sort Toggle */}
                <button
                  onClick={() => setSortOrder(prev => prev === "newest" ? "oldest" : "newest")}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border-none text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                >
                  {sortOrder === "newest" ? <SortDesc className="h-3.5 w-3.5 text-orange-500" /> : <SortAsc className="h-3.5 w-3.5 text-orange-500" />}
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
