import { createContext, useContext, useMemo, useState } from "react";

/**
 * Discover home mobile: header/tab strip collapse is driven by scroll position (0 = expanded, 1 = collapsed),
 * not a discrete toggle — progress moves with the user’s finger.
 */
type DiscoverHomeScrollHeaderContextValue = {
  /** 0 = full top chrome, 1 = fully collapsed — interpolated from scroll range on mobile discover only */
  collapseProgress: number;
  setCollapseProgress: (p: number) => void;
};

const DiscoverHomeScrollHeaderContext =
  createContext<DiscoverHomeScrollHeaderContextValue | null>(null);

export function DiscoverHomeScrollHeaderProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapseProgress, setCollapseProgress] = useState(0);
  const value = useMemo(
    () => ({ collapseProgress, setCollapseProgress }),
    [collapseProgress],
  );
  return (
    <DiscoverHomeScrollHeaderContext.Provider value={value}>
      {children}
    </DiscoverHomeScrollHeaderContext.Provider>
  );
}

export function useDiscoverHomeScrollHeader() {
  const ctx = useContext(DiscoverHomeScrollHeaderContext);
  return (
    ctx ?? {
      collapseProgress: 0,
      setCollapseProgress: (_p: number) => {
        /* no-op outside provider */
      },
    }
  );
}
