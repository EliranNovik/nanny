import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useDiscoverLatestJobReviews } from "@/hooks/data/useDiscoverLatestJobReviews";

function initials(name: string | null | undefined): string {
  const t = String(name ?? "").trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last =
    parts.length > 1
      ? (parts[parts.length - 1]?.[0] ?? "")
      : (parts[0]?.[1] ?? "");
  const s = (first + last).toUpperCase();
  return s || "?";
}

function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

type Props = {
  /** Defaults to 10 */
  limit?: number;
  className?: string;
};

/**
 * Desktop-only strip: horizontally scrollable job review cards at the bottom of Discover home tabs.
 */
export function DiscoverHomeReviewsDesktopStrip({
  limit = 10,
  className,
}: Props) {
  const navigate = useNavigate();
  const { loading, rows } = useDiscoverLatestJobReviews(limit);

  /** Match `LandingPage` review avatar rings (rotated by card index). */
  const avatarGradients = useMemo(
    () => [
      "from-blue-400 to-purple-500",
      "from-green-400 to-teal-500",
      "from-orange-400 to-pink-500",
      "from-red-400 to-indigo-500",
      "from-emerald-500 to-teal-600",
      "from-orange-500 to-orange-700",
      "from-slate-500 to-slate-700",
      "from-teal-500 to-emerald-700",
    ],
    [],
  );

  const scrollClass =
    "flex gap-6 overflow-x-auto overflow-y-visible px-0.5 pb-8 pt-12 " +
    "overscroll-x-contain [-webkit-overflow-scrolling:touch] snap-x snap-mandatory scroll-smooth " +
    "[scrollbar-width:thin] [scrollbar-color:hsl(var(--muted-foreground)_/_0.35)_transparent] " +
    "md:[&::-webkit-scrollbar]:h-1.5 md:[&::-webkit-scrollbar-thumb]:rounded-full " +
    "md:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 md:[&::-webkit-scrollbar-track]:bg-transparent";

  if (!loading && rows.length === 0) {
    return null;
  }

  return (
    <section
      className={cn("min-w-0 shrink-0", className)}
      aria-label="Latest reviews"
    >
      <div className="mb-3 flex items-baseline justify-between gap-3 px-0.5">
        <div>
          <h2 className="text-[15px] font-black tracking-tight text-slate-900 dark:text-white">
            Latest reviews
          </h2>
          <p className="text-[12px] font-medium text-muted-foreground">
            {loading ? "Loading…" : "Scroll sideways to see recent feedback"}
          </p>
        </div>
      </div>

      <div className={cn(scrollClass)}>
        {loading && rows.length === 0
          ? Array.from({ length: Math.min(limit, 4) }).map((_, i) => (
              <div
                key={`sk-${i}`}
                className="h-[14rem] min-w-[300px] shrink-0 snap-start rounded-3xl border border-gray-100 bg-muted/40 animate-pulse dark:border-white/10 md:min-w-[400px]"
              />
            ))
          : rows.map((r, idx) => {
              const reviewerName = r.reviewer?.full_name?.trim() || "Anonymous";
              const revieweeName = r.reviewee?.full_name?.trim() || "Member";
              const text = (r.review_text || "").trim();
              const revieweeId = r.reviewee?.id?.trim() || "";
              const rating = Math.max(0, Math.min(5, Number(r.rating) || 0));
              const ringClass =
                avatarGradients[idx % avatarGradients.length] ?? avatarGradients[0];

              return (
                <button
                  key={r.id}
                  type="button"
                  disabled={!revieweeId}
                  onClick={() => {
                    if (!revieweeId) return;
                    navigate(`/profile/${encodeURIComponent(revieweeId)}`);
                  }}
                  className={cn(
                    "group relative min-w-[300px] shrink-0 snap-start rounded-3xl border border-gray-100 bg-white p-8 pt-14 text-left shadow-xl transition-all duration-500",
                    "hover:shadow-2xl dark:border-white/10 dark:bg-zinc-900",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "md:min-w-[400px]",
                    !revieweeId && "cursor-default opacity-80 hover:shadow-xl",
                  )}
                >
                  {/* Landing-style floating circular avatar in gradient ring */}
                  <div
                    className={cn(
                      "pointer-events-none absolute -top-10 left-8 h-20 w-20 rounded-full bg-gradient-to-br p-1.5 shadow-xl",
                      "transition-transform duration-500 group-hover:scale-110",
                      ringClass,
                    )}
                    aria-hidden
                  >
                    <Avatar className="h-full w-full rounded-full border-4 border-white dark:border-zinc-900">
                      <AvatarImage
                        src={r.reviewer?.photo_url || undefined}
                        alt=""
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-transparent font-bold text-2xl text-white">
                        {initials(reviewerName)}
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  <div className="flex min-w-0 flex-col gap-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h4 className="flex items-center gap-1.5 text-xl font-bold text-gray-900 transition-colors group-hover:text-primary dark:text-white">
                          <span className="truncate">{reviewerName}</span>
                          {r.reviewer?.is_verified ? (
                            <BadgeCheck
                              className="h-5 w-5 shrink-0 translate-y-px fill-emerald-500 text-white"
                              strokeWidth={2.5}
                              aria-label="Verified"
                            />
                          ) : null}
                        </h4>
                        <p className="mt-1 truncate text-[13px] font-semibold text-muted-foreground">
                          for {revieweeName}
                          {r.created_at ? (
                            <span className="text-muted-foreground/80">
                              {" "}
                              · {formatReviewDate(r.created_at)}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1">
                        <Star
                          className="h-4 w-4 fill-yellow-400 text-yellow-400"
                          aria-hidden
                        />
                        <span className="text-[13px] font-black text-yellow-700 dark:text-yellow-500">
                          {rating.toFixed(1).replace(/\.0$/, "")}
                        </span>
                      </div>
                    </div>
                    {text ? (
                      <p className="line-clamp-4 text-base italic leading-relaxed text-gray-700 dark:text-slate-300 md:text-lg">
                        “{text}”
                      </p>
                    ) : (
                      <p className="text-base italic text-muted-foreground md:text-[17px]">
                        Rated {rating.toFixed(1).replace(/\.0$/, "")} stars.
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
      </div>
    </section>
  );
}
