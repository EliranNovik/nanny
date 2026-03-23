import { MapPin, Navigation, ExternalLink, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getNativeMapUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface MapFallbackProps {
  job: any;
  className?: string;
  onRetry?: () => void;
}

export default function MapFallback({ job, className, onRetry }: MapFallbackProps) {
  if (!job) return null;

  const isPickupDelivery = job.service_type === 'pickup_delivery';
  const address = isPickupDelivery 
    ? job.service_details?.to_address || "Destination Address" 
    : (job.location_city || job.address || "Job Location");

  const providers = [
    { 
      name: 'Google Maps', 
      icon: <Navigation className="w-5 h-5" />, 
      url: getNativeMapUrl(job, 'google'),
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'
    },
    { 
      name: 'Apple Maps', 
      icon: <img src="https://upload.wikimedia.org/wikipedia/commons/2/2f/Apple_Maps_icon.png" alt="Apple" className="w-5 h-5 rounded-md" />, 
      url: getNativeMapUrl(job, 'apple'),
      color: 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'
    },
    { 
      name: 'Waze', 
      icon: <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR_x-vP_k-k_k-k_k-k_k-k_k-k_k-k_k-k_k" alt="Waze" className="w-5 h-5 rounded-full" />, 
      url: getNativeMapUrl(job, 'waze'),
      color: 'bg-sky-50 text-sky-600 border-sky-100 hover:bg-sky-100'
    }
  ];

  return (
    <div className={cn(
      "h-full w-full bg-slate-50 dark:bg-zinc-900/50 flex flex-col items-center justify-center p-8 text-center",
      className
    )}>
      <div className="w-20 h-20 rounded-[2rem] bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 mb-6 animate-pulse">
        <MapPin className="w-10 h-10" />
      </div>

      <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">Can't Load Preview</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 max-w-xs">
        We're having trouble loading the embedded map, but you can still navigate to <span className="font-bold text-slate-700 dark:text-slate-200">{address}</span> using your favorite app.
      </p>

      <div className="grid grid-cols-1 gap-3 w-full max-w-[280px]">
        {providers.map((p) => (
          <Button
            key={p.name}
            variant="outline"
            className={cn(
              "h-14 rounded-2xl border flex items-center justify-start gap-3 px-5 transition-all active:scale-95 group",
              p.color
            )}
            onClick={() => window.open(p.url, '_blank')}
          >
            {p.icon}
            <div className="flex flex-col items-start">
               <span className="text-xs font-bold uppercase tracking-widest opacity-60 leading-none mb-1">Open In</span>
               <span className="text-sm font-bold leading-none">{p.name}</span>
            </div>
            <ExternalLink className="w-3 h-3 ml-auto opacity-40 group-hover:opacity-100 transition-opacity" />
          </Button>
        ))}
      </div>

      {onRetry && (
        <button 
          onClick={onRetry}
          className="mt-8 text-xs font-bold text-slate-400 hover:text-orange-500 uppercase tracking-widest transition-colors flex items-center gap-2"
        >
          <Compass className="w-4 h-4" /> Try Loading Again
        </button>
      )}
    </div>
  );
}
