import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ProfilePostsFeed, ComposeModal, type ProfileSnippet } from "@/components/profile/ProfilePostsFeed";
import { PageFrame } from "@/components/page-frame";
import { useAuth } from "@/context/AuthContext";
import { useGuestAuthPrompt } from "@/context/GuestAuthPromptContext";
import { useScrollToTopOnPathnameChange } from "@/hooks/useScrollToTopOnPathnameChange";
import { useMobileScrollDirectionHeaderHide } from "@/hooks/useMobileScrollDirectionHeaderHide";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { PanelRightClose, PanelRightOpen, Search, Send, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { debugProfilePostDeepLink } from "@/lib/profilePostDeepLinkDebug";
import { parseProfilePostShareId } from "@/lib/profilePostShare";
import { parseJobRequestShareId } from "@/lib/jobRequestShare";
import { LandingSiteHeader } from "@/components/LandingSiteHeader";
import { GuestCommunityFeedAside } from "@/components/GuestCommunityFeedAside";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";
import { TEBNU_JOIN_COMMUNITY_BUTTON_CLASS } from "@/lib/tebnuBrandButton";
import { MobileSnapBottomSheet } from "@/components/ui/MobileSnapBottomSheet";
import type { CommunityFeedPostTypeFilter } from "@/components/community/CommunityFeedHeader";
import {
  DEFAULT_COMMUNITY_FEED_ADVANCED_FILTERS,
  type CommunityFeedAdvancedFilters,
} from "@/lib/communityFeedFilters";
import {
  type CommunityFeedLocationState,
  parseCommunityFeedCategory,
  parseCommunityFeedTypeFilter,
} from "@/lib/communityFeedNav";
import { globalFeedMobileFeedAreaClass } from "@/lib/globalFeedPostUi";
import type { ViewerLocation } from "@/lib/globalFeedPostUi";
import { queryKeys } from "@/hooks/data/keys";
import {
  ALL_HELP_CATEGORY_ID,
  otherHelpSubcategoryLabel,
  type DiscoverHomeCategoryId,
} from "@/lib/serviceCategories";
import {
  FAVORITES_SIDE_PANEL_WIDTH_CLASS,
  FavoritesPostsSidePanel,
} from "@/components/discover/FavoritesPostsSidePanel";
import { useTabletViewport } from "@/hooks/useIsTabletViewport";

type FeedMainContentProps = {
  user: User | null;
  profile: {
    full_name?: string | null;
    photo_url?: string | null;
    city?: string | null;
    location_lat?: number | null;
    location_lng?: number | null;
  } | null;
  focusPostId: string | null;
  focusRequestId: string | null;
  onGuestFindHelp?: () => void;
  onGuestOfferHelp?: () => void;
  expandDiscoverLayout?: boolean;
  postTypeFilter: CommunityFeedPostTypeFilter;
  /** When set (e.g. request + offer), overrides single post-type filter for the main feed. */
  feedPostTypeIds?: string[] | null;
  commentedFilterActive: boolean;
  onCommentedFilterChange: (active: boolean) => void;
  acceptedFilterActive: boolean;
  onAcceptedFilterChange: (active: boolean) => void;
  advancedFilters: CommunityFeedAdvancedFilters;
  onAdvancedFiltersChange: (filters: CommunityFeedAdvancedFilters) => void;
  favoriteAuthorFilterId: string | null;
  onFavoriteAuthorFilterChange: (authorId: string | null) => void;
  scrollToPostId: string | null;
  onScrollToPostDone: () => void;
  viewerLocation: ViewerLocation | null;
  categoryFilter: DiscoverHomeCategoryId;
  onCategoryFilterChange: (id: DiscoverHomeCategoryId) => void;
  otherSubFilter: string | null;
  onOtherSubFilterChange: (id: string | null) => void;
  onSidePanelPostOpen?: (postId: string) => void;
  /** Guest global feed: grey main column + white cards on desktop light mode. */
  guestDesktopLightLayout?: boolean;
  guestSidebarOpen?: boolean;
  guestSidebarSiteNavVisible?: boolean;
  insightsPanelOpen?: boolean;
  insightsPanelLocked?: boolean;
  tabletLayout?: boolean;
  onInsightsPanelOpenChange?: (open: boolean) => void;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  onOpenSort?: () => void;
  /** Desktop: the search field has moved into the guest header. */
  searchDockedInHeader?: boolean;
  feedSortOrder?: "newest" | "oldest";
  rankingSort?: "most_liked" | "most_commented" | "most_shared" | "near_me" | null;
};

function GuestFeedSearchBar({
  value,
  onChange,
  onClear,
  onOpenSort,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onOpenSort?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-11 w-full items-center gap-2 rounded-full border-0 bg-zinc-100 px-4 shadow-none outline-none ring-0",
        "dark:bg-zinc-800",
        className,
      )}
    >
      <Search className="h-5 w-5 shrink-0 text-orange-500" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search people or keywords"
        className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground"
      />
      {value ? (
        <button type="button" onClick={onClear} className="text-muted-foreground" aria-label="Clear search">
          <X className="h-4 w-4" />
        </button>
      ) : null}
      <button
        type="button"
        onClick={onOpenSort}
        className="flex h-9 w-9 items-center justify-center text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
        aria-label="Sort posts"
      >
        <SlidersHorizontal className="h-5 w-5" />
      </button>
    </div>
  );
}

/** Reserves the column in the centered row, while the list itself stays fixed and scrolls alone. */
function GuestFixedInsightsColumn({ children }: { children: ReactNode }) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ left: 0, width: 0, ready: false });

  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const measure = () => {
      const rect = slot.getBoundingClientRect();
      setFrame((current) => {
        const next = { left: rect.left, width: rect.width, ready: rect.width > 0 };
        if (
          current.ready === next.ready &&
          Math.abs(current.left - next.left) < 0.5 &&
          Math.abs(current.width - next.width) < 0.5
        ) {
          return current;
        }
        return next;
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(slot);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <>
      <div
        ref={slotRef}
        className={cn("hidden shrink-0 md:block", FAVORITES_SIDE_PANEL_WIDTH_CLASS)}
        aria-hidden
      />
      <div
        className={cn(
          "fixed z-30 hidden min-h-0 flex-col overflow-x-hidden overflow-y-auto overscroll-contain md:flex",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "bg-white px-1 pb-6 pt-3 dark:bg-[#101214]",
          !frame.ready && "invisible",
        )}
        style={{
          top: "4.5rem",
          height: "calc(100dvh - 4.5rem)",
          left: frame.left,
          width: frame.width,
        }}
      >
        {children}
      </div>
    </>
  );
}

function FeedMainContent({
  user,
  focusPostId,
  focusRequestId,
  onGuestFindHelp,
  onGuestOfferHelp,
  expandDiscoverLayout = false,
  postTypeFilter,
  feedPostTypeIds = null,
  commentedFilterActive,
  acceptedFilterActive,
  advancedFilters,
  favoriteAuthorFilterId,
  scrollToPostId,
  onScrollToPostDone,
  viewerLocation,
  categoryFilter,
  otherSubFilter,
  onSidePanelPostOpen,
  guestDesktopLightLayout = false,
  guestSidebarOpen = false,
  guestSidebarSiteNavVisible = true,
  insightsPanelOpen = true,
  insightsPanelLocked = false,
  tabletLayout = false,
  onInsightsPanelOpenChange,
  searchQuery = "",
  onSearchQueryChange,
  onOpenSort,
  searchDockedInHeader = false,
  feedSortOrder = "newest",
  rankingSort = null,
}: FeedMainContentProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        !focusPostId && !focusRequestId && "animate-in fade-in slide-in-from-bottom-4 duration-1000",
        guestDesktopLightLayout && "md:flex md:w-full md:items-start",
      )}
    >
      {guestDesktopLightLayout ? (
        <GuestCommunityFeedAside
          expanded={guestSidebarOpen}
          showSiteNav={guestSidebarSiteNavVisible}
          onFindHelp={onGuestFindHelp}
          onOfferHelp={onGuestOfferHelp}
        />
      ) : null}
      <div
        className={cn(
          "md:flex md:items-start",
          guestDesktopLightLayout
            ? "md:min-w-0 md:flex-1 md:justify-center md:px-4 md:pb-8 md:pt-6 lg:px-8"
            : "md:gap-5 lg:gap-8 xl:gap-10",
        )}
      >
        <div
          className={cn(
            guestDesktopLightLayout
              ? "md:flex md:w-fit md:max-w-full md:items-start md:gap-6 lg:gap-10"
              : "contents",
          )}
        >
        <div
          className={cn(
            "min-w-0 w-full",
            guestDesktopLightLayout
              ? "md:w-[42rem] md:max-w-full md:shrink lg:w-[46rem] xl:w-[50rem] 2xl:w-[54rem]"
              : "md:flex-1 md:max-w-[42rem] lg:max-w-[46rem] xl:max-w-[50rem] 2xl:max-w-[54rem]",
            !guestDesktopLightLayout && globalFeedMobileFeedAreaClass,
          )}
        >
          <div
            data-guest-feed-search="flow"
            className={cn(
              "grid w-full px-2 transition-[grid-template-rows,opacity,margin] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] [overflow-anchor:none] motion-reduce:transition-none md:px-0",
              guestDesktopLightLayout && searchDockedInHeader
                ? "mb-5 md:pointer-events-none md:mb-0 md:grid-rows-[0fr] md:opacity-0"
                : "mb-5 grid-rows-[1fr] opacity-100",
            )}
            aria-hidden={guestDesktopLightLayout && searchDockedInHeader ? true : undefined}
          >
            <div className="overflow-hidden">
              <GuestFeedSearchBar
                value={searchQuery}
                onChange={(value) => onSearchQueryChange?.(value)}
                onClear={() => onSearchQueryChange?.("")}
                onOpenSort={onOpenSort}
                className="h-14 gap-3 px-5"
              />
            </div>
          </div>

          <ProfilePostsFeed
            appearance="discover"
            discoverSidePanel="favorites"
            focusPostId={focusPostId}
            focusRequestId={focusRequestId}
            expandDiscoverLayout={expandDiscoverLayout}
            filterPostTypeId={
              feedPostTypeIds?.length || postTypeFilter === "all"
                ? null
                : postTypeFilter
            }
            filterPostTypeIds={feedPostTypeIds}
            sidePanelPostTypeIds={[]}
            filterCommentedOwnPosts={commentedFilterActive}
            filterAcceptedRequests={acceptedFilterActive}
            filterAuthorId={favoriteAuthorFilterId ?? undefined}
            authorNameFilter={searchQuery || undefined}
            searchFilter={searchQuery || undefined}
            sortOrder={feedSortOrder}
            rankingSort={rankingSort}
            feedAdvancedFilters={advancedFilters}
            excludeOwnJobRequests={false}
            fixedFavoritesSidePanel={false}
            externalFavoritesSidePanel
            scrollToPostId={scrollToPostId}
            onScrollToPostDone={onScrollToPostDone}
            plainCards
            globalFeedLayout
            viewerLocation={viewerLocation}
            filterCategoryId={categoryFilter}
            filterOtherSubcategoryId={
              categoryFilter === "other_help" ? otherSubFilter : null
            }
            onSidePanelPostOpen={onSidePanelPostOpen}
            guestDesktopLightLayout={guestDesktopLightLayout}
          />
        </div>

        {guestDesktopLightLayout ? (
          <GuestFixedInsightsColumn>
            <FavoritesPostsSidePanel
              embedded
              flushWithPage
              postTypeIds={["community", "event"]}
              onPostOpen={onSidePanelPostOpen}
            />
          </GuestFixedInsightsColumn>
        ) : insightsPanelOpen ? (
          <>
            {/* Width spacer so the feed column doesn't sit under the fixed panel */}
            <div
              className={cn(
                "hidden shrink-0 md:block",
                FAVORITES_SIDE_PANEL_WIDTH_CLASS,
              )}
              aria-hidden
            />
            <div
              className={cn(
                "hidden min-h-0 flex-col overflow-y-auto overflow-x-hidden md:fixed md:end-0 md:top-16 md:z-30 md:flex",
                "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                FAVORITES_SIDE_PANEL_WIDTH_CLASS,
                "max-h-[calc(100dvh-4rem)] bg-white px-3 pe-3 pb-6 pt-3 dark:bg-background",
              )}
            >
              {!insightsPanelLocked ? (
                <div className="mb-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onInsightsPanelOpenChange?.(false)}
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-white/70 bg-white/75 text-zinc-700 shadow-sm backdrop-blur-xl transition-colors hover:bg-white dark:border-white/10 dark:bg-zinc-900/75 dark:text-zinc-100"
                    aria-label={t("feed.sidePanel.close", {
                      defaultValue: "Hide insights",
                    })}
                  >
                    <PanelRightClose className="h-6 w-6" strokeWidth={2.25} />
                  </button>
                </div>
              ) : null}
              <div className="min-h-0 w-full min-w-0 flex-1">
                <FavoritesPostsSidePanel
                  embedded
                  postTypeIds={user ? null : ["community", "event"]}
                  onPostOpen={onSidePanelPostOpen}
                />
              </div>
            </div>
          </>
        ) : null}

        {!guestDesktopLightLayout && tabletLayout && !insightsPanelOpen ? (
          <button
            type="button"
            onClick={() => onInsightsPanelOpenChange?.(true)}
            className="fixed end-5 top-20 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-white/70 bg-white/80 text-zinc-700 shadow-lg backdrop-blur-xl hover:bg-white dark:border-white/10 dark:bg-zinc-900/80 dark:text-zinc-100"
            aria-label={t("feed.sidePanel.open", {
              defaultValue: "Show insights",
            })}
          >
            <PanelRightOpen className="h-6 w-6" strokeWidth={2.25} />
          </button>
        ) : null}
        </div>
      </div>
    </div>
  );
}

export default function GlobalPostsPage() {
  const { user, profile } = useAuth();
  useScrollToTopOnPathnameChange();
  useMobileScrollDirectionHeaderHide(!!user);
  const { openGuestAuthPrompt } = useGuestAuthPrompt();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [scrollToPostId, setScrollToPostId] = useState<string | null>(() => {
    const raw = (location.state as CommunityFeedLocationState | null)?.scrollToPostId;
    return raw ? (parseProfilePostShareId(raw) ?? raw) : null;
  });
  const [scrollToRequestId] = useState<string | null>(() => {
    const raw = (location.state as CommunityFeedLocationState | null)?.scrollToRequestId;
    return raw ? (parseJobRequestShareId(raw) ?? raw) : null;
  });
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeInitialPostTypeId, setComposeInitialPostTypeId] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const guestSidebarOpen = true;
  const [feedSearchQuery, setFeedSearchQuery] = useState("");
  const [guestHeaderCompact, setGuestHeaderCompact] = useState(
    () => typeof window !== "undefined" && window.scrollY > 140,
  );
  const [sortDrawerOpen, setSortDrawerOpen] = useState(false);
  const [feedSortMode, setFeedSortMode] = useState<
    "newest" | "oldest" | "most_liked" | "most_commented" | "most_shared" | "near_me"
  >("newest");
  const { isTablet, isLandscape, isMdUp } = useTabletViewport();
  const [storedInsightsPanelOpen, setStoredInsightsPanelOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("tebnu_feed_side_panel_open") !== "false";
  });
  const insightsPanelLocked = isTablet && isLandscape;
  /** Desktop/tablet: show favorites panel under the header (guests always; signed-in when open). */
  const insightsPanelOpen =
    isMdUp && (insightsPanelLocked || storedInsightsPanelOpen || !user);

  useEffect(() => {
    if (user) return;
    let compact = window.scrollY > 140;
    const updateHeaderMode = () => {
      const y = window.scrollY;
      const next = compact ? y > 24 : y > 140;
      if (next === compact) return;
      compact = next;
      setGuestHeaderCompact(next);
    };
    setGuestHeaderCompact(compact);
    window.addEventListener("scroll", updateHeaderMode, { passive: true });
    return () => window.removeEventListener("scroll", updateHeaderMode);
  }, [user]);

  useEffect(() => {
    if (user || !window.matchMedia("(min-width: 768px)").matches) return;
    const from = document.querySelector(
      guestHeaderCompact
        ? "[data-guest-feed-search='flow']"
        : "[data-guest-feed-search='header']",
    );
    const active = document.activeElement;
    if (!from || !active || !from.contains(active)) return;
    const next = document.querySelector(
      guestHeaderCompact
        ? "[data-guest-feed-search='header'] input"
        : "[data-guest-feed-search='flow'] input",
    );
    if (next instanceof HTMLElement) next.focus();
  }, [guestHeaderCompact, user]);
  const [postTypeFilter, setPostTypeFilter] = useState<CommunityFeedPostTypeFilter>(
    () => parseCommunityFeedTypeFilter(searchParams.get("type")) ?? "all",
  );
  const [commentedFilterActive, setCommentedFilterActive] = useState(false);
  const [acceptedFilterActive, setAcceptedFilterActive] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<CommunityFeedAdvancedFilters>(
    DEFAULT_COMMUNITY_FEED_ADVANCED_FILTERS,
  );
  const [favoriteAuthorFilterId, setFavoriteAuthorFilterId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<DiscoverHomeCategoryId>(
    () => parseCommunityFeedCategory(searchParams.get("category")) ?? ALL_HELP_CATEGORY_ID,
  );
  const [otherSubFilter, setOtherSubFilter] = useState<string | null>(null);

  const viewerLocation = useMemo<ViewerLocation | null>(() => {
    if (!profile) return null;
    return {
      city: profile.city ?? null,
      lat: profile.location_lat ?? null,
      lng: profile.location_lng ?? null,
    };
  }, [profile]);

  const setInsightsPanelOpen = useCallback((open: boolean) => {
    setStoredInsightsPanelOpen(open);
    window.localStorage.setItem("tebnu_feed_side_panel_open", String(open));
  }, []);

  const rawPostParam = searchParams.get("post");
  const rawRequestParam = searchParams.get("request");
  const focusPostId = parseProfilePostShareId(rawPostParam) ?? scrollToPostId;
  const focusRequestId = parseJobRequestShareId(rawRequestParam) ?? scrollToRequestId;
  const typeParam = searchParams.get("type");
  const categoryParam = searchParams.get("category");
  const subParam = searchParams.get("sub");

  useEffect(() => {
    if (focusPostId || focusRequestId) return;
    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };
    resetScroll();
    const t = window.setTimeout(resetScroll, 120);
    return () => window.clearTimeout(t);
  }, [focusPostId, focusRequestId, location.pathname]);

  useEffect(() => {
    const state = location.state as CommunityFeedLocationState | null;
    if (!state?.scrollToPostId && !state?.scrollToRequestId) return;
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: null },
    );
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    setPostTypeFilter(parseCommunityFeedTypeFilter(typeParam) ?? "all");
  }, [typeParam]);

  useEffect(() => {
    const category = parseCommunityFeedCategory(categoryParam) ?? ALL_HELP_CATEGORY_ID;
    setCategoryFilter(category);
    if (category !== "other_help") setOtherSubFilter(null);
    else if (subParam && otherHelpSubcategoryLabel(subParam)) setOtherSubFilter(subParam);
  }, [categoryParam, subParam]);

  const handleCategoryFilterChange = useCallback(
    (id: DiscoverHomeCategoryId) => {
      setCategoryFilter(id);
      if (id !== "other_help") setOtherSubFilter(null);
      const next = new URLSearchParams(searchParams);
      if (id === ALL_HELP_CATEGORY_ID) {
        next.delete("category");
      } else {
        next.set("category", id);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleSidePanelPostOpen = useCallback(
    (postId: string) => {
      const cleanPostId = parseProfilePostShareId(postId) ?? postId.trim();
      if (!cleanPostId) return;

      // Side-panel posts are independent from the active feed filters. Clear filters
      // first so the clicked post can mount in the main column, then scroll to it once.
      setPostTypeFilter("all");
      setCommentedFilterActive(false);
      setAcceptedFilterActive(false);
      setAdvancedFilters(DEFAULT_COMMUNITY_FEED_ADVANCED_FILTERS);
      setFavoriteAuthorFilterId(null);
      setCategoryFilter("all_help");
      setOtherSubFilter(null);
      setScrollToPostId(cleanPostId);

      const next = new URLSearchParams(searchParams);
      next.delete("type");
      next.delete("types");
      next.delete("request");
      next.delete("category");
      next.set("post", cleanPostId);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  /** Drop request deep links when a non-request type tab is active. */
  useEffect(() => {
    const type = parseCommunityFeedTypeFilter(typeParam);
    if (!rawRequestParam) return;
    if (!type || type === "all" || type === "request_help") return;
    const next = new URLSearchParams(searchParams);
    next.delete("request");
    setSearchParams(next, { replace: true });
  }, [typeParam, rawRequestParam, searchParams, setSearchParams]);

  /** Fix corrupted links where messengers glued caption text onto the UUID. */
  useEffect(() => {
    if (rawRequestParam && focusRequestId && rawRequestParam.trim() !== focusRequestId) {
      const next = new URLSearchParams(searchParams);
      next.set("request", focusRequestId);
      setSearchParams(next, { replace: true });
      return;
    }
    if (!rawPostParam || !focusPostId) return;
    if (rawPostParam.trim() === focusPostId) return;
    debugProfilePostDeepLink("GlobalPostsPage: sanitize post query param", {
      rawPostParam,
      focusPostId,
    });
    const next = new URLSearchParams(searchParams);
    next.set("post", focusPostId);
    setSearchParams(next, { replace: true });
  }, [focusPostId, rawPostParam, searchParams, setSearchParams]);

  useEffect(() => {
    if (searchParams.get("compose") !== "1" || !user) return;
    const next = new URLSearchParams(searchParams);
    const postType = next.get("postType");
    next.delete("compose");
    next.delete("postType");
    setSearchParams(next, { replace: true });
    setComposeInitialPostTypeId(
      postType === "request_help" || postType === "offer_service" ? postType : null,
    );
    setComposeOpen(true);
  }, [searchParams, setSearchParams, user]);

  const authorProfile: ProfileSnippet | null = user ? {
    id: user.id,
    full_name: profile?.full_name ?? null,
    photo_url: profile?.photo_url ?? null,
  } : null;

  /** Click handler reused by the desktop floating CTA. */
  function openCompose() {
    if (!user) {
      openGuestAuthPrompt({ variant: "create" });
      return;
    }
    setComposeOpen(true);
  }

  useEffect(() => {
    if (!focusPostId) return;
    debugProfilePostDeepLink("GlobalPostsPage: open shared link", {
      focusPostId,
      rawPostParam,
      href: window.location.href,
    });
  }, [focusPostId, rawPostParam]);

  return (
    <PageFrame
      variant="fullBleed"
      className={cn(
        "bg-white dark:bg-[#101214]",
      )}
      frameName="community-feed"
      data-community-feed-page={user ? "" : undefined}
      data-community-feed-guest={!user ? "" : undefined}
    >
      {!user ? (
        <LandingSiteHeader
          hideLeftLogo
          hideBackButton
          hideBackButtonMobile
          hideContactAndLegal
          hideDesktopNavLinks={guestHeaderCompact}
          centerContent={
            <div data-guest-feed-search="header">
              <GuestFeedSearchBar
                value={feedSearchQuery}
                onChange={setFeedSearchQuery}
                onClear={() => setFeedSearchQuery("")}
                onOpenSort={() => setSortDrawerOpen(true)}
                className="w-[min(34rem,100%)]"
              />
            </div>
          }
          fullBleedTop
          className="!bg-white dark:!bg-[#101214]"
          onBrandClick={() => setAboutOpen(true)}
        />
      ) : null}

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col max-md:!px-0 max-md:transition-none pb-6",
          user
            ? "app-desktop-shell md:px-4 md:py-8 md:ps-8 lg:ps-10 pt-2"
            : "w-full md:px-0 md:pb-0 md:pt-0",
        )}
      >
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-visible px-0">
          <FeedMainContent
            user={user}
            profile={profile}
            focusPostId={focusPostId}
            focusRequestId={focusRequestId}
            onGuestFindHelp={() => openGuestAuthPrompt({ variant: "create" })}
            onGuestOfferHelp={() => openGuestAuthPrompt({ variant: "engage" })}
            postTypeFilter={postTypeFilter}
            feedPostTypeIds={["community", "event"]}
            commentedFilterActive={commentedFilterActive}
            onCommentedFilterChange={setCommentedFilterActive}
            acceptedFilterActive={acceptedFilterActive}
            onAcceptedFilterChange={setAcceptedFilterActive}
            advancedFilters={advancedFilters}
            onAdvancedFiltersChange={setAdvancedFilters}
            favoriteAuthorFilterId={favoriteAuthorFilterId}
            onFavoriteAuthorFilterChange={setFavoriteAuthorFilterId}
            scrollToPostId={scrollToPostId}
            onScrollToPostDone={() => setScrollToPostId(null)}
            viewerLocation={viewerLocation}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={handleCategoryFilterChange}
            otherSubFilter={otherSubFilter}
            onOtherSubFilterChange={setOtherSubFilter}
            onSidePanelPostOpen={handleSidePanelPostOpen}
            guestDesktopLightLayout={!user}
            guestSidebarOpen={guestSidebarOpen}
            guestSidebarSiteNavVisible={guestHeaderCompact}
            insightsPanelOpen={insightsPanelOpen}
            insightsPanelLocked={insightsPanelLocked}
            tabletLayout={isTablet}
            onInsightsPanelOpenChange={setInsightsPanelOpen}
            searchQuery={feedSearchQuery}
            onSearchQueryChange={setFeedSearchQuery}
            onOpenSort={() => setSortDrawerOpen(true)}
            searchDockedInHeader={!user && guestHeaderCompact}
            feedSortOrder={feedSortMode === "oldest" ? "oldest" : "newest"}
            rankingSort={
              feedSortMode === "newest" || feedSortMode === "oldest"
                ? null
                : feedSortMode
            }
          />
        </div>
      </div>
      {sortDrawerOpen ? (
        <div className="fixed inset-0 z-[260]">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            onClick={() => setSortDrawerOpen(false)}
            aria-label="Close sorting options"
          />
          <aside className="absolute inset-y-0 end-0 w-[min(88vw,360px)] bg-white p-6 shadow-2xl dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">Sort posts</h2>
              <button type="button" onClick={() => setSortDrawerOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-8 space-y-3">
              {([
                ["newest", "Newest first"],
                ["oldest", "Oldest first"],
                ["most_liked", "Most liked"],
                ["most_commented", "Most commented"],
                ["most_shared", "Most shared"],
                ["near_me", "Near me"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setFeedSortMode(value);
                    setSortDrawerOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left font-bold",
                    feedSortMode === value
                      ? "bg-orange-500 text-white"
                      : "bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-100",
                  )}
                >
                  {label}
                  <span className={cn("h-3 w-3 rounded-full border-2", feedSortMode === value ? "border-white bg-white" : "border-zinc-400")} />
                </button>
              ))}
            </div>
          </aside>
        </div>
      ) : null}

      {/* Guest mobile: "What is tebnu?" bottom sheet */}
      {!user && aboutOpen ? (
        <MobileSnapBottomSheet
          expanded={aboutOpen}
          onExpandedChange={setAboutOpen}
          onDismiss={() => setAboutOpen(false)}
          ariaLabel="What is tebnu?"
          collapsed={
            <div className="px-5 pt-3 pb-4">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted-foreground/25" />
              <div className="text-center text-sm font-black tracking-tight text-foreground">
                What is tebnu?
              </div>
            </div>
          }
        >
          <div className="px-5 pb-6">
            <p className="text-sm leading-relaxed text-muted-foreground">
              tebnu is a community for getting help and offering help — for any
              need, big or small.
            </p>

            <ul className="mt-4 space-y-2 text-sm text-foreground/90">
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                Find help near you (services, one-time tasks, ongoing support).
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                Offer your skills and connect with people who need them.
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                Share updates, reviews, and availability on the public board.
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                Message securely and build trust through community activity.
              </li>
            </ul>

            <div className="mt-6 flex flex-col gap-2">
              <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-muted/10">
                <img
                  src="/ChatGPT Image Apr 19, 2026, 11_35_26 AM.png"
                  alt=""
                  className="h-auto w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-3.5 shadow-md ring-1 ring-black/5">
                  <img
                    src={BRAND_LOGO_SRC}
                    alt="Tebnu"
                    className="h-9 w-auto"
                    loading="eager"
                    decoding="async"
                  />
                  <span className="text-[13px] font-black tracking-tight text-slate-900">
                    Tebnu.com
                  </span>
                </div>
              </div>

              <Button
                type="button"
                className={cn(
                  "h-11 w-full rounded-xl text-[15px] font-black",
                  TEBNU_JOIN_COMMUNITY_BUTTON_CLASS,
                )}
                onClick={() => {
                  setAboutOpen(false);
                  openGuestAuthPrompt({ variant: "create" });
                }}
              >
                Register
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-xl text-[15px] font-semibold"
                onClick={() => {
                  setAboutOpen(false);
                  openGuestAuthPrompt({ variant: "engage" });
                }}
              >
                Sign in
              </Button>
            </div>
          </div>
        </MobileSnapBottomSheet>
      ) : null}

      {/* Desktop: floating "Share a post" CTA */}
      {user ? <button
        type="button"
        onClick={openCompose}
        className={cn(
          "hidden md:inline-flex fixed bottom-6 z-[120]",
          "left-[calc(220px+1.5rem)]",
          "items-center justify-center gap-2 rounded-full px-5 py-3 text-[13px] font-extrabold tracking-tight",
          "bg-orange-600 text-white shadow-xl shadow-orange-500/25 transition-all",
          "hover:bg-orange-700 hover:-translate-y-[2px] active:scale-[0.97]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "whitespace-nowrap",
        )}
        aria-label="Share a post"
      >
        <Send
          className="h-4 w-4 translate-x-[1px]"
          strokeWidth={2.75}
          aria-hidden
        />
        Share a post
      </button> : null}

      {/* Guest desktop: "What is tebnu?" modal (opened via desktop share button). */}
      {!user ? (
        <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
          <DialogContent className="hidden max-w-md rounded-2xl border-0 bg-background px-6 pb-6 pt-7 shadow-2xl outline-none ring-0 focus:outline-none md:block">
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-xl font-black tracking-tight">
                What is tebnu?
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                tebnu is a community for getting help and offering help — for any
                need, big or small.
              </DialogDescription>
            </DialogHeader>

            <ul className="mt-4 space-y-2 text-sm text-foreground/90">
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                Find help near you (services, one-time tasks, ongoing support).
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                Offer your skills and connect with people who need them.
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                Share updates, reviews, and availability on the public board.
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                Message securely and build trust through community activity.
              </li>
            </ul>

            <div className="mt-6 flex flex-col gap-2">
              <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-muted/10">
                <img
                  src="/ChatGPT Image Apr 19, 2026, 11_35_26 AM.png"
                  alt=""
                  className="h-auto w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-3.5 shadow-md ring-1 ring-black/5">
                  <img
                    src={BRAND_LOGO_SRC}
                    alt="Tebnu"
                    className="h-9 w-auto"
                    loading="eager"
                    decoding="async"
                  />
                  <span className="text-[13px] font-black tracking-tight text-slate-900">
                    Tebnu.com
                  </span>
                </div>
              </div>

              <Button
                type="button"
                className={cn(
                  "h-11 w-full rounded-xl text-[15px] font-black",
                  TEBNU_JOIN_COMMUNITY_BUTTON_CLASS,
                )}
                onClick={() => {
                  setAboutOpen(false);
                  openGuestAuthPrompt({ variant: "create" });
                }}
              >
                Register
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-xl text-[15px] font-semibold"
                onClick={() => {
                  setAboutOpen(false);
                  openGuestAuthPrompt({ variant: "engage" });
                }}
              >
                Sign in
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {authorProfile && (
        <ComposeModal
          open={composeOpen}
          onClose={() => {
            setComposeOpen(false);
            setComposeInitialPostTypeId(null);
          }}
          onPosted={(postId) => {
            setComposeOpen(false);
            setComposeInitialPostTypeId(null);
            setPostTypeFilter("all");
            setCommentedFilterActive(false);
            setAcceptedFilterActive(false);
            setAdvancedFilters(DEFAULT_COMMUNITY_FEED_ADVANCED_FILTERS);
            setFavoriteAuthorFilterId(null);
            setCategoryFilter("all_help");
            setOtherSubFilter(null);
            if (postId) setScrollToPostId(postId);
            void queryClient.invalidateQueries({
              queryKey: queryKeys.community,
              refetchType: "active",
            });
            const next = new URLSearchParams(searchParams);
            next.delete("type");
            next.delete("request");
            if (postId) next.set("post", postId);
            setSearchParams(next, { replace: true });
          }}
          authorProfile={authorProfile}
          initialPostTypeId={composeInitialPostTypeId}
        />
      )}
    </PageFrame>
  );
}
