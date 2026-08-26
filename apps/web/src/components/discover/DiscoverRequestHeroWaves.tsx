import { cn } from "@/lib/utils";
import {
  helpCategoryIdFromServiceDetails,
  resolveHelpCategoryIconId,
} from "@/lib/discoverCategoryTileIcons";

/**
 * Wave tile colors matched to the colored circle in each category illustration.
 * `bg-*` = circle fill, `text-*` = wave overlay.
 */
const CATEGORY_WAVE_TONE: Record<string, string> = {
  cleaning: "bg-[#aeddf5] text-[#4ea3d0]",
  cooking: "bg-[#f9994c] text-[#d06e20]",
  pickup_delivery: "bg-[#d5a9f1] text-[#a56ad4]",
  nanny: "bg-[#fa95ab] text-[#e05c80]",
  technical_help: "bg-[#a4dfbb] text-[#4caf7a]",
  other_help: "bg-[#cbaaf1] text-[#9a6ad8]",
  beauty_personal_care: "bg-[#fd9db7] text-[#e05c88]",
  heavy_lifting_moving: "bg-[#6b73cf] text-[#3d4499]",
  coaching_lessons: "bg-[#79bcf5] text-[#3d8fd4]",
  shopping_errands: "bg-[#d1974f] text-[#a87028]",
  pet_help: "bg-[#f1822a] text-[#c45e10]",
  elderly_help: "bg-[#e7918f] text-[#c45c5c]",
  paperwork_bureaucracy: "bg-[#bdcadb] text-[#6d7d99]",
  event_help: "bg-[#b08ae0] text-[#7d52b8]",
  home_maintenance: "bg-[#fbc93a] text-[#d4a010]",
  digital_creative: "bg-[#5a96e3] text-[#2f6bb8]",
  religious_community: "bg-[#3cb8aa] text-[#1e6f66]",
};

export function requestHeroWaveToneClass(serviceType: string | null | undefined): string {
  const k = (serviceType ?? "").trim().toLowerCase();
  if (k && CATEGORY_WAVE_TONE[k]) return CATEGORY_WAVE_TONE[k];
  if (k.includes("nanny") || k.includes("bab")) return CATEGORY_WAVE_TONE.nanny;
  if (k.includes("clean")) return CATEGORY_WAVE_TONE.cleaning;
  if (k.includes("cook")) return CATEGORY_WAVE_TONE.cooking;
  if (k.includes("pickup") || k.includes("deliver")) return CATEGORY_WAVE_TONE.pickup_delivery;
  if (k.includes("tech")) return CATEGORY_WAVE_TONE.technical_help;
  return CATEGORY_WAVE_TONE.other_help;
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
  serviceDetails,
  className,
}: {
  serviceType: string | null | undefined;
  serviceDetails?: Record<string, unknown> | null;
  className?: string;
}) {
  const toneId =
    resolveHelpCategoryIconId(
      serviceType,
      helpCategoryIdFromServiceDetails(serviceDetails),
    ) ?? serviceType;

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden",
        requestHeroWaveToneClass(toneId),
        className,
      )}
    >
      <RequestHeroWaves />
    </div>
  );
}
