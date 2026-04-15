import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getNativeMapUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";
import InternalMap from "./InternalMap";

interface MapFallbackProps {
  job: any;
  className?: string;
  onRetry?: () => void;
  onClose?: () => void;
}

export default function MapFallback({
  job,
  className,
  onRetry,
  onClose,
}: MapFallbackProps) {
  if (!job) return null;

  const isPickupDelivery = job.service_type === "pickup_delivery";
  const address = isPickupDelivery
    ? job.service_details?.to_address || "Destination Address"
    : job.location_city || job.address || "Job Location";

  const providers = [
    {
      name: "Google Maps",
      icon: (
        <img
          src="https://www.gstatic.com/images/branding/product/2x/maps_96dp.png"
          className="w-5 h-5 object-contain"
        />
      ),
      url: getNativeMapUrl(job, "google"),
      color: "bg-white/10 hover:bg-white/20 text-white",
    },
    {
      name: "Apple Maps",
      icon: (
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Apple_Maps_icon.png/120px-Apple_Maps_icon.png"
          className="w-5 h-5 rounded-sm object-contain"
        />
      ),
      url: getNativeMapUrl(job, "apple"),
      color: "bg-white/10 hover:bg-white/20 text-white",
    },
    {
      name: "Waze",
      icon: (
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Waze_icon.png/120px-Waze_icon.png"
          className="w-5 h-5 object-contain"
        />
      ),
      url: getNativeMapUrl(job, "waze"),
      color: "bg-white/10 hover:bg-white/20 text-white",
    },
  ];

  return (
    <div
      className={cn(
        "relative w-full h-full bg-slate-100 dark:bg-zinc-950 group overflow-hidden",
        className,
      )}
    >
      {/* The Internal Map is now the FIRST and DEFAULT fallback */}
      <InternalMap job={job} />

      {/* Glassy Blurred Overlay for Navigation Options */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[92%] max-w-[400px] z-[1000]">
        <div className="bg-black/40 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1 px-1">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest leading-none mb-1">
                Secure Backup View
              </span>
              <span className="text-xs font-extrabold text-white truncate max-w-[180px]">
                Navigating to {address}
              </span>
            </div>
            {onRetry && (
              <button
                onClick={onRetry}
                className="text-[10px] font-bold text-orange-400 hover:text-orange-300 uppercase tracking-wider transition-all"
              >
                Retry Google
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {providers.map((p) => (
              <Button
                key={p.name}
                variant="ghost"
                size="sm"
                className={cn(
                  "flex-1 h-10 rounded-xl border border-white/5 flex items-center justify-center gap-2 transition-all active:scale-95 group/btn",
                  p.color,
                )}
                onClick={() => window.open(p.url, "_blank")}
              >
                <div className="z-10 flex-shrink-0 group-hover/btn:scale-110 transition-transform">
                  {p.icon}
                </div>
                <span className="text-[11px] font-bold z-10 hidden sm:inline truncate">
                  {p.name.split(" ")[0]}
                </span>
                <ExternalLink className="w-2.5 h-2.5 opacity-30 group-hover/btn:opacity-100 transition-opacity z-10 ml-auto sm:ml-0" />
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Close Button (if provided) */}
      {onClose && (
        <div className="absolute top-4 right-4 z-[1001]">
          <button
            onClick={onClose}
            className="p-3 bg-card/90 dark:bg-zinc-800/90 backdrop-blur-sm rounded-full shadow-2xl hover:bg-card dark:hover:bg-zinc-800 transition-all border border-black/5 dark:border-white/5 group"
          >
            <X className="w-5 h-5 text-slate-900 dark:text-white group-hover:scale-110 transition-transform" />
          </button>
        </div>
      )}
    </div>
  );
}
