import { cn } from "@/lib/utils";

export function requestHeroWaveToneClass(serviceType: string | null | undefined): string {
  const k = (serviceType ?? "").toLowerCase();
  if (k.includes("nanny") || k.includes("bab")) return "bg-teal-900 text-teal-500";
  if (k.includes("clean")) return "bg-emerald-900 text-emerald-500";
  if (k.includes("cook")) return "bg-orange-900 text-orange-500";
  if (k.includes("pickup") || k.includes("deliver")) return "bg-sky-900 text-sky-500";
  if (k.includes("tech") || k.includes("digital") || k.includes("creative")) {
    return "bg-slate-900 text-slate-500";
  }
  return "bg-zinc-800 text-zinc-500";
}

export function RequestHeroWaves() {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 400 180"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d="M0 52c48 28 96-20 148 8 52 28 84 4 132-8 40-10 80 12 120 28v100H0Z"
        fill="currentColor"
        opacity="0.22"
      />
      <path
        d="M0 88c56 24 92-16 148 4 56 20 88-8 140-4 44 4 76 24 112 36v56H0Z"
        fill="currentColor"
        opacity="0.28"
      />
      <path
        d="M0 124c60 16 100-12 156 0 56 12 84-8 132 4 40 10 72 18 112 18v34H0Z"
        fill="currentColor"
        opacity="0.34"
      />
    </svg>
  );
}

export function DiscoverRequestHeroPlaceholder({
  serviceType,
  className,
}: {
  serviceType: string | null | undefined;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden",
        requestHeroWaveToneClass(serviceType),
        className,
      )}
    >
      <RequestHeroWaves />
    </div>
  );
}
