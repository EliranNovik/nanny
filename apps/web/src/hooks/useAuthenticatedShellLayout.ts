import { useDesktopSidePanel } from "@/context/DesktopSidePanelContext";
import { useTabletViewport } from "@/hooks/useIsTabletViewport";

type ShellLayoutInput = {
  pathname: string;
  search: string;
  isAdmin: boolean;
};

export function useAuthenticatedShellLayout({
  pathname,
  search,
  isAdmin,
}: ShellLayoutInput) {
  const { isTablet, isLandscape, isMdUp } = useTabletViewport();
  const { feedPanelOpen, profilePanelOpen } = useDesktopSidePanel();
  const isHome =
    pathname === "/client/home" || pathname === "/freelancer/home";
  const isFeed =
    pathname === "/community/feed" || pathname === "/public/posts";
  const isProfileSettings =
    pathname === "/client/profile" ||
    pathname.startsWith("/client/profile/") ||
    pathname === "/freelancer/profile" ||
    pathname.startsWith("/freelancer/profile/");
  const isPublicProfile = /^\/profile\/[^/]+\/?$/.test(pathname);
  const isProfile = isPublicProfile || isProfileSettings;
  const isMessages = pathname === "/messages" || pathname.startsWith("/messages/");
  const isFindHelpers =
    pathname === "/client/helpers" ||
    pathname.startsWith("/client/helpers/");
  const isIsolatedPostDetail =
    pathname.startsWith("/offers/") || pathname.startsWith("/open-requests/");
  const isMessageThread =
    pathname.startsWith("/messages/") ||
    (pathname === "/messages" &&
      new URLSearchParams(search).has("conversation"));

  /** Web chrome uses `md` (768px) so header/sidebar never vanish in the 600–767 gap. */
  const desktopShell = isMdUp;
  const effectiveFeedPanelOpen = isLandscape || feedPanelOpen;
  const effectiveProfilePanelOpen = isLandscape || profilePanelOpen;
  const showRail =
    !isAdmin &&
    desktopShell &&
    (isHome ||
      isFindHelpers ||
      isPublicProfile ||
      isProfileSettings ||
      isIsolatedPostDetail ||
      (isFeed && (!effectiveFeedPanelOpen || isLandscape)) ||
      (isProfile && (isLandscape || !effectiveProfilePanelOpen)) ||
      isMessages);
  const showBottomTabs =
    !isAdmin &&
    (!desktopShell ||
      (isFeed && !showRail) ||
      (isProfile && !showRail));

  /** Light-mode rail: white on home, public profile, and settings; grey elsewhere (e.g. feed/messages). */
  const whiteRail = isHome || isPublicProfile || isProfileSettings;

  return {
    isTablet,
    isMdUp,
    isLandscape,
    isMessageThread,
    showRail,
    showBottomTabs,
    whiteRail,
    tabletChatDock: desktopShell && isMessages && isMessageThread,
  };
}
