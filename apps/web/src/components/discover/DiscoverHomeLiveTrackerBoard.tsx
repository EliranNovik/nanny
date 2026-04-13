import { cn } from "@/lib/utils";
import { Radio } from "lucide-react";

/** Demo-only — swap for API + signed URLs later */
const MOCK_LIVE_MATCHES: {
  helper: string;
  client: string;
  helperPhoto: string;
  clientPhoto: string;
  workType: string;
  when: string;
}[] = [
  {
    helper: "Maya K.",
    client: "Yael R.",
    helperPhoto: "https://randomuser.me/api/portraits/women/65.jpg",
    clientPhoto: "https://randomuser.me/api/portraits/women/44.jpg",
    workType: "Home cleaning",
    when: "Just now",
  },
  {
    helper: "Oren D.",
    client: "Noa S.",
    helperPhoto: "https://randomuser.me/api/portraits/men/32.jpg",
    clientPhoto: "https://randomuser.me/api/portraits/women/68.jpg",
    workType: "Meal prep",
    when: "1m ago",
  },
  {
    helper: "Lior A.",
    client: "Tom G.",
    helperPhoto: "https://randomuser.me/api/portraits/men/75.jpg",
    clientPhoto: "https://randomuser.me/api/portraits/men/22.jpg",
    workType: "Pickup & drop-off",
    when: "3m ago",
  },
  {
    helper: "Shira M.",
    client: "Eitan B.",
    helperPhoto: "https://randomuser.me/api/portraits/women/33.jpg",
    clientPhoto: "https://randomuser.me/api/portraits/men/41.jpg",
    workType: "After-school care",
    when: "5m ago",
  },
  {
    helper: "Dana F.",
    client: "Ron L.",
    helperPhoto: "https://randomuser.me/api/portraits/women/50.jpg",
    clientPhoto: "https://randomuser.me/api/portraits/men/86.jpg",
    workType: "Handyman help",
    when: "8m ago",
  },
  {
    helper: "Avi P.",
    client: "Michal H.",
    helperPhoto: "https://randomuser.me/api/portraits/men/55.jpg",
    clientPhoto: "https://randomuser.me/api/portraits/women/90.jpg",
    workType: "Deep clean",
    when: "12m ago",
  },
];

export function DiscoverHomeLiveTrackerBoard() {
  return (
    <section className="w-full" aria-label="Latest matches preview">
      <div className="flex items-center justify-between gap-3 pb-4 pt-1">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25">
            <Radio className="h-5 w-5 motion-safe:animate-pulse" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-black tracking-tight text-stone-900 sm:text-xl dark:text-white">Latest matches</h2>
            <p className="text-sm font-medium text-orange-800 dark:text-orange-200/95">Live · demo feed</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-orange-400/45 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-orange-900 dark:border-orange-400/55 dark:text-orange-100">
          Demo
        </span>
      </div>

      <div
        className={cn(
          "flex gap-4 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch]",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "snap-x snap-mandatory touch-pan-x"
        )}
      >
        {MOCK_LIVE_MATCHES.map((row, idx) => (
          <article
            key={`${row.helper}-${idx}`}
            className={cn(
              "w-[min(92vw,21rem)] shrink-0 snap-start rounded-2xl border border-border/60 bg-background/80 px-4 py-4",
              "shadow-sm backdrop-blur-[2px] dark:border-border/50 dark:bg-background/60"
            )}
          >
            <div className="flex items-start gap-3">
              <div className="relative flex shrink-0 -space-x-2.5">
                <img
                  src={row.helperPhoto}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="relative z-[2] h-14 w-14 rounded-full border-[3px] border-background object-cover ring-2 ring-orange-400/45 dark:ring-orange-400/50"
                />
                <img
                  src={row.clientPhoto}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="relative z-[1] h-14 w-14 rounded-full border-[3px] border-background object-cover ring-2 ring-teal-400/50 dark:ring-teal-400/45"
                />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="truncate text-base font-bold leading-snug text-stone-900 dark:text-white">
                  <span className="text-orange-600 dark:text-orange-400">{row.helper}</span>
                  <span className="font-normal text-orange-800/85 dark:text-orange-200/85"> & </span>
                  <span>{row.client}</span>
                </p>
                <p className="mt-1.5 truncate text-sm font-semibold text-teal-800 dark:text-teal-300">{row.workType}</p>
                <p className="mt-2 text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{row.when}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-3 text-center text-xs font-medium text-orange-950/75 dark:text-orange-100/75">
        Illustrative matches for preview — your area will show real jobs here soon.
      </p>
    </section>
  );
}
