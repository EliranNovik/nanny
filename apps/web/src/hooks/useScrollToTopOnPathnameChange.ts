import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Reset window scroll when navigating between routes (e.g. profile settings subpages). */
export function useScrollToTopOnPathnameChange() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);
}
