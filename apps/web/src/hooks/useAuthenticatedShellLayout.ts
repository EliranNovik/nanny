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
  const { isTablet, isLandscape } = useTabletViewport();
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
  const isMessageThread =
    pathname.startsWith("/messages/") ||
    (pathname === "/messages" &&
      new URLSearchParams(search).has("conversation"));

  const effectiveFeedPanelOpen = isLandscape || feedPanelOpen;
  const effectiveProfilePanelOpen = isLandscape || profilePanelOpen;
  const showRail =
    !isAdmin &&
    isTablet &&
    (isHome ||
      isFindHelpers ||
      isPublicProfile ||
      isProfileSettings ||
      (isFeed && (!effectiveFeedPanelOpen || isLandscape)) ||
      (isProfile && (isLandscape || !effectiveProfilePanelOpen)) ||
      isMessages);
  const showBottomTabs =
    !isAdmin &&
    (!isTablet ||
      (isFeed && !showRail) ||
      (isProfile && !showRail));

  return {
    isTablet,
    isLandscape,
    isMessageThread,
    showRail,
    showBottomTabs,
    tabletChatDock: isTablet && isMessages && isMessageThread,
  };
}
