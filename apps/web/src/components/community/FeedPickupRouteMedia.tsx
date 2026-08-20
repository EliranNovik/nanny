import { lazy, Suspense, useMemo, useRef } from "react";
import { ArrowDownCircle, ArrowUpCircle, Loader2, LocateFixed } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { FeedPickupRoute } from "@/lib/globalFeedPostUi";
import type { JobMapHandle } from "@/components/JobMap";

const JobMap = lazy(() => import("@/components/JobMap"));

export function FeedPickupRouteMedia({
  postId,
  route,
  className,
}: {
  postId: string;
  route: FeedPickupRoute;
  className?: string;
}) {
  const { t } = useTranslation();
  const mapRef = useRef<JobMapHandle>(null);
  const job = useMemo(
    () => ({
      id: postId,
      service_type: "pickup_delivery",
      service_details: {
        from_lat: route.from_lat,
        from_lng: route.from_lng,
        to_lat: route.to_lat,
        to_lng: route.to_lng,
        from_address: route.from_address,
        to_address: route.to_address,
      },
    }),
    [postId, route],
  );

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-zinc-200 dark:bg-zinc-800",
        "aspect-[16/10] max-md:max-h-[16rem] md:max-h-[26rem]",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Suspense
        fallback={
          <div className="flex h-full min-h-[10rem] w-full items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-zinc-400" aria-hidden />
          </div>
        }
      >
        <JobMap
          ref={mapRef}
          job={job}
          interactive
          fitBoundsPadding={{ top: 48, right: 56, bottom: 108, left: 48 }}
        />
      </Suspense>
      {route.from_address || route.to_address ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] space-y-2 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-3 pb-3 pe-16 pt-12">
          {route.from_address ? (
            <p className="flex min-w-0 items-start gap-2 text-[15px] font-bold leading-snug text-white md:text-base">
              <ArrowUpCircle className="mt-0.5 h-5 w-5 shrink-0 text-orange-300 md:h-6 md:w-6" aria-hidden />
              <span className="line-clamp-2">{route.from_address}</span>
            </p>
          ) : null}
          {route.to_address ? (
            <p className="flex min-w-0 items-start gap-2 text-[15px] font-bold leading-snug text-white md:text-base">
              <ArrowDownCircle className="mt-0.5 h-5 w-5 shrink-0 text-sky-300 md:h-6 md:w-6" aria-hidden />
              <span className="line-clamp-2">{route.to_address}</span>
            </p>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          mapRef.current?.fitRoute();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          "absolute bottom-3 right-3 z-[5] flex h-11 w-11 items-center justify-center rounded-full",
          "border border-white/50 bg-white/70 text-zinc-800 shadow-md",
          "backdrop-blur-xl backdrop-saturate-150",
          "transition-transform hover:bg-white/85 active:scale-95",
          "dark:border-white/15 dark:bg-zinc-900/60 dark:text-zinc-100 dark:hover:bg-zinc-900/80",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/70",
        )}
        aria-label={t("feed.global.showFullRoute")}
      >
        <LocateFixed className="h-5 w-5" strokeWidth={2.4} aria-hidden />
      </button>
    </div>
  );
}
