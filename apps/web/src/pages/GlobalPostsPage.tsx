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
      <div
        className={cn(
          "mb-4 mt-3 md:mb-6 md:mt-4",
          !expandDiscoverLayout && "px-4 md:px-0",
        )}
      >
        <button
          type="button"
          onClick={openCompose}
          className="flex w-full md:w-1/2 items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm transition-all hover:bg-zinc-50 dark:bg-zinc-900/50 dark:hover:bg-zinc-800/80"
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
  const [aboutOpen, setAboutOpen] = useState(false);

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
          className="mb-0"
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
          <div className="min-w-0 flex-1 px-0 md:px-6 lg:px-8">
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
        onClick={user ? openCompose : () => setAboutOpen(true)}
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
        aria-label={user ? "Share a post" : "What is tebnu?"}
      >
        <Send
          className="h-6 w-6 translate-x-[1px]"
          strokeWidth={2.5}
          aria-hidden
        />
      </button>

      {/* Guest mobile: "What is tebnu?" bottom sheet (opened via primary FAB). */}
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
