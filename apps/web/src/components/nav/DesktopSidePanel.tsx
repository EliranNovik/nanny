import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import {
  type LucideIcon,
  Plus,
  ClipboardList,
  BadgeCheck,
  Bookmark,
  ChevronDown,
  UsersRound,
  Radio,
  Home,
  Rss,
  MessageCircle,
  CalendarDays,
  User,
  LayoutGrid,
} from "lucide-react";

type SavedProfileRow = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  is_verified?: boolean | null;
};
type SavedPostRow = { id: string; caption: string | null; authorName: string | null };

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  activeMatch: (pathname: string) => boolean;
};

function isExcludedRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/login") return true;
  if (pathname === "/onboarding") return true;
  if (pathname.startsWith("/onboarding/")) return true;
  if (pathname === "/about") return true;
  if (pathname === "/contact") return true;
  return false;
}

export function DesktopSidePanel() {
  const { user, profile } = useAuth();
  const { unreadMessages } = useUnreadCounts();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const mountedRef = useRef(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [savedProfilesOpen, setSavedProfilesOpen] = useState(true);
  const [savedPostsOpen, setSavedPostsOpen] = useState(false);
  const [savedProfiles, setSavedProfiles] = useState<SavedProfileRow[]>([]);
  const [savedPosts, setSavedPosts] = useState<SavedPostRow[]>([]);
  const [savedProfilesLoading, setSavedProfilesLoading] = useState(false);
  const [savedPostsLoading, setSavedPostsLoading] = useState(false);

  // NOTE: Don't early-return before hooks below (hook order must not change across renders).
  const roleBase =
    profile?.role === "freelancer" ? "/freelancer" : "/client";
  const homeHref = `${roleBase}/home`;
  const exploreHref = `${roleBase}/explore`;
  const jobsHref = "/jobs";
  const calendarHref = "/calendar";
  const messagesHref = "/messages";
  const profileHref =
    profile?.role === "freelancer"
      ? "/freelancer/profile"
      : "/client/profile";
  const communityHref = "/community/feed";
  const requestHref = "/client/create";
  const goLiveHref = "/availability/post-now";
  const savedHref = `${roleBase}/profile/saved`;

  const openSaved = (tab: "profiles" | "posts") => {
    navigate(`${savedHref}?tab=${tab}`);
  };

  const canCreateRequest = profile?.role === "client";

  const items: NavItem[] = [
    {
      label: "Home",
      href: homeHref,
      icon: Home,
      activeMatch: (p) => p.startsWith(homeHref),
    },
    {
      label: "Explore",
      href: exploreHref,
      icon: Rss,
      activeMatch: (p) => p.startsWith(exploreHref),
    },
    {
      label: "Messages",
      href: messagesHref,
      icon: MessageCircle,
      activeMatch: (p) => p.startsWith("/messages"),
    },
    {
      label: "Jobs",
      href: jobsHref,
      icon: ClipboardList,
      activeMatch: (p) => p.startsWith("/jobs") || p.startsWith("/client/jobs") || p.startsWith("/freelancer/jobs"),
    },
    {
      label: "Calendar",
      href: calendarHref,
      icon: CalendarDays,
      activeMatch: (p) => p.startsWith("/calendar"),
    },
    {
      label: "Community",
      href: communityHref,
      icon: LayoutGrid,
      activeMatch: (p) => p.startsWith("/community") || p.startsWith("/public/posts"),
    },
    {
      label: "Profile",
      href: profileHref,
      icon: User,
      activeMatch: (p) => p.startsWith(profileHref),
    },
  ];

  const savedProfilesEnabled = Boolean(user?.id);
  const savedPostsEnabled = Boolean(user?.id);

  const savedProfilesShort = useMemo(() => savedProfiles.slice(0, 8), [savedProfiles]);
  const savedPostsShort = useMemo(() => savedPosts.slice(0, 8), [savedPosts]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadSavedProfiles = useCallback(async () => {
    if (!user?.id) return;
    if (savedProfilesLoading) return;
    setSavedProfilesLoading(true);
    try {
      const favRes = await supabase
        .from("profile_favorites")
        .select("favorite_user_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (favRes.error) throw favRes.error;
      const ids = (favRes.data ?? []).map((r: any) => r.favorite_user_id as string);
      if (ids.length === 0) {
        if (mountedRef.current) setSavedProfiles([]);
        return;
      }
      const profRes = await supabase
        .from("profiles")
        .select("id, full_name, photo_url, is_verified")
        .in("id", ids);
      if (profRes.error) throw profRes.error;
      const byId = new Map((profRes.data ?? []).map((p: any) => [p.id as string, p]));
      const ordered: SavedProfileRow[] = [];
      for (const id of ids) {
        const p = byId.get(id);
        if (p)
          ordered.push({
            id: p.id,
            full_name: p.full_name ?? null,
            photo_url: p.photo_url ?? null,
            is_verified: p.is_verified ?? null,
          });
      }
      if (mountedRef.current) setSavedProfiles(ordered);
    } catch {
      if (mountedRef.current) setSavedProfiles([]);
    } finally {
      if (mountedRef.current) setSavedProfilesLoading(false);
    }
  }, [savedProfilesLoading, user?.id]);

  useEffect(() => {
    if (savedProfilesOpen && savedProfilesEnabled && savedProfiles.length === 0) {
      void loadSavedProfiles();
    }
  }, [loadSavedProfiles, savedProfiles.length, savedProfilesEnabled, savedProfilesOpen]);

  const loadSavedPosts = useCallback(async () => {
    if (!user?.id) return;
    if (savedPostsLoading) return;
    setSavedPostsLoading(true);
    try {
      const favRes = await supabase
        .from("profile_post_likes")
        .select("post_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (favRes.error) throw favRes.error;
      const ids = (favRes.data ?? []).map((r: any) => r.post_id as string);
      if (ids.length === 0) {
        if (mountedRef.current) setSavedPosts([]);
        return;
      }
      const postRes = await supabase
        .from("profile_posts")
        .select("id, caption, author_id")
        .in("id", ids);
      if (postRes.error) throw postRes.error;
      const postsRaw = postRes.data ?? [];
      const byId = new Map((postsRaw as any[]).map((p) => [p.id as string, p]));
      const authorIds = [...new Set((postsRaw as any[]).map((p) => p.author_id as string).filter(Boolean))];
      const authorMap = new Map<string, string>();
      if (authorIds.length > 0) {
        const authorRes = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", authorIds);
        if (!authorRes.error) {
          for (const a of authorRes.data ?? []) {
            authorMap.set((a as any).id as string, ((a as any).full_name as string) ?? "");
          }
        }
      }
      const ordered: SavedPostRow[] = [];
      for (const id of ids) {
        const p = byId.get(id);
        if (!p) continue;
        const authorName = p.author_id ? authorMap.get(p.author_id) ?? null : null;
        ordered.push({ id: p.id, caption: p.caption ?? null, authorName });
      }
      if (mountedRef.current) setSavedPosts(ordered);
    } catch {
      if (mountedRef.current) setSavedPosts([]);
    } finally {
      if (mountedRef.current) setSavedPostsLoading(false);
    }
  }, [savedPostsLoading, user?.id]);

  // After all hooks: decide whether to render.
  if (!user || !profile) return null;
  if (isExcludedRoute(pathname)) return null;

  return (
    <aside
      className={cn(
        "hidden md:flex fixed left-0 top-0 bottom-0 z-[200] w-[220px] flex-col",
        "border-r border-border/30 bg-background/80 supports-[backdrop-filter]:bg-background/60 backdrop-blur-xl",
      )}
    >
      {/* Independent scroll: panel content scrolls without moving the page */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-4 pb-6">
        <div className="relative mb-1 flex items-center gap-3 rounded-2xl bg-muted/40 px-3 py-2 text-foreground">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted/70">
            <img
              src={encodeURI("/ChatGPT Image May 4, 2026, 04_03_41 PM.png")}
              alt="Tebnu"
              className="h-full w-full object-cover"
              loading="eager"
              decoding="async"
            />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-black leading-tight tracking-tight">
              Tebnu
            </div>
            <div className="truncate text-[11px] font-semibold text-muted-foreground">
              Quick access
            </div>
          </div>

          <button
            type="button"
            onClick={() => setPlusOpen((v) => !v)}
            className={cn(
              "ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
              "bg-background/80 text-foreground ring-1 ring-border/50 shadow-sm backdrop-blur-md transition-colors",
              "hover:bg-background active:scale-[0.98]",
            )}
            aria-label="Create"
            aria-expanded={plusOpen}
            aria-haspopup="menu"
          >
            <Plus className="h-5 w-5" strokeWidth={2.8} />
          </button>

          {plusOpen ? (
            <>
              <div
                className="fixed inset-0 z-[140]"
                onClick={() => setPlusOpen(false)}
              />
              <div
                role="menu"
                className={cn(
                  "absolute right-2 top-[calc(100%+10px)] z-[150] w-[14.5rem] overflow-hidden rounded-2xl border border-border/40",
                  "bg-background/90 backdrop-blur-xl shadow-xl",
                )}
              >
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] font-bold text-foreground hover:bg-muted/50 active:bg-muted/70"
                  onClick={() => {
                    setPlusOpen(false);
                    if (canCreateRequest) navigate(requestHref);
                    else navigate(goLiveHref);
                  }}
                >
                  <ClipboardList className="h-5 w-5 shrink-0 text-foreground/80" />
                  <span>{canCreateRequest ? "Start request" : "Go live"}</span>
                </button>
                <div className="h-px w-full bg-border/30" />
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] font-bold text-foreground hover:bg-muted/50 active:bg-muted/70"
                  onClick={() => {
                    setPlusOpen(false);
                    navigate(goLiveHref);
                  }}
                >
                  <UsersRound className="h-5 w-5 shrink-0 text-foreground/80" />
                  <span>Go live</span>
                </button>
                <div className="h-px w-full bg-border/30" />
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] font-bold text-foreground hover:bg-muted/50 active:bg-muted/70"
                  onClick={() => {
                    setPlusOpen(false);
                    navigate(communityHref);
                  }}
                >
                  <Radio className="h-5 w-5 shrink-0 text-foreground/80" />
                  <span>Community posts</span>
                </button>
              </div>
            </>
          ) : null}
        </div>

        <div className="mt-2 flex flex-col">
          <nav className="flex w-full flex-col items-stretch gap-1">
            {items.map((it) => {
              const active = it.activeMatch(pathname);
              const Icon = it.icon;
              return (
                <Link
                  key={it.href}
                  to={it.href}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors",
                    "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                    active && "bg-muted/70 text-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                  title={it.label}
                >
                  <Icon className="h-6 w-6 shrink-0" strokeWidth={2.4} />
                  <span className="text-[13px] font-bold leading-none tracking-tight">
                    {it.label}
                  </span>
                  {it.label === "Messages" && unreadMessages > 0 && (
                    <Badge
                      variant="destructive"
                      className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black tabular-nums shadow-sm"
                    >
                      {unreadMessages > 9 ? "9+" : unreadMessages}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-4">
            <div className="h-px w-full bg-border/30" />
            <div className="mt-3 rounded-2xl bg-muted/20 p-2">
              {/* Saved profiles */}
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-[12px] font-black uppercase tracking-wide text-foreground/90 hover:bg-muted/35"
                onClick={() => {
                  setSavedProfilesOpen((v) => {
                    const next = !v;
                    if (next && savedProfilesEnabled && savedProfiles.length === 0) {
                      void loadSavedProfiles();
                    }
                    return next;
                  });
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <Bookmark className="h-4 w-4" strokeWidth={2.6} />
                  Saved profiles
                </span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", savedProfilesOpen && "rotate-180")} />
              </button>
              {savedProfilesOpen ? (
                <div className="mt-1 space-y-1 px-1 pb-1">
                  <button
                    type="button"
                    className="w-full rounded-lg px-2 py-1.5 text-left text-[13px] font-semibold text-muted-foreground hover:bg-muted/35 hover:text-foreground"
                    onClick={() => openSaved("profiles")}
                  >
                    View all
                  </button>
                  {savedProfilesLoading ? (
                    <div className="px-2 py-2 text-xs font-semibold text-muted-foreground">
                      Loading…
                    </div>
                  ) : savedProfilesShort.length === 0 ? (
                    <div className="px-2 py-2 text-xs font-semibold text-muted-foreground">
                      No saved profiles
                    </div>
                  ) : (
                    savedProfilesShort.map((p) => (
                      <Link
                        key={p.id}
                        to={`/profile/${p.id}`}
                        className="flex items-center gap-2 rounded-xl px-2 py-2 text-[13px] font-semibold text-foreground hover:bg-muted/35"
                      >
                        <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted/60 ring-1 ring-border/30">
                          {p.photo_url ? (
                            <img
                              src={p.photo_url}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-[12px] font-black text-foreground/80">
                              {(p.full_name ?? "?").trim().charAt(0).toUpperCase()}
                            </span>
                          )}
                        </span>
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate">{p.full_name ?? "Profile"}</span>
                          {p.is_verified ? (
                            <BadgeCheck
                              className="h-4 w-4 shrink-0"
                              fill="#0ea5e9"
                              color="#ffffff"
                              aria-label="Verified"
                            />
                          ) : null}
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              ) : null}

              <div className="my-2 h-px w-full bg-border/30" />

              {/* Saved posts */}
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-[12px] font-black uppercase tracking-wide text-foreground/90 hover:bg-muted/35"
                onClick={() => {
                  setSavedPostsOpen((v) => {
                    const next = !v;
                    if (next && savedPostsEnabled && savedPosts.length === 0) {
                      void loadSavedPosts();
                    }
                    return next;
                  });
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <Bookmark className="h-4 w-4" strokeWidth={2.6} />
                  Saved posts
                </span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", savedPostsOpen && "rotate-180")} />
              </button>
              {savedPostsOpen ? (
                <div className="mt-1 space-y-1 px-1 pb-1">
                  <button
                    type="button"
                    className="w-full rounded-lg px-2 py-1.5 text-left text-[13px] font-semibold text-muted-foreground hover:bg-muted/35 hover:text-foreground"
                    onClick={() => openSaved("posts")}
                  >
                    View all
                  </button>
                  {savedPostsLoading ? (
                    <div className="px-2 py-2 text-xs font-semibold text-muted-foreground">
                      Loading…
                    </div>
                  ) : savedPostsShort.length === 0 ? (
                    <div className="px-2 py-2 text-xs font-semibold text-muted-foreground">
                      No saved posts
                    </div>
                  ) : (
                    savedPostsShort.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full rounded-xl px-2 py-2 text-left hover:bg-muted/35"
                        onClick={() => openSaved("posts")}
                      >
                        <div className="truncate text-[13px] font-semibold text-foreground">
                          {p.caption?.trim() ? p.caption : "Saved post"}
                        </div>
                        <div className="truncate text-[11px] font-semibold text-muted-foreground">
                          {p.authorName ? `by ${p.authorName}` : " "}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

