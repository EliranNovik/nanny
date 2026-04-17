import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { LiveJobBannerPayload } from "@/lib/liveJobConversationBanner";

export function LiveJobHeaderPill({
  categoryLabel,
  href,
  className,
}: LiveJobBannerPayload & { className?: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      className={cn(
        "max-w-[10.5rem] shrink-0 truncate rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-left shadow-sm transition hover:bg-emerald-500/18 active:scale-[0.98] dark:border-emerald-400/25 dark:bg-emerald-500/12 dark:hover:bg-emerald-500/20",
        className,
      )}
      aria-label={`Open Helping now — ${categoryLabel}`}
    >
      <span className="block text-[9px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200/95">
        Live helping
      </span>
      <span className="block truncate text-[11px] font-bold leading-tight text-emerald-950 dark:text-emerald-50">
        {categoryLabel}
      </span>
    </button>
  );
}
