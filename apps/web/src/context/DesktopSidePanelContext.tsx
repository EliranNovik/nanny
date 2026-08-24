import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type DesktopSidePanelContextValue = {
  collapsed: boolean;
  toggleCollapsed: () => void;
};

const DesktopSidePanelContext =
  createContext<DesktopSidePanelContextValue | null>(null);

export function DesktopSidePanelProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const value = useMemo(
    () => ({
      collapsed,
      toggleCollapsed: () => setCollapsed((v) => !v),
    }),
    [collapsed],
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
    }
  );
}
