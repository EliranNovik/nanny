import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type DesktopSidePanelContextValue = {
  collapsed: boolean;
  toggleCollapsed: () => void;
  feedPanelOpen: boolean;
  setFeedPanelOpen: (open: boolean) => void;
  profilePanelOpen: boolean;
  setProfilePanelOpen: (open: boolean) => void;
};

const DesktopSidePanelContext =
  createContext<DesktopSidePanelContextValue | null>(null);

export function DesktopSidePanelProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [feedPanelOpen, setFeedPanelOpenState] = useState(
    () => localStorage.getItem("tebnu_feed_side_panel_open") !== "false",
  );
  const [profilePanelOpen, setProfilePanelOpenState] = useState(
    () => localStorage.getItem("tebnu_profile_side_panel_open") !== "false",
  );
  const setFeedPanelOpen = (open: boolean) => {
    setFeedPanelOpenState(open);
    localStorage.setItem("tebnu_feed_side_panel_open", String(open));
  };
  const setProfilePanelOpen = (open: boolean) => {
    setProfilePanelOpenState(open);
    localStorage.setItem("tebnu_profile_side_panel_open", String(open));
  };
  const value = useMemo(
    () => ({
      collapsed,
      toggleCollapsed: () => setCollapsed((v) => !v),
      feedPanelOpen,
      setFeedPanelOpen,
      profilePanelOpen,
      setProfilePanelOpen,
    }),
    [collapsed, feedPanelOpen, profilePanelOpen],
  );
  return (
    <DesktopSidePanelContext.Provider value={value}>
      {children}
    </DesktopSidePanelContext.Provider>
  );
}

export function useDesktopSidePanel() {
  const ctx = useContext(DesktopSidePanelContext);
  return (
    ctx ?? {
      collapsed: false,
      toggleCollapsed: () => {
        /* no-op outside provider */
      },
      feedPanelOpen: true,
      setFeedPanelOpen: () => {},
      profilePanelOpen: true,
      setProfilePanelOpen: () => {},
    }
  );
}
