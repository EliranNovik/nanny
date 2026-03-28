import { useEffect, useState } from "react";

const QUERY = "(min-width: 768px)";

/** True when viewport matches Tailwind `md` breakpoint (≥768px). */
export function useIsMinMd() {
    const [isMinMd, setIsMinMd] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia(QUERY);
        const apply = () => setIsMinMd(mq.matches);
        apply();
        mq.addEventListener("change", apply);
        return () => mq.removeEventListener("change", apply);
    }, []);

    return isMinMd;
}
