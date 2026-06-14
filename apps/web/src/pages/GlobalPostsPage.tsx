import { useCallback, useEffect, useMemo, useState } from "react";
import { ProfilePostsFeed, ComposeModal, type ProfileSnippet } from "@/components/profile/ProfilePostsFeed";
import { PageFrame } from "@/components/page-frame";
import { useAuth } from "@/context/AuthContext";
import { useGuestAuthPrompt } from "@/context/GuestAuthPromptContext";
import { useKycGate } from "@/context/KycGateContext";
import { useMobileShellScrollCollapse } from "@/hooks/useMobileShellScrollCollapse";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Send } from "lucide-react";
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
import {
  CommunityFeedHeader,
  type CommunityFeedPostTypeFilter,
} from "@/components/community/CommunityFeedHeader";
import {
  DEFAULT_COMMUNITY_FEED_ADVANCED_FILTERS,
  type CommunityFeedAdvancedFilters,
} from "@/lib/communityFeedFilters";
import {
  type CommunityFeedLocationState,
  parseCommunityFeedTypeFilter,
} from "@/lib/communityFeedNav";

type FeedMainContentProps = {
  user: User | null;
  profile: { full_name?: string | null; photo_url?: string | null } | null;
  focusPostId: string | null;
  focusRequestId: string | null;
  openCompose: () => void;
  expandDiscoverLayout?: boolean;
  postTypeFilter: CommunityFeedPostTypeFilter;
  onPostTypeFilterChange: (filter: CommunityFeedPostTypeFilter) => void;
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
};

function FeedMainContent({
  user,
  focusPostId,
  focusRequestId,
  openCompose,
  expandDiscoverLayout = false,
  postTypeFilter,
  onPostTypeFilterChange,
  commentedFilterActive,
  onCommentedFilterChange,
  acceptedFilterActive,
  onAcceptedFilterChange,
  advancedFilters,
  onAdvancedFiltersChange,
  favoriteAuthorFilterId,
  onFavoriteAuthorFilterChange,
  scrollToPostId,
  onScrollToPostDone,
  profile,
}: FeedMainContentProps) {
  const sidePanelPostTypeIds = useMemo(
    () => (postTypeFilter === "all" ? null : [postTypeFilter]),
    [postTypeFilter],
  );

  return (
    <div
      className={cn(
        !focusPostId && !focusRequestId && "animate-in fade-in slide-in-from-bottom-4 duration-1000",
      )}
    >
      <CommunityFeedHeader
        activeFilter={postTypeFilter}
        onFilterChange={onPostTypeFilterChange}
        onAddStory={openCompose}
        viewer={profile}
        viewerUserId={user?.id ?? null}
        commentedFilterActive={commentedFilterActive}
        onCommentedFilterChange={onCommentedFilterChange}
        acceptedFilterActive={acceptedFilterActive}
        onAcceptedFilterChange={onAcceptedFilterChange}
        advancedFilters={advancedFilters}
        onAdvancedFiltersChange={onAdvancedFiltersChange}
        selectedAuthorFilterId={favoriteAuthorFilterId}
        onAuthorFilterChange={onFavoriteAuthorFilterChange}
        reserveSidePanelSpace
        className="mb-4 mt-3 md:mb-5 md:mt-4 px-2 md:px-0"
      />

      <ProfilePostsFeed
        appearance="discover"
        discoverSidePanel="favorites"
        focusPostId={focusPostId}
        focusRequestId={focusRequestId}
        expandDiscoverLayout={expandDiscoverLayout}
        filterPostTypeId={postTypeFilter === "all" ? null : postTypeFilter}
        sidePanelPostTypeIds={sidePanelPostTypeIds}
        filterCommentedOwnPosts={commentedFilterActive}
        filterAcceptedRequests={acceptedFilterActive}
        filterAuthorId={favoriteAuthorFilterId ?? undefined}
        feedAdvancedFilters={advancedFilters}
        excludeOwnJobRequests={false}
        fixedFavoritesSidePanel
        scrollToPostId={scrollToPostId}
        onScrollToPostDone={onScrollToPostDone}
        plainCards
      />
    </div>
  );
}

export default function GlobalPostsPage() {
  const { user, profile } = useAuth();
  useMobileShellScrollCollapse(!!user);
  const { openGuestAuthPrompt } = useGuestAuthPrompt();
  const { guardKycAction } = useKycGate();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [scrollToPostId, setScrollToPostId] = useState<string | null>(() => {
    const raw = (location.state as CommunityFeedLocationState | null)?.scrollToPostId;
    return raw ? (parseProfilePostShareId(raw) ?? raw) : null;
  });
  const [composeOpen, setComposeOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [postTypeFilter, setPostTypeFilter] = useState<CommunityFeedPostTypeFilter>(
    () => parseCommunityFeedTypeFilter(searchParams.get("type")) ?? "all",
  );
  const [commentedFilterActive, setCommentedFilterActive] = useState(false);
  const [acceptedFilterActive, setAcceptedFilterActive] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<CommunityFeedAdvancedFilters>(
    DEFAULT_COMMUNITY_FEED_ADVANCED_FILTERS,
  );
  const [favoriteAuthorFilterId, setFavoriteAuthorFilterId] = useState<string | null>(null);

  const rawPostParam = searchParams.get("post");
  const rawRequestParam = searchParams.get("request");
  const focusPostId = parseProfilePostShareId(rawPostParam);
  const focusRequestId = parseJobRequestShareId(rawRequestParam);
  const typeParam = searchParams.get("type");

  useEffect(() => {
    if (!(location.state as CommunityFeedLocationState | null)?.scrollToPostId) return;
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: null },
    );
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    setPostTypeFilter(parseCommunityFeedTypeFilter(typeParam) ?? "all");
  }, [typeParam]);

  const handlePostTypeFilterChange = useCallback(
    (filter: CommunityFeedPostTypeFilter) => {
      setPostTypeFilter(filter);
      setAcceptedFilterActive(false);
      const next = new URLSearchParams(searchParams);
      if (filter === "all") {
        next.delete("type");
      } else {
        next.set("type", filter);
      }
      if (filter !== "request_help" && filter !== "all") {
        next.delete("request");
      }
      if (filter === "request_help") {
        next.delete("post");
      }
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
    next.delete("compose");
    setSearchParams(next, { replace: true });
    guardKycAction("share_post", () => setComposeOpen(true));
  }, [guardKycAction, searchParams, setSearchParams, user]);

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
    guardKycAction("share_post", () => setComposeOpen(true));
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
      className="bg-white dark:bg-background"
      frameName="community-feed"
      data-community-feed-page={user ? "" : undefined}
      data-community-feed-guest={!user ? "" : undefined}
    >
      {!user ? (
        <div className="max-md:px-4 max-md:pt-4">
          <LandingSiteHeader
            hidePostFeedLink
            scrollWithPage
            fullWidth
            hideLeftLogo
            mobileMatchLanding
            hideBackButtonMobile
            className="mb-0 max-md:max-w-5xl"
            variant="glassy"
          />
        </div>
      ) : null}

      {user ? (
        <div className="app-desktop-shell flex min-h-0 flex-1 flex-col max-md:!px-0 max-md:transition-none pb-6 pt-2 md:px-4 md:py-8">
          <div className="mx-auto flex min-h-0 w-full flex-1 flex-col overflow-visible px-0 md:mx-0 md:max-w-none">
            <FeedMainContent
              user={user}
              profile={profile}
              focusPostId={focusPostId}
              focusRequestId={focusRequestId}
              openCompose={openCompose}
              postTypeFilter={postTypeFilter}
              onPostTypeFilterChange={handlePostTypeFilterChange}
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
            />
          </div>
        </div>
      ) : (
        <div className="flex w-full items-start pb-6">
          <GuestCommunityFeedAside />
          <div className="min-w-0 flex-1 px-0 md:px-6 lg:px-8">
            <FeedMainContent
              user={user}
              profile={profile}
              focusPostId={focusPostId}
              focusRequestId={focusRequestId}
              openCompose={openCompose}
              expandDiscoverLayout
              postTypeFilter={postTypeFilter}
              onPostTypeFilterChange={handlePostTypeFilterChange}
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
            />
          </div>
        </div>
      )}

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
      <button
        type="button"
        onClick={user ? openCompose : () => setAboutOpen(true)}
        className={cn(
          "hidden md:inline-flex fixed left-1/2 bottom-6 z-[120] -translate-x-1/2",
          "items-center justify-center gap-2 rounded-full px-5 py-3 text-[13px] font-extrabold tracking-tight",
          "bg-orange-600 text-white shadow-xl shadow-orange-500/25 transition-all",
          "hover:bg-orange-700 hover:-translate-y-[2px] hover:-translate-x-1/2 active:scale-[0.97]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "whitespace-nowrap",
        )}
        aria-label={user ? "Share a post" : "What is tebnu?"}
      >
        <Send
          className="h-4 w-4 translate-x-[1px]"
          strokeWidth={2.75}
          aria-hidden
        />
        Share a post
      </button>

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
