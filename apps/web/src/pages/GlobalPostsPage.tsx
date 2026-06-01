import { useEffect, useState } from "react";
import { ProfilePostsFeed, ComposeModal, type ProfileSnippet } from "@/components/profile/ProfilePostsFeed";
import { PageFrame } from "@/components/page-frame";
import { useAuth } from "@/context/AuthContext";
import { useGuestAuthPrompt } from "@/context/GuestAuthPromptContext";
import { useKycGate } from "@/context/KycGateContext";
import { useSearchParams } from "react-router-dom";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { debugProfilePostDeepLink } from "@/lib/profilePostDeepLinkDebug";
import { parseProfilePostShareId } from "@/lib/profilePostShare";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LandingSiteHeader } from "@/components/LandingSiteHeader";
import { GuestCommunityFeedAside } from "@/components/GuestCommunityFeedAside";
import type { User } from "@supabase/supabase-js";

type FeedMainContentProps = {
  user: User | null;
  profile: { full_name?: string | null; photo_url?: string | null } | null;
  focusPostId: string | null;
  openCompose: () => void;
  expandDiscoverLayout?: boolean;
};

function FeedMainContent({
  user,
  profile,
  focusPostId,
  openCompose,
  expandDiscoverLayout = false,
}: FeedMainContentProps) {
  return (
    <div
      className={cn(
        !focusPostId && "animate-in fade-in slide-in-from-bottom-4 duration-1000",
      )}
    >
      <div className={cn("mb-4 md:mb-6", !expandDiscoverLayout && "px-4 md:px-0")}>
        <button
          type="button"
          onClick={openCompose}
          className="flex w-full items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 text-left shadow-sm transition-all hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-900/50 dark:hover:bg-zinc-800/80"
        >
          <Avatar className="h-10 w-10 border border-black/5 dark:border-white/5">
            <AvatarImage src={profile?.photo_url || undefined} className="object-cover" />
            <AvatarFallback className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {(profile?.full_name?.charAt(0) || user?.email?.charAt(0) || "U").toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex h-10 flex-1 items-center rounded-full bg-zinc-100 px-4 transition-colors dark:bg-zinc-800/80">
            <span className="text-[14px] text-zinc-500 dark:text-zinc-400">
              Post a new story
            </span>
          </div>
        </button>
      </div>

      <ProfilePostsFeed
        appearance="discover"
        focusPostId={focusPostId}
        expandDiscoverLayout={expandDiscoverLayout}
      />
    </div>
  );
}

export default function GlobalPostsPage() {
  const { user, profile } = useAuth();
  const { openGuestAuthPrompt } = useGuestAuthPrompt();
  const { guardKycAction } = useKycGate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [composeOpen, setComposeOpen] = useState(false);

  const rawPostParam = searchParams.get("post");
  const focusPostId = parseProfilePostShareId(rawPostParam);

  /** Fix corrupted links where messengers glued caption text onto the UUID. */
  useEffect(() => {
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
      data-community-feed-guest={!user ? "" : undefined}
    >
      {!user ? (
        <LandingSiteHeader
          hidePostFeedLink
          scrollWithPage
          fullWidth
          hideLeftLogo
        />
      ) : null}

      {user ? (
        <div className="app-desktop-shell px-0 pb-6 pt-2 md:px-4 md:py-8">
          <div className="mx-auto w-full max-w-3xl md:mx-0 md:max-w-none">
            <FeedMainContent
              user={user}
              profile={profile}
              focusPostId={focusPostId}
              openCompose={openCompose}
            />
          </div>
        </div>
      ) : (
        <div className="flex w-full items-start pb-6">
          <GuestCommunityFeedAside />
          <div className="min-w-0 flex-1 px-4 md:px-6 lg:px-8">
            <FeedMainContent
              user={user}
              profile={profile}
              focusPostId={focusPostId}
              openCompose={openCompose}
              expandDiscoverLayout
            />
          </div>
        </div>
      )}

      {/*
        Floating "Share a post" CTA.
         - Mobile: circular plus-icon FAB in the bottom-right, above the BottomNav.
         - Desktop: full pill ("Share a post") centred at the bottom of the viewport.
      */}
      <button
        type="button"
        onClick={openCompose}
        className={cn(
          "md:hidden fixed z-[120] right-4 inline-flex h-14 w-14 items-center justify-center rounded-full",
          "bg-orange-600 text-white shadow-2xl shadow-orange-500/30 transition-transform",
          "hover:bg-orange-700 active:scale-[0.95]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
        style={{
          bottom: user
            ? "calc(3.25rem + max(0.5rem, env(safe-area-inset-bottom,0px)) + 0.75rem)"
            : "calc(0.75rem + env(safe-area-inset-bottom,0px))",
        }}
        aria-label="Share a post"
      >
        <Send
          className="h-6 w-6 translate-x-[1px]"
          strokeWidth={2.5}
          aria-hidden
        />
      </button>

      <button
        type="button"
        onClick={openCompose}
        className={cn(
          "hidden md:inline-flex fixed left-1/2 bottom-6 z-[120] -translate-x-1/2",
          "items-center justify-center gap-2 rounded-full px-5 py-3 text-[13px] font-extrabold tracking-tight",
          "bg-orange-600 text-white shadow-xl shadow-orange-500/25 transition-all",
          "hover:bg-orange-700 hover:-translate-y-[2px] hover:-translate-x-1/2 active:scale-[0.97]",
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
      </button>

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
