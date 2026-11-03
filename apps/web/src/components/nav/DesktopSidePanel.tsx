import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";
import {
  type LucideIcon,
  BadgeCheck,
  Bookmark,
  ChevronDown,
  UsersRound,
  Home,
  Rss,
  MessageCircle,
  User,
  LogOut,
  ExternalLink,
  Shield,
  CheckCircle2,
  BarChart3,
  Clock,
  Briefcase,
  Newspaper,
} from "lucide-react";
import { useAuthenticatedShellLayout } from "@/hooks/useAuthenticatedShellLayout";
import { useDesktopSidePanel } from "@/context/DesktopSidePanelContext";

type SavedProfileRow = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  is_verified?: boolean | null;
};
type SavedPostRow = { id: string; caption: string | null; authorName: string | null };

type NavItem = {
  id: "home" | "explore" | "messages" | "profile";
  labelKey: string;
  href: string;
  icon: LucideIcon;
  activeMatch: (pathname: string) => boolean;
};

export function isDesktopSidePanelExcludedRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/login") return true;
  if (pathname === "/onboarding") return true;
  if (pathname.startsWith("/onboarding/")) return true;
  if (pathname === "/about") return true;
  if (pathname === "/contact") return true;
  return false;
}

export function DesktopSidePanel() {
  const { t } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const { unreadMessages } = useUnreadCounts();
  const { collapsed } = useDesktopSidePanel();
  const { pathname, search } = useLocation();
  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
  const { showRail, whiteRail } = useAuthenticatedShellLayout({
    pathname,
    search,
    isAdmin: isAdminPage,
  });
  const isMessagesPage =
    pathname === "/messages" || pathname.startsWith("/messages/");
  /** Extra clearance under the fixed header on all pages except messages. */
  const insetFromHeader = !isAdminPage && !isMessagesPage;
  /** Messages always uses the compact icon-over-label rail. */
  const iconRail = !isAdminPage && (collapsed || isMessagesPage);
  const railBg = isAdminPage
    ? "bg-zinc-100 dark:bg-zinc-950"
    : whiteRail
      ? "bg-white dark:bg-background"
      : "bg-[#F2F2F7] dark:bg-background";
  const navHover = whiteRail
    ? "hover:bg-zinc-100 dark:hover:bg-white/10"
    : "hover:bg-white/90 dark:hover:bg-white/10";
  const navActive = whiteRail
    ? "bg-zinc-100 text-foreground dark:bg-white/10"
    : "bg-white text-foreground shadow-sm dark:bg-white/10 dark:shadow-none";
  const navigate = useNavigate();
  const mountedRef = useRef(false);
  const [savedProfilesOpen, setSavedProfilesOpen] = useState(true);
  const [savedPostsOpen, setSavedPostsOpen] = useState(true);
  const [savedProfiles, setSavedProfiles] = useState<SavedProfileRow[]>([]);
  const [savedPosts, setSavedPosts] = useState<SavedPostRow[]>([]);
  const [savedProfilesLoading, setSavedProfilesLoading] = useState(false);
  const [savedPostsLoading, setSavedPostsLoading] = useState(false);

  // NOTE: Don't early-return before hooks below (hook order must not change across renders).
  const roleBase =
    profile?.role === "freelancer" ? "/freelancer" : "/client";
  const homeHref = `${roleBase}/home`;
  const communityHref = "/community/feed";
  /** Explore now opens the community feed (the full Explore page is reachable via the Profile hub). */
  const exploreHref = communityHref;
  const messagesHref = "/messages";
  const profileHubHref =
    profile?.role === "freelancer"
      ? "/freelancer/profile"
      : "/client/profile";
  const profileHref = profile?.id
    ? `/profile/${profile.id}`
    : profileHubHref;
  const savedHref = `${roleBase}/profile/saved`;

  const openSaved = (tab: "profiles" | "posts") => {
    navigate(`${savedHref}?tab=${tab}`);
  };

  const items: NavItem[] = [
    {
      id: "home",
      labelKey: "common.home",
      href: homeHref,
      icon: Home,
      activeMatch: (p) => p.startsWith(homeHref),
    },
    {
      id: "explore",
      labelKey: "common.explore",
      href: exploreHref,
      icon: Rss,
      activeMatch: (p) =>
        p.startsWith("/community") || p.startsWith("/public/posts"),
    },
    {
      id: "messages",
      labelKey: "common.messages",
      href: messagesHref,
      icon: MessageCircle,
      activeMatch: (p) => p.startsWith("/messages"),
    },
    {
      id: "profile",
      labelKey: "common.profile",
      href: profileHref,
      icon: User,
      activeMatch: (p) =>
        profile?.id
          ? p === `/profile/${profile.id}` ||
            p.startsWith(`/profile/${profile.id}/`)
          : p.startsWith(profileHubHref),
    },
  ];

  const adminItems = [
    {
      id: "admin-home",
      label: "Admin Overview",
      href: "/admin",
      icon: Shield,
      activeMatch: (p: string) => p === "/admin" || p.startsWith("/admin?"),
    },
    {
      id: "admin-active",
      label: "Active Jobs",
      href: "/admin/jobs/active",
      icon: Briefcase,
      activeMatch: (p: string) => p.startsWith("/admin/jobs/active"),
    },
    {
      id: "admin-requested",
      label: "Requested Jobs",
      href: "/admin/jobs/requested",
      icon: Clock,
      activeMatch: (p: string) => p.startsWith("/admin/jobs/requested"),
    },
    {
      id: "admin-completed",
      label: "Completed Jobs",
      href: "/admin/jobs/completed",
      icon: CheckCircle2,
      activeMatch: (p: string) => p.startsWith("/admin/jobs/completed"),
    },
    {
      id: "admin-users",
      label: "Users Registry",
      href: "/admin/users",
      icon: UsersRound,
      activeMatch: (p: string) => p.startsWith("/admin/users"),
    },
    {
      id: "admin-stats",
      label: "Platform Stats",
      href: "/admin/statistics",
      icon: BarChart3,
      activeMatch: (p: string) => p.startsWith("/admin/statistics"),
    },
    {
      id: "admin-posts",
      label: "Posts Management",
      href: "/admin/posts",
      icon: Newspaper,
      activeMatch: (p: string) => p.startsWith("/admin/posts"),
    },
  ];

  const savedProfilesEnabled = Boolean(user?.id) && !isAdminPage;
  const savedPostsEnabled = Boolean(user?.id) && !isAdminPage;

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
  if (isDesktopSidePanelExcludedRoute(pathname)) return null;
  if (!isAdminPage && !showRail) return null;

  if (iconRail) {
    return (
      <aside
        className={cn(
          "app-desktop-side-panel app-tablet-nav-rail !w-[76px] flex flex-col items-center overflow-hidden border-0 shadow-none",
          railBg,
        )}
      >
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto overscroll-contain px-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            insetFromHeader ? "pb-3 pt-16" : "py-3",
          )}
        >
          <nav className="flex w-full flex-col items-center gap-1">
            {items.map((it) => {
              const active = it.activeMatch(pathname);
              const Icon = it.icon;
              const isProfileRow = it.id === "profile";
              const label = t(it.labelKey);
              return (
                <Link
                  key={it.href}
                  to={it.href}
                  className={cn(
                    "group relative flex w-full flex-col items-center gap-1 rounded-xl px-0.5 py-1.5 transition-colors",
                    navHover,
                    active ? navActive : "text-zinc-800 dark:text-zinc-100",
                  )}
                  aria-current={active ? "page" : undefined}
                  aria-label={label}
                >
                  {active ? (
                    <span
                      className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-orange-500"
                      aria-hidden
                    />
                  ) : null}
                  <span className="relative flex h-7 w-7 items-center justify-center">
                    {isProfileRow ? (
                      <Avatar
                        className={cn(
                          "h-7 w-7 shrink-0 border transition-[box-shadow,ring-color] duration-300",
                          active
                            ? "border-transparent ring-2 ring-orange-500"
                            : "border-black/10 dark:border-white/15",
                        )}
                      >
                        <AvatarImage
                          src={profile?.photo_url ?? undefined}
                          alt=""
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-slate-100 text-[10px] font-bold text-zinc-900 dark:bg-zinc-800 dark:text-white">
                          {(profile?.full_name ?? user?.email ?? "U")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <Icon
                        className={cn(
                          "h-6 w-6 shrink-0 transition-colors",
                          active
                            ? "text-orange-600 dark:text-orange-400"
                            : "text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300",
                        )}
                        strokeWidth={2.15}
                      />
                    )}
                    {it.id === "messages" && unreadMessages > 0 ? (
                      <Badge
                        variant="destructive"
                        className="absolute -right-2 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black tabular-nums shadow-sm"
                      >
                        {unreadMessages > 9 ? "9+" : unreadMessages}
                      </Badge>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      "w-full text-center text-[10px] font-semibold leading-[1.15] tracking-tight",
                      active
                        ? "text-foreground"
                        : "text-zinc-800 dark:text-zinc-100",
                    )}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {profile?.is_admin && (
            <nav className="mt-2 flex w-full flex-col items-center gap-1 border-t border-border/40 pt-2">
              {adminItems.map((it) => {
                const active = it.activeMatch(pathname);
                const Icon = it.icon;
                return (
                  <Link
                    key={it.href}
                    to={it.href}
                    className={cn(
                      "group relative flex w-full flex-col items-center gap-1 rounded-xl px-0.5 py-1.5 transition-colors",
                      "hover:bg-white/90 dark:hover:bg-white/10",
                      active
                        ? "bg-white text-foreground shadow-sm dark:bg-white/10 dark:shadow-none"
                        : "text-zinc-800 dark:text-zinc-100",
                    )}
                    aria-label={it.label}
                  >
                    {active ? (
                      <span
                        className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-orange-500"
                        aria-hidden
                      />
                    ) : null}
                    <Icon
                      className={cn(
                        "h-5 w-5 shrink-0 transition-colors",
                        active
                          ? "text-orange-600 dark:text-orange-400"
                          : "text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500",
                      )}
                      strokeWidth={2.15}
                    />
                    <span
                      className={cn(
                        "w-full text-center text-[10px] font-semibold leading-[1.15] tracking-tight",
                        active ? "text-foreground" : "text-zinc-800 dark:text-zinc-100",
                      )}
                    >
                      {it.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          )}

          {!isMessagesPage ? (
            <div className={cn("mt-auto w-full flex-col items-center gap-1 py-2", isAdminPage ? "hidden" : "flex")}>
              <button
                type="button"
                onClick={() => openSaved("profiles")}
                className="flex w-full flex-col items-center gap-1 px-0.5 py-1.5 text-zinc-800 transition-colors hover:opacity-90 dark:text-zinc-100"
                aria-label={t("nav.savedProfiles")}
              >
                <Bookmark className="h-5 w-5 text-zinc-400 dark:text-zinc-500" strokeWidth={2.25} />
                <span className="w-full text-center text-[10px] font-semibold leading-[1.15] tracking-tight">
                  {t("nav.savedProfiles")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => openSaved("posts")}
                className="flex w-full flex-col items-center gap-1 px-0.5 py-1.5 text-zinc-800 transition-colors hover:opacity-90 dark:text-zinc-100"
                aria-label={t("nav.savedPosts")}
              >
                <Bookmark className="h-5 w-5 fill-zinc-400 text-zinc-400 dark:fill-zinc-500 dark:text-zinc-500" strokeWidth={2.25} />
                <span className="w-full text-center text-[10px] font-semibold leading-[1.15] tracking-tight">
                  {t("nav.savedPosts")}
                </span>
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex w-full shrink-0 flex-col items-center gap-1 border-t border-border/10 p-2">
          <button
            type="button"
            onClick={async () => {
              await signOut();
            }}
            className={cn(
              "flex w-full flex-col items-center gap-1 px-0.5 py-1.5 transition-colors",
              "text-red-600 hover:opacity-90 active:scale-[0.98]",
            )}
            aria-label={t("common.logOut")}
          >
            <LogOut className="h-6 w-6 shrink-0 text-red-400" strokeWidth={2.15} />
            <span className="w-full text-center text-[10px] font-semibold leading-[1.15] tracking-tight">
              {t("common.logOut")}
            </span>
          </button>
          <Link
            to="/"
            className="flex w-full flex-col items-center gap-1 px-0.5 py-1.5 text-zinc-500 transition-colors hover:text-zinc-800 hover:opacity-90 dark:text-zinc-400 dark:hover:text-zinc-100"
            aria-label={t("messagesPage.goHome")}
            title={t("messagesPage.goHome")}
          >
            <ExternalLink className="h-5 w-5 shrink-0" strokeWidth={2.15} />
            <span className="w-full text-center text-[10px] font-semibold leading-[1.15] tracking-tight">
              {t("common.home")}
            </span>
          </Link>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "app-desktop-side-panel flex flex-col border-0 shadow-none",
        railBg,
      )}
    >
      {/* Independent scroll: panel content scrolls without moving the page */}
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          insetFromHeader ? "pt-16" : "pt-3",
        )}
      >

        <div className="mt-2 flex flex-col">
          <nav className="flex w-full flex-col items-stretch gap-1">
            {items.map((it) => {
              const active = it.activeMatch(pathname);
              const Icon = it.icon;
              const isProfileRow = it.id === "profile";
              const label = t(it.labelKey);
              return (
                <Link
                  key={it.href}
                  to={it.href}
                  className={cn(
                    "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                    navHover,
                    active ? navActive : "text-zinc-800 dark:text-zinc-100",
                  )}
                  aria-current={active ? "page" : undefined}
                  title={label}
                >
                  {active ? (
                    <span
                      className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-orange-500"
                      aria-hidden
                    />
                  ) : null}
                  {isProfileRow ? (
                    <Avatar
                      className={cn(
                        "h-7 w-7 shrink-0 border transition-[box-shadow,ring-color] duration-300",
                        active
                          ? "border-transparent ring-2 ring-orange-500"
                          : "border-black/10 dark:border-white/15",
                      )}
                    >
                      <AvatarImage
                        src={profile?.photo_url ?? undefined}
                        alt=""
                        className="object-cover"
                      />
                      <AvatarFallback className="text-[10px] font-bold bg-slate-100 text-zinc-900 dark:bg-zinc-800 dark:text-white">
                        {(profile?.full_name ?? user?.email ?? "U")
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <Icon
                      className={cn(
                        "h-6 w-6 shrink-0 transition-colors",
                        active
                          ? "text-orange-600 dark:text-orange-400"
                          : "text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300",
                      )}
                      strokeWidth={2.15}
                    />
                  )}
                  <span
                    className={cn(
                      "text-[13px] font-semibold leading-none tracking-tight",
                      active
                        ? "text-foreground"
                        : "text-zinc-800 dark:text-zinc-100",
                    )}
                  >
                    {label}
                  </span>
                  {it.id === "messages" && unreadMessages > 0 && (
                    <Badge
                      variant="destructive"
                      className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black tabular-nums shadow-sm"
                    >
                      {unreadMessages > 9 ? "9+" : unreadMessages}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>

          {profile?.is_admin && (
            <div className="mt-4 pt-4 border-t border-border/40">
              <div className="px-3 mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/80">
                  Administration
                </span>
              </div>
              <nav className="flex w-full flex-col items-stretch gap-1">
                {adminItems.map((it) => {
                  const active = it.activeMatch(pathname);
                  const Icon = it.icon;
                  return (
                    <Link
                      key={it.href}
                      to={it.href}
                      className={cn(
                        "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                        "hover:bg-white/90 dark:hover:bg-white/10",
                        active
                          ? "bg-white text-foreground shadow-sm dark:bg-white/10 dark:shadow-none"
                          : "text-zinc-800 dark:text-zinc-100",
                      )}
                      title={it.label}
                    >
                      {active ? (
                        <span
                          className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-orange-500"
                          aria-hidden
                        />
                      ) : null}
                      <Icon
                        className={cn(
                          "h-5 w-5 shrink-0 transition-colors",
                          active
                            ? "text-orange-600 dark:text-orange-400"
                            : "text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500",
                        )}
                        strokeWidth={2.15}
                      />
                      <span
                        className={cn(
                          "text-[13px] font-semibold leading-none tracking-tight",
                          active ? "text-foreground" : "text-zinc-800 dark:text-zinc-100",
                        )}
                      >
                        {it.label}
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}

          <div className={cn("mt-auto pt-4", isAdminPage && "hidden")}>
              {/* Saved profiles */}
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-[12px] font-semibold uppercase tracking-wide text-zinc-800 hover:opacity-90 dark:text-zinc-100"
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
                  <Bookmark className="h-4 w-4 text-zinc-400 dark:text-zinc-500" strokeWidth={2.25} />
                  {t("nav.savedProfiles")}
                </span>
                <ChevronDown className={cn("h-4 w-4 text-zinc-400 transition-transform dark:text-zinc-500", savedProfilesOpen && "rotate-180")} />
              </button>
              {savedProfilesOpen ? (
                <div className="mt-1 space-y-1 px-1 pb-1">
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
                        className="flex items-center gap-2 px-2 py-2 text-[13px] font-semibold text-foreground hover:text-foreground/80"
                      >
                        <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted/60">
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

              {/* Saved posts */}
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-[12px] font-semibold uppercase tracking-wide text-zinc-800 hover:opacity-90 dark:text-zinc-100"
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
                  <Bookmark className="h-4 w-4 text-zinc-400 dark:text-zinc-500" strokeWidth={2.25} />
                  {t("nav.savedPosts")}
                </span>
                <ChevronDown className={cn("h-4 w-4 text-zinc-400 transition-transform dark:text-zinc-500", savedPostsOpen && "rotate-180")} />
              </button>
              {savedPostsOpen ? (
                <div className="mt-1 space-y-1 px-1 pb-1">
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
                        className="w-full px-2 py-2 text-left hover:opacity-80"
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
      <div className="flex shrink-0 items-center gap-1 border-t border-border/10 p-3">
        <button
          type="button"
          onClick={async () => {
            await signOut();
          }}
          className={cn(
            "group flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 transition-colors",
            "text-red-600 hover:opacity-90 active:scale-[0.98]",
          )}
          aria-label={t("common.logOut")}
        >
          <LogOut className="h-6 w-6 shrink-0 text-red-400" strokeWidth={2.15} />
          <span className="truncate text-[13px] font-semibold leading-none tracking-tight">
            {t("common.logOut")}
          </span>
        </button>
        <Link
          to="/"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-black/[0.04] hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100"
          aria-label={t("messagesPage.goHome")}
          title={t("messagesPage.goHome")}
        >
          <ExternalLink className="h-5 w-5" strokeWidth={2.15} />
        </Link>
      </div>
    </aside>
  );
}

