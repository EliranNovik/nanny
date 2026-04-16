import { createContext, useContext, useMemo, useState } from "react";

type DiscoverHomeScrollHeaderContextValue = {
  compact: boolean;
  setCompact: (v: boolean) => void;
};

const DiscoverHomeScrollHeaderContext =
  createContext<DiscoverHomeScrollHeaderContextValue | null>(null);

export function DiscoverHomeScrollHeaderProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [compact, setCompact] = useState(false);
  const value = useMemo(
    () => ({ compact, setCompact }),
    [compact],
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
      compact: false,
      setCompact: (_v: boolean) => {
        /* no-op outside provider */
      },
    }
  );
}
