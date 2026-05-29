import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
  lazy,
  Suspense,
} from "react";
import type { ReactNode } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useJobRequestsRealtime } from "@/hooks/useJobRequestsRealtime";
import { Button } from "@/components/ui/button";
import { MobileSnapBottomSheet } from "@/components/ui/MobileSnapBottomSheet";
import { useToast } from "@/components/ui/toast";
import {
  SERVICE_CATEGORIES,
  isServiceCategoryId,
  serviceCategoryLabel,
  getServiceCategoryImage,
} from "@/lib/serviceCategories";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StarRating } from "@/components/StarRating";
import {
  BadgeCheck,
  Crown,
  Loader2,
  MapPin,
  Medal,
  MessageCircle,
  StopCircle,
  Trophy,
  Video,
  X,
  UploadCloud,
  Plus,
  CheckCircle2,
  Clock,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isVideoMediaUrl } from "@/components/ImageLightboxModal";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import type { PublicProfileGalleryRow } from "@/components/helpers/HelperResultProfileCard";
import { publicProfileMediaPublicUrl } from "@/lib/publicProfileMedia";
import { isFreelancerInActive24hLiveWindow } from "@/lib/freelancerLiveWindow";
import {
  canStartInCardLabel,
  respondsWithinCardLabel,
} from "@/lib/liveCanStart";
import { Textarea } from "@/components/ui/textarea";
import { JobRequestCommentsModal } from "@/components/jobs/JobRequestCommentsModal";
import type { CompanionPinHelperVariant } from "@/components/JobMap";
const JobMap = lazy(() => import("@/components/JobMap"));
const ImageLightboxModal = lazy(() =>
  import("@/components/ImageLightboxModal").then((m) => ({
    default: m.ImageLightboxModal,
  })),
);
const FullscreenMapModal = lazy(() =>
  import("@/components/FullscreenMapModal").then((m) => ({
    default: m.FullscreenMapModal,
  })),
);
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const a =
    s1 * s1 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * s2 * s2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a))));
}

/** When helpers have no profile GPS, scatter pins near route / job centroid (deterministic per id). */
const MAP_FALLBACK_REGION = { lat: 32.0853, lng: 34.7818 };

/** PostgREST / JSON may return decimals as strings; normalize robustly. */
function parseGeoCoord(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const t = value.trim().replace(",", ".");
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  const n =
    typeof value === "number"
      ? value
      : Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function jobGeoAnchor(job: Record<string, unknown> | null | undefined): {
  lat: number;
  lng: number;
} {
  const jlat = parseGeoCoord(job?.location_lat as unknown);
  const jlng = parseGeoCoord(job?.location_lng as unknown);
  if (jlat !== null && jlng !== null && Math.abs(jlat) <= 90 && Math.abs(jlng) <= 180) {
    return { lat: jlat, lng: jlng };
  }
  const sd = job?.service_details as Record<string, unknown> | undefined;
  if (
    job?.service_type === "pickup_delivery" &&
    sd?.from_lat != null &&
    sd?.from_lng != null &&
    sd?.to_lat != null &&
    sd?.to_lng != null
  ) {
    const a = parseGeoCoord(sd.from_lat);
    const b = parseGeoCoord(sd.from_lng);
    const c = parseGeoCoord(sd.to_lat);
    const d = parseGeoCoord(sd.to_lng);
    if (a !== null && b !== null && c !== null && d !== null) {
      return { lat: (a + c) / 2, lng: (b + d) / 2 };
    }
  }
  if (job?.service_type === "pickup_delivery" && sd?.from_lat != null && sd?.from_lng != null) {
    const a = parseGeoCoord(sd.from_lat);
    const b = parseGeoCoord(sd.from_lng);
    if (a !== null && b !== null) return { lat: a, lng: b };
  }
  return MAP_FALLBACK_REGION;
}

function scatterNearAnchor(
  base: { lat: number; lng: number },
  seed: string,
): { lat: number; lng: number } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const latStep = (((h >>> 9) % 23) - 11) * 0.0031;
  const lngStep = (((h >> 17) % 23) - 11) * 0.0031;
  const cos = Math.cos((base.lat * Math.PI) / 180);
  return {
    lat: base.lat + latStep,
    lng: base.lng + lngStep / (cos > 0.25 ? cos : 0.35),
  };
}

/** Normalize profile city labels for deduping geocoded coordinates. */
function normalizeCityKey(city: string | null | undefined): string | null {
  const t = (city ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return t.length > 0 ? t : null;
}

/** First public image URL uploaded with the request, if any (`service_details.images`). */
function firstJobImage(
  serviceDetails: Record<string, unknown> | null | undefined,
): string | null {
  const imgs = (serviceDetails as Record<string, unknown> | null)?.images;
  if (!Array.isArray(imgs)) return null;
  const found = (imgs as unknown[]).find(
    (u): u is string => typeof u === "string" && u.trim().length > 0,
  );
  return found ?? null;
}

function clientRequestPin(job: Record<string, unknown> | null | undefined): {
  lat: number;
  lng: number;
} | null {
  const lat = parseGeoCoord(job?.location_lat as unknown);
  const lng = parseGeoCoord(job?.location_lng as unknown);
  if (lat === null || lng === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

const LIVE_INSIGHTS_SEARCHING = [
  "Connecting to helpers nearby…",
  "Matching based on availability…",
] as const;
const LIVE_INSIGHTS_RESPONDERS = [
  "Helpers nearby are seeing your request…",
  "Matching based on availability…",
] as const;

export const HOME_SIZES = [
  { id: "1_room", label: "1 Room" },
  { id: "2_rooms", label: "2 Rooms" },
  { id: "3_rooms", label: "3 Rooms" },
  { id: "4_rooms", label: "4 Rooms" },
  { id: "5_plus_rooms", label: "5+ Rooms" },
];

export const COOKING_WHO_FOR = [
  { id: "kids", label: "Kids" },
  { id: "adults", label: "Adults" },
  { id: "family", label: "Family" },
];

export const DELIVERY_WEIGHTS = [
  { id: "light", label: "Light (up to 5kg)" },
  { id: "medium", label: "Medium (5-15kg)" },
  { id: "heavy", label: "Heavy (15kg+)" },
];

export const NANNY_AGE_GROUPS = [
  { id: "0_1", label: "0-1 years" },
  { id: "1_3", label: "1-3 years" },
  { id: "3_6", label: "3-6 years" },
  { id: "6_plus", label: "6+ years" },
];

export const MOBILITY_LEVELS = [
  { id: "independent", label: "Independent" },
  { id: "needs_assistance", label: "Needs Assistance" },
  { id: "wheelchair", label: "Wheelchair Bound" },
  { id: "bedridden", label: "Bedridden" },
];

function formatElapsedTime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (days > 0) {
    return `${days}d ${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function ElapsedTimer({
  createdAt,
  startTime,
}: {
  createdAt?: string | null;
  startTime: number;
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    const tick = () => {
      const start = createdAt ? new Date(createdAt).getTime() : startTime;
      const elapsed = Math.floor((Date.now() - start) / 1000);
      setElapsedSeconds(elapsed >= 0 ? elapsed : 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt, startTime]);
  return <>{formatElapsedTime(elapsedSeconds)}</>;
}

function ConfirmedRequestCommentsPreview({
  requestComments,
  onOpenComments,
}: {
  requestComments: any[];
  onOpenComments: () => void;
}) {
  return (
    <div
      className="cursor-pointer rounded-2xl border border-border/50 bg-background/80 px-3.5 py-3 shadow-sm transition-colors hover:bg-muted/50 dark:bg-background/40"
      onClick={() => onOpenComments()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenComments();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="mb-2 flex items-center justify-between text-[11px] font-black uppercase tracking-wide text-muted-foreground">
        <span>Comments ({requestComments.length})</span>
        <span className="flex items-center text-[10px] font-bold normal-case text-emerald-600">
          Reply &rsaquo;
        </span>
      </div>
      {requestComments.length > 0 ? (
        <div className="space-y-3">
          {requestComments.slice(0, 3).map((c) => (
            <div key={c.id} className="flex items-start gap-2 text-sm">
              <Avatar className="h-6 w-6 shrink-0 ring-1 ring-black/5">
                <AvatarImage src={c.author?.photo_url || undefined} />
                <AvatarFallback className="text-[8px] font-bold">
                  {c.author?.full_name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <span className="mr-1.5 truncate text-xs font-bold text-foreground">
                  {c.author?.full_name || "Member"}
                </span>
                <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                  {c.body}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-1 text-xs italic text-muted-foreground/60">
          No comments yet. Click to reply or add thoughts.
        </p>
      )}
    </div>
  );
}

function ConfirmedRequestSummaryBody({
  job,
  categoryImageSrc,
  requestComments,
  onOpenComments,
  hideComments = false,
  imageClassName = "h-[4.75rem] w-[4.75rem] shrink-0 overflow-hidden rounded-2xl bg-background ring-1 ring-border/60 lg:h-20 lg:w-20",
}: {
  job: any;
  categoryImageSrc: string | null;
  requestComments: any[];
  onOpenComments: () => void;
  hideComments?: boolean;
  imageClassName?: string;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex items-start gap-3">
        <div className={cn("relative", imageClassName)}>
          {categoryImageSrc ? (
            <img
              src={categoryImageSrc}
              alt=""
              className="h-full w-full object-cover"
              loading="eager"
              decoding="async"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl">
              {job.service_type === "cleaning" && "🧹"}
              {job.service_type === "cooking" && "👨‍🍳"}
              {job.service_type === "pickup_delivery" && "📦"}
              {job.service_type === "nanny" && "👶"}
              {job.service_type === "other_help" && "🔧"}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold capitalize text-foreground">
            {job.service_type?.replace("_", " & ")}
            {job.service_type === "other_help" &&
              job.service_details?.other_type &&
              ` - ${job.service_details.other_type.replace(/_/g, " ").charAt(0).toUpperCase() + job.service_details.other_type.replace(/_/g, " ").slice(1)}`}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {job.location_city ? (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                <span>{job.location_city}</span>
              </div>
            ) : null}
            {job.time_duration ? (
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span className="capitalize">
                  {job.time_duration.replace(/_/g, " ")}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {job.service_details?.description || job.service_details?.custom ? (
        <div className="rounded-2xl border border-border/50 bg-background/80 px-3.5 py-3 dark:bg-background/40">
          <div className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
            Notes
          </div>
          {job.service_details?.description ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {job.service_details.description}
            </p>
          ) : null}
          {job.service_details?.custom ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {job.service_details.custom}
            </p>
          ) : null}
        </div>
      ) : null}

      {hideComments ? null : (
        <div className="mt-1">
          <ConfirmedRequestCommentsPreview
            requestComments={requestComments}
            onOpenComments={onOpenComments}
          />
        </div>
      )}
    </div>
  );
}

function ConfirmedPageMoreSpecifics({
  job,
  onOpenFullscreenMap,
}: {
  job: any;
  onOpenFullscreenMap: () => void;
}) {
  return (
    <section className="py-6">
      <h3 className="text-sm font-black uppercase tracking-wide text-muted-foreground">
        More specifics
      </h3>
      <div className="mt-3 space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
          {job.care_frequency && (
            <div className="capitalize">{job.care_frequency.replace("_", " ")}</div>
          )}
          {job.service_details?.kids_count && (
            <div>{job.service_details.kids_count.replace("_", "-")} kids</div>
          )}
          {job.service_type === "cleaning" && job.service_details?.home_size && (
            <div>
              {HOME_SIZES.find((s) => s.id === job.service_details.home_size)
                ?.label || job.service_details.home_size.replace(/_/g, " ")}
            </div>
          )}
          {job.service_type === "cooking" && job.service_details?.who_for && (
            <div>
              For:{" "}
              {COOKING_WHO_FOR.find((w) => w.id === job.service_details.who_for)
                ?.label || job.service_details.who_for.replace(/_/g, " ")}
            </div>
          )}
          {job.service_type === "pickup_delivery" &&
            job.service_details?.weight && (
              <div>
                {DELIVERY_WEIGHTS.find((w) => w.id === job.service_details.weight)
                  ?.label || job.service_details.weight.replace(/_/g, " ")}
              </div>
            )}
          {job.service_type === "nanny" && job.service_details?.age_group && (
            <div>
              Ages:{" "}
              {NANNY_AGE_GROUPS.find((g) => g.id === job.service_details.age_group)
                ?.label || job.service_details.age_group.replace(/_/g, " ")}
            </div>
          )}
          {job.service_type === "other_help" &&
            job.service_details?.mobility_level && (
              <div>{job.service_details.mobility_level.replace(/_/g, " ")}</div>
            )}
        </div>
        {job.service_type === "pickup_delivery" &&
          job.service_details?.from_address &&
          job.service_details?.to_address && (
            <div className="space-y-2 border-t pt-4 text-sm">
              <div className="flex items-start gap-2">
                <span className="min-w-[40px] font-semibold text-green-600">
                  From:
                </span>
                <span className="flex-1 text-muted-foreground">
                  {job.service_details.from_address}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="min-w-[40px] font-semibold text-red-600">
                  To:
                </span>
                <span className="flex-1 text-muted-foreground">
                  {job.service_details.to_address}
                </span>
              </div>
            </div>
          )}
        {(job.service_type === "pickup_delivery" || job.location_city) && (
          <div className="relative h-28 overflow-hidden rounded-2xl border border-slate-200/80 ring-1 ring-black/5 dark:border-border/40 dark:ring-white/10">
            <button
              type="button"
              className="absolute inset-0 z-10 cursor-pointer rounded-2xl bg-transparent p-0 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-primary"
              onClick={onOpenFullscreenMap}
              aria-label="Open full map"
            />
            <div className="h-full w-full">
              <Suspense
                fallback={
                  <div className="h-full min-h-[7rem] w-full bg-muted animate-pulse" />
                }
              >
                <JobMap job={job} />
              </Suspense>
            </div>
          </div>
        )}
      </div>
      <div className="mt-6 border-t border-border/60" />
    </section>
  );
}

function filterJobMediaFiles(files: File[]): File[] {
  return files.filter(
    (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
  );
}

function ConfirmedJobMediaSection({
  job,
  jobId,
  uploadInputId,
  savingDetails,
  onChooseFiles,
  onRemoveAt,
  setLightboxIndex,
  addMediaVariant = "dropzone",
}: {
  job: any;
  jobId: string | undefined;
  uploadInputId: string;
  savingDetails: boolean;
  onChooseFiles: (files: File[]) => void | Promise<void>;
  onRemoveAt: (idx: number) => void | Promise<void>;
  setLightboxIndex: (idx: number | null) => void;
  /** Mobile sheet: tap-only add — no drag-and-drop dropzone. */
  addMediaVariant?: "dropzone" | "button";
}) {
  const fileInput = (
    <input
      type="file"
      id={uploadInputId}
      multiple
      accept="image/*,video/mp4,video/webm,video/quicktime,video/*"
      className="hidden"
      onChange={async (e) => {
        const picked = e.target.files;
        if (!picked?.length || !jobId) return;
        const media = filterJobMediaFiles(Array.from(picked));
        if (media.length) await onChooseFiles(media);
        e.target.value = "";
      }}
    />
  );

  const addMediaControl =
    addMediaVariant === "button" ? (
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full gap-2 rounded-2xl border-border/60 text-[15px] font-semibold"
        disabled={savingDetails || !jobId}
        onClick={() => document.getElementById(uploadInputId)?.click()}
      >
        {savingDetails ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        {savingDetails ? "Uploading…" : "Add media"}
      </Button>
    ) : (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add("border-primary", "bg-primary/5");
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("border-primary", "bg-primary/5");
        }}
        onDrop={async (e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("border-primary", "bg-primary/5");
          const media = filterJobMediaFiles(Array.from(e.dataTransfer.files));
          if (media.length > 0 && jobId) await onChooseFiles(media);
        }}
        className={cn(
          "relative group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-border/60 p-8 text-center transition-all duration-300 sm:p-10",
          "hover:border-primary/50 hover:bg-primary/5",
          savingDetails && "pointer-events-none opacity-50",
        )}
        onClick={() => document.getElementById(uploadInputId)?.click()}
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-[1.8rem] bg-primary/10 text-primary transition-transform duration-500 group-hover:scale-110">
          <UploadCloud className="h-10 w-10" />
        </div>
        <div>
          <h4 className="text-lg font-bold text-foreground">
            Add photos or videos
          </h4>
        </div>
        <Button
          variant="outline"
          size="sm"
          type="button"
          className="mt-2 h-9 gap-1.5 rounded-full border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          disabled={savingDetails}
        >
          <Plus className="h-4 w-4" />
          Add media
        </Button>

        {savingDetails && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-background/50 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                Uploading…
              </span>
            </div>
          </div>
        )}
      </div>
    );

  return (
    <section className="py-6">
      <h3 className="text-sm font-black uppercase tracking-wide text-muted-foreground">
        Photos & videos
      </h3>
      <div className="mt-3">
        <div className="space-y-6">
          {fileInput}
          {addMediaControl}

          {job?.service_details?.images &&
            job.service_details.images.length > 0 && (
              <div
                className={cn(
                  "animate-in duration-700 fade-in slide-in-from-bottom-2",
                  addMediaVariant === "button"
                    ? "-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-5 pb-1 pt-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    : "grid grid-cols-2 gap-4 md:grid-cols-4",
                )}
              >
                {job.service_details.images.map((url: string, idx: number) => (
                  <div
                    key={`${url}-${idx}`}
                    className={cn(
                      "group relative cursor-zoom-in overflow-hidden rounded-2xl border border-border/60",
                      addMediaVariant === "button"
                        ? "aspect-[4/5] w-[min(68vw,15rem)] shrink-0 snap-center"
                        : "aspect-square",
                    )}
                  >
                    {isVideoMediaUrl(url) ? (
                      <button
                        type="button"
                        className="relative h-full w-full border-0 bg-black p-0"
                        onClick={() => setLightboxIndex(idx)}
                        aria-label={`Play video ${idx + 1}`}
                      >
                        <video
                          src={url}
                          muted
                          playsInline
                          className="h-full w-full object-cover"
                        />
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
                          <Video className="h-10 w-10 text-white drop-shadow-md" />
                        </span>
                      </button>
                    ) : (
                      <img
                        src={url}
                        alt={`Job media ${idx + 1}`}
                        className="h-full w-full object-cover"
                        onClick={() => setLightboxIndex(idx)}
                      />
                    )}
                    <div
                      className={cn(
                        "absolute inset-x-0 top-0 z-20 flex justify-end p-2",
                        addMediaVariant === "button"
                          ? "opacity-100"
                          : "opacity-0 transition-opacity group-hover:opacity-100",
                      )}
                    >
                      <button
                        type="button"
                        className="scale-90 rounded-full bg-black/50 p-2 text-white shadow-lg backdrop-blur-md transition-all hover:scale-100 hover:bg-black/70 active:scale-100"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await onRemoveAt(idx);
                        }}
                        aria-label="Remove media"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </section>
  );
}

function LiveRequestHero({
  job,
  freelancers,
  freelancersLoading,
  liveMapHelpers,
  createdAt,
  startTime,
  onNavigateToApplicants,
  /** Mobile: map fills a flex parent; timer/cards clear fixed bottom dock */
  mobileFixedDockLayout = false,
  /** Mobile: sheet expanded — short map; timer stays true bottom-left (no tall-map dock offset) */
  mobileMapCompact = false,
  /** Mobile: Stop fixed to bottom of map (not the request dock). */
  mobileMapBottomActions,
}: {
  job: any | null | undefined;
  freelancers: Freelancer[];
  freelancersLoading: boolean;
  liveMapHelpers: LiveMapHelperSpot[];
  createdAt?: string | null;
  startTime: number;
  onNavigateToApplicants?: () => void;
  mobileFixedDockLayout?: boolean;
  mobileMapCompact?: boolean;
  mobileMapBottomActions?: ReactNode;
}) {
  const { theme } = useTheme();
  const mapDarkMode = theme === "dark";
  const [insightIx, setInsightIx] = useState(0);
  const [matchPulse, setMatchPulse] = useState(false);
  const acceptedSigRef = useRef("0");
  /** When GPS missing, geocode `profiles.city` so pins sit near the helper’s stated city vs the job centroid. */
  const [cityAnchors, setCityAnchors] = useState<
    Record<string, { lat: number; lng: number }>
  >({});
  const cityAnchorsRef = useRef(cityAnchors);
  cityAnchorsRef.current = cityAnchors;
  const cityGeocodePending = useRef<Set<string>>(new Set());

  const acceptedLead = useMemo(
    () => freelancers.find((f) => f.is_open_job_accepted),
    [freelancers],
  );

  const acceptedOpenCount = useMemo(
    () => freelancers.filter((f) => f.is_open_job_accepted).length,
    [freelancers],
  );

  const respondersCount = freelancers.length;

  /** Stable anchor inputs so polling merges (new `job` object refs) don't rebuild pin clusters. */
  const pickupSdKey = (
    [
      (job?.service_details as Record<string, unknown> | undefined)?.from_lat,
      (job?.service_details as Record<string, unknown> | undefined)?.from_lng,
      (job?.service_details as Record<string, unknown> | undefined)?.to_lat,
      (job?.service_details as Record<string, unknown> | undefined)?.to_lng,
    ] as unknown[]
  )
    .map((v) => String(v ?? ""))
    .join("|");

  const jobAnchorKey = useMemo(() => {
    const a = jobGeoAnchor(job as Record<string, unknown>);
    return `${a.lat.toFixed(6)}|${a.lng.toFixed(6)}`;
  }, [job?.location_lat, job?.location_lng, job?.service_type, pickupSdKey]);

  /** Responders who confirmed — full avatar pins. */
  const MAX_HELPER_MAP_PINS = 14;
  /** 24h live nearby — compact dots only; separate cap. */
  const MAX_LIVE_PRESENCE_PINS = 22;

  const companionPins = useMemo(() => {
    const anchor = jobGeoAnchor(job);
    const ranked = [...freelancers].sort((a, b) => {
      const ao = a.is_open_job_accepted ? 1 : 0;
      const bo = b.is_open_job_accepted ? 1 : 0;
      return bo - ao;
    });
    return ranked.slice(0, MAX_HELPER_MAP_PINS).map((f) => {
      const plat = parseGeoCoord(f.location_lat);
      const plng = parseGeoCoord(f.location_lng);
      const hasGps =
        plat !== null &&
        plng !== null &&
        Math.abs(plat) <= 90 &&
        Math.abs(plng) <= 180;
      const cityKey = normalizeCityKey(f.city);
      const geoFromCity =
        cityKey &&
        cityAnchors[cityKey] &&
        Number.isFinite(cityAnchors[cityKey]?.lat);

      let pos: { lat: number; lng: number };
      if (hasGps) {
        pos = { lat: plat, lng: plng };
      } else if (geoFromCity && cityAnchors[cityKey!]) {
        pos = scatterNearAnchor(cityAnchors[cityKey!], f.id);
      } else {
        pos = scatterNearAnchor(anchor, f.id);
      }

      return {
        id: f.id,
        lat: pos.lat,
        lng: pos.lng,
        helper_variant: companionHelperVariant(f),
        approximate: !hasGps,
        photo_url: f.photo_url,
        display_name: f.full_name,
      };
    });
  }, [freelancers, jobAnchorKey, cityAnchors]);

  const livePresencePins = useMemo(() => {
    const anchor = jobGeoAnchor(job);
    return liveMapHelpers.slice(0, MAX_LIVE_PRESENCE_PINS).map((h) => {
      const plat = parseGeoCoord(h.location_lat);
      const plng = parseGeoCoord(h.location_lng);
      const hasGps =
        plat !== null &&
        plng !== null &&
        Math.abs(plat) <= 90 &&
        Math.abs(plng) <= 180;

      const cityKey = normalizeCityKey(h.city);
      const geoFromCity =
        cityKey &&
        cityAnchors[cityKey] &&
        Number.isFinite(cityAnchors[cityKey]?.lat);

      let pos: { lat: number; lng: number };
      if (hasGps) {
        pos = { lat: plat, lng: plng };
      } else if (geoFromCity && cityAnchors[cityKey!]) {
        pos = scatterNearAnchor(cityAnchors[cityKey!], `live-${h.id}`);
      } else {
        pos = scatterNearAnchor(anchor, `live-${h.id}`);
      }

      return {
        id: h.id,
        lat: pos.lat,
        lng: pos.lng,
        approximate: !hasGps,
        photo_url: h.photo_url,
        display_name: h.full_name,
      };
    });
  }, [liveMapHelpers, jobAnchorKey, cityAnchors]);

  /** Geocode unique profile cities when lat/lng are missing (runs after Maps script exposes Geocoder). */
  useEffect(() => {
    let cancelled = false;

    const tryGeocode = () => {
      if (cancelled) return;
      if (typeof google === "undefined" || !google.maps?.Geocoder) return;

      const anchors = cityAnchorsRef.current;
      const geo = new google.maps.Geocoder();

      const needKeys = new Set<string>();
      const collectNeeds = (
        plat: unknown,
        plng: unknown,
        cityVal: string | null | undefined,
      ) => {
        const platN = parseGeoCoord(plat);
        const plngN = parseGeoCoord(plng);
        const hasGps =
          platN !== null &&
          plngN !== null &&
          Math.abs(platN) <= 90 &&
          Math.abs(plngN) <= 180;
        if (hasGps) return;
        const ck = normalizeCityKey(cityVal ?? null);
        if (ck && !anchors[ck] && !cityGeocodePending.current.has(ck)) {
          needKeys.add(ck);
        }
      };

      for (const f of freelancers) {
        collectNeeds(f.location_lat, f.location_lng, f.city);
      }
      for (const h of liveMapHelpers) {
        collectNeeds(h.location_lat, h.location_lng, h.city);
      }

      for (const normalizedKey of needKeys) {
        cityGeocodePending.current.add(normalizedKey);
        const request: google.maps.GeocoderRequest = {
          address: `${normalizedKey}, Israel`,
          componentRestrictions: { country: "il" },
          region: "il",
        };
        const applyLoc = (loc: google.maps.LatLng) => {
          setCityAnchors((prev) =>
            prev[normalizedKey]
              ? prev
              : {
                  ...prev,
                  [normalizedKey]: { lat: loc.lat(), lng: loc.lng() },
                },
          );
        };
        geo.geocode(request, (results, status) => {
          if (cancelled) {
            cityGeocodePending.current.delete(normalizedKey);
            return;
          }
          if (status === "OK" && results?.[0]?.geometry?.location) {
            cityGeocodePending.current.delete(normalizedKey);
            applyLoc(results[0].geometry.location);
            return;
          }
          geo.geocode({ address: normalizedKey }, (resultsB, statusB) => {
            cityGeocodePending.current.delete(normalizedKey);
            if (cancelled) return;
            if (statusB !== "OK" || !resultsB?.[0]?.geometry?.location) return;
            applyLoc(resultsB[0].geometry.location);
          });
        });
      }
    };

    tryGeocode();
    const pollId = window.setInterval(() => {
      if (
        cancelled ||
        typeof google === "undefined" ||
        !google.maps?.Geocoder
      )
        return;
      window.clearInterval(pollId);
      tryGeocode();
    }, 200);
    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [freelancers, liveMapHelpers]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.debug(
      "[LiveRequestHero] map pins — responders:",
      companionPins.length,
      "live dots:",
      livePresencePins.length,
    );
  }, [companionPins, livePresencePins]);

  /** While a driving route is shown, also show the client's saved pin (if the job has coords). */
  const routeClientPin = useMemo(() => {
    if (!job || job.service_type !== "pickup_delivery") return null;
    return clientRequestPin(job as Record<string, unknown>);
  }, [job?.service_type, job?.location_lat, job?.location_lng]);

  const headline = acceptedLead
    ? "You're connected"
    : freelancersLoading && freelancers.length === 0
      ? "Finding nearby helpers"
      : freelancers.length === 0
        ? "Finding nearby helpers"
        : "Connecting to helpers nearby";

  const headlineMobile = acceptedLead
    ? "Connected"
    : freelancersLoading && freelancers.length === 0
      ? "Searching…"
      : freelancers.length === 0
        ? "Searching…"
        : "Connecting…";

  const insights = acceptedLead
    ? []
    : freelancers.length === 0
      ? [...LIVE_INSIGHTS_SEARCHING]
      : [...LIVE_INSIGHTS_RESPONDERS];

  useEffect(() => {
    setInsightIx(0);
  }, [freelancers.length, acceptedLead?.id]);

  useEffect(() => {
    if (insights.length <= 1) return;
    const tick = window.setInterval(
      () => setInsightIx((i) => (i + 1) % insights.length),
      4500,
    );
    return () => clearInterval(tick);
  }, [insights.length]);

  const insightLine =
    insights[insightIx % insights.length] ?? insights[0] ?? "";

  const distanceKm = useMemo(() => {
    if (!acceptedLead || !job) return null;
    const jLat = job.location_lat;
    const jLng = job.location_lng;
    const hLat = acceptedLead.location_lat;
    const hLng = acceptedLead.location_lng;
    if (
      jLat == null ||
      jLng == null ||
      hLat == null ||
      hLng == null ||
      Number.isNaN(Number(jLat)) ||
      Number.isNaN(Number(jLng)) ||
      Number.isNaN(Number(hLat)) ||
      Number.isNaN(Number(hLng))
    )
      return null;
    return haversineKm(
      Number(jLat),
      Number(jLng),
      Number(hLat),
      Number(hLng),
    );
  }, [acceptedLead, job]);

  /** Big moment when acceptance first appears (repeat if list later loses/regains acceptance). */
  useEffect(() => {
    if (!acceptedLead) {
      acceptedSigRef.current = "0";
      return;
    }
    if (acceptedSigRef.current === "1") return;
    acceptedSigRef.current = "1";
    setMatchPulse(true);
    const t = window.setTimeout(() => setMatchPulse(false), 780);
    return () => clearTimeout(t);
  }, [acceptedLead]);

  if (!job) {
    return (
      <div className="relative mb-6 mt-4 h-[200px] w-full animate-pulse rounded-[32px] bg-muted max-md:mb-0 max-md:mt-0 md:mb-6" />
    );
  }

  const categoryLabel = serviceCategoryLabel(job.service_type ?? null);
  const categoryImage =
    firstJobImage(job.service_details ?? null) ??
    getServiceCategoryImage(job.service_type ?? null);

  return (
    <div
      className={cn(
        "group relative w-full animate-fade-in overflow-hidden bg-zinc-950",
        "md:rounded-[28px] md:border md:border-white/10 md:shadow-[0_24px_80px_-28px_rgba(0,0,0,0.65)] md:ring-1 md:ring-white/10",
        /* Mobile: fixed-dock page — fill flex parent; else capped hero height */
        mobileFixedDockLayout
          ? "mb-0 mt-0 flex h-full w-full min-h-0 flex-1 max-md:max-h-none"
          : "mb-0 mt-0 h-[min(42vh,360px)] min-h-[220px] flex-1 max-md:max-h-[44vh]",
        "md:mb-0 md:mt-0 md:h-[min(520px,calc(100vh-12rem))] md:max-h-[560px] md:flex-none lg:h-[540px]",
      )}
    >
      <div
        className={cn(
          "absolute inset-0 z-0 transition-[transform,filter] duration-700 ease-out",
          matchPulse && "scale-[1.02] brightness-[0.92]",
        )}
      >
        <Suspense
          fallback={
            <div className="h-full w-full animate-pulse bg-zinc-900 dark:bg-zinc-950" />
          }
        >
          <JobMap
            job={job}
            darkMode={mapDarkMode}
            companionPins={companionPins}
            livePresencePins={livePresencePins}
            companionMicroMotion
            fitBoundsPadding={68}
            clientPin={routeClientPin}
          />
        </Suspense>
      </div>

      {/* Top scrim — improves badge legibility */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-28 bg-gradient-to-b from-black/55 to-transparent"
        aria-hidden
      />

      {/* Mobile — category badge (image + label) so user immediately sees what the request is about */}
      <div className="pointer-events-none absolute right-3 top-3 z-[15] max-w-[min(46%,13rem)] md:hidden">
        <div className="flex items-center gap-2 rounded-2xl bg-black/55 p-1.5 pr-3 shadow-lg backdrop-blur-md">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-white/10 ring-1 ring-inset ring-white/15">
            <img
              src={categoryImage}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase leading-none tracking-wider text-white/70">
              Request
            </p>
            <p className="mt-1 truncate text-[12.5px] font-bold leading-none text-white">
              {categoryLabel}
            </p>
          </div>
        </div>
      </div>

      {/* Mobile — elapsed time + Stop in one bottom bar */}
      {mobileMapBottomActions && !acceptedLead ? (
        <div className="absolute bottom-0 left-0 right-0 z-30 hidden max-md:flex max-md:justify-center max-md:px-2 max-md:pb-1.5">
          <div className="pointer-events-auto inline-flex w-full max-w-md items-center gap-2 rounded-2xl border border-white/10 bg-black/70 p-1.5 pl-3 shadow-lg backdrop-blur-md">
            <div className="flex shrink-0 items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              <span className="font-mono text-[13px] font-bold tabular-nums text-white">
                <ElapsedTimer createdAt={createdAt} startTime={startTime} />
              </span>
            </div>
            <div className="mx-0.5 h-6 w-px shrink-0 bg-white/20" aria-hidden />
            <div className="flex min-w-0 flex-1 items-stretch">
              {mobileMapBottomActions}
            </div>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "pointer-events-none absolute left-3 z-20 hidden max-md:block",
            mobileFixedDockLayout
              ? acceptedLead
                ? mobileMapCompact
                  ? "bottom-3"
                  : "bottom-[10.5rem]"
                : mobileMapCompact
                  ? "bottom-3"
                  : "bottom-[5.75rem]"
              : acceptedLead
                ? "bottom-[7.5rem] sm:bottom-28"
                : "bottom-3",
          )}
        >
          <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 shadow-lg backdrop-blur-md">
            <Clock className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            <span className="font-mono text-[13px] font-bold tabular-nums text-white">
              <ElapsedTimer createdAt={createdAt} startTime={startTime} />
            </span>
          </div>
        </div>
      )}

      {/* Top-left — status + spinner */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[min(52%,14rem)] pr-1 sm:left-4 sm:top-4 md:max-w-[min(85%,22rem)]">
        <div className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-2xl bg-black/50 px-3 py-2 text-[13px] font-semibold text-white shadow-lg backdrop-blur-md sm:gap-2 sm:px-4 sm:py-2.5 sm:text-[15px] md:border md:border-border/50 md:bg-white/95 md:text-foreground dark:md:bg-zinc-950/95">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-200 md:hidden">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Live
          </span>
          <span className="min-w-0 md:hidden">{headlineMobile}</span>
          <span className="hidden min-w-0 md:inline">{headline}</span>
          {!acceptedLead ? (
            <span className="inline-flex shrink-0 items-center" aria-label="Loading">
              <Loader2
                className="h-[1.125rem] w-[1.125rem] animate-spin text-primary"
                aria-hidden
              />
            </span>
          ) : null}
        </div>
      </div>

      {/* Bottom-right — helpers count (desktop / tablet); moved from top-right to leave room for the request summary overlay */}
      {respondersCount > 0 ? (
        <div className="pointer-events-none absolute bottom-4 right-4 z-10 hidden w-[4.85rem] flex-col rounded-2xl border border-sky-500/35 bg-gradient-to-br from-sky-50 to-white px-2.5 py-2 text-center shadow-md backdrop-blur-sm dark:border-sky-500/35 dark:from-sky-950/70 dark:to-zinc-950/95 md:flex">
          <span className="block text-[9px] font-black uppercase tracking-wide text-sky-900/90 dark:text-sky-200/95">
            Helpers
          </span>
          <span className="mt-0.5 block text-[22px] font-black leading-none tabular-nums text-sky-800 dark:text-sky-200">
            {respondersCount}
          </span>
          {acceptedOpenCount > 0 ? (
            <span className="mt-1 block text-[9px] font-bold leading-tight text-amber-700 dark:text-amber-300">
              {acceptedOpenCount} open-offer accept
              {acceptedOpenCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Bottom tray — rotating copy (desktop); mobile uses sheet below map */}
      {!acceptedLead ? (
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-10 hidden max-w-xl md:right-auto md:block">
          <div className="rounded-2xl border border-white/25 bg-neutral-950/95 px-4 py-3 text-center shadow-xl shadow-black/30 backdrop-blur-md md:text-left">
            <p className="text-sm font-semibold leading-snug tracking-tight text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.85)] transition-opacity duration-300">
              {insightLine}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="absolute inset-0 z-20 animate-in fade-in duration-400 bg-black/25 backdrop-blur-[1px]" />
          <div
            key={acceptedLead.id}
            className={cn(
              "absolute left-3 right-3 z-30 animate-in fade-in zoom-in-[0.985] slide-in-from-bottom-6 duration-500 sm:left-4 sm:right-4 md:bottom-5 md:left-auto md:right-6 md:w-full md:max-w-sm",
              mobileFixedDockLayout
                ? mobileMapCompact
                  ? "bottom-[4.75rem]"
                  : "bottom-[9.5rem]"
                : "bottom-4",
            )}
          >
            <div className="rounded-[22px] border border-border/80 bg-white p-4 text-center shadow-[0_20px_50px_rgba(0,0,0,0.32)] dark:bg-zinc-950 sm:p-5">
              <div className="relative mx-auto mb-3 inline-flex">
                <Avatar className="h-14 w-14 ring-[3px] ring-emerald-500/25 sm:h-16 sm:w-16 md:h-[4.75rem] md:w-[4.75rem]">
                  <AvatarImage src={acceptedLead.photo_url ?? undefined} />
                  <AvatarFallback className="text-xl font-black">
                    {acceptedLead.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-emerald-500 shadow-md sm:h-9 sm:w-9 dark:border-zinc-950">
                  <CheckCircle2 className="h-4 w-4 text-white sm:h-5 sm:w-5" aria-hidden />
                </span>
              </div>
              <h3 className="text-[16px] font-black tracking-tight text-foreground sm:text-[17px]">
                {acceptedLead.full_name} is ready to help
              </h3>
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                {distanceKm != null ? (
                  distanceKm < 1 ? (
                    <>Less than a kilometer away</>
                  ) : (
                    <>About {distanceKm.toFixed(1)} km from your pin</>
                  )
                ) : acceptedLead.city ? (
                  <>Around {acceptedLead.city}</>
                ) : (
                  <>Listed on your request</>
                )}
              </p>
              <Button
                type="button"
                className="mt-4 h-10 w-full rounded-xl text-xs font-bold shadow-md sm:mt-5 sm:h-11"
                onClick={() => {
                  onNavigateToApplicants?.();
                  const el = document.getElementById("applicants-section");
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                View helper
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface FreelancerProfile {
  bio: string | null;
  languages: string[];
  has_first_aid: boolean;
  newborn_experience: boolean;
  special_needs_experience: boolean;
  hourly_rate_min: number | null;
  hourly_rate_max: number | null;
  rating_avg: number;
  rating_count: number;
  live_until?: string | null;
  live_categories?: string[] | null;
  live_can_start_in?: string | null;
}

interface Freelancer {
  id: string;
  full_name: string;
  photo_url: string | null;
  city: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  /** From `profiles.is_verified` on confirmed list API. */
  is_verified?: boolean | null;
  freelancer_profiles: FreelancerProfile;
  confirmation_note?: string | null;
  is_open_job_accepted?: boolean;
}

function liveHelpCornerTierFromCount(
  n: number | null | undefined,
): { kind: "medal" | "trophy" | "crown"; title: string } | null {
  if (n == null || n <= 0) return null;
  if (n === 1)
    return {
      kind: "medal",
      title: "First live help booking this week",
    };
  if (n > 10)
    return {
      kind: "crown",
      title: "Top tier · over 10 live help bookings this week",
    };
  if (n > 5)
    return {
      kind: "trophy",
      title: "Great week · over 5 live help bookings",
    };
  return null;
}

/** Top-left corner badges (Live help this week / Live / Ready in). “Responds within” is on the media hero bottom-right. */
function ConfirmedApplicantHeroTopBadges({
  fp,
  liveHelpWeekCount,
}: {
  fp: FreelancerProfile | null | undefined;
  liveHelpWeekCount?: number | null;
}) {
  const canStartBadge = canStartInCardLabel(fp?.live_can_start_in);
  const liveWindow = isFreelancerInActive24hLiveWindow(fp ?? null);
  const showLiveHelpWeek =
    liveHelpWeekCount != null &&
    Number.isFinite(liveHelpWeekCount) &&
    liveHelpWeekCount > 0;
  const liveHelpTier = showLiveHelpWeek
    ? liveHelpCornerTierFromCount(liveHelpWeekCount)
    : null;

  if (!liveWindow && !canStartBadge && !showLiveHelpWeek) return null;

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-[5] flex max-w-[calc(100%-5.5rem)] flex-col items-start gap-2">
      {showLiveHelpWeek && liveHelpWeekCount != null ? (
        <span
          className={cn(
            "relative inline-flex min-w-[7.75rem] flex-col items-stretch gap-0.5 self-start rounded-xl py-2 pl-3",
            liveHelpTier?.kind === "crown" ? "pr-[3.5rem]" : "pr-[2.75rem]",
            "bg-gradient-to-br from-violet-600/65 to-fuchsia-600/50 text-white backdrop-blur-md",
            "shadow-lg shadow-black/25 ring-1 ring-inset ring-white/15",
          )}
          role="status"
          title="Completed bookings in the last 7 days"
          aria-label={`${liveHelpWeekCount} completed live help bookings in the last 7 days`}
        >
          {liveHelpTier ? (
            <span
              className={cn(
                "pointer-events-none absolute right-1 top-1 inline-flex shrink-0 items-center justify-center rounded-full bg-black/28 shadow-md ring-1 ring-inset ring-white/25 backdrop-blur-md",
                liveHelpTier.kind === "crown" &&
                  "right-0.5 top-0.5 p-1.5",
                liveHelpTier.kind === "trophy" && "right-1 top-1 p-1.5",
                liveHelpTier.kind === "medal" && "right-1 top-1 p-1.5",
              )}
              title={liveHelpTier.title}
              aria-hidden
            >
              {liveHelpTier.kind === "medal" ? (
                <Medal
                  className="h-[15px] w-[15px] text-amber-200 drop-shadow-sm"
                  strokeWidth={2.25}
                  aria-hidden
                />
              ) : liveHelpTier.kind === "trophy" ? (
                <Trophy
                  className="h-[22px] w-[22px] text-amber-200 drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]"
                  strokeWidth={2.35}
                  aria-hidden
                />
              ) : (
                <Crown
                  className="h-8 w-8 text-amber-200 drop-shadow-[0_0_12px_rgba(251,191,36,0.55)]"
                  strokeWidth={2.25}
                  aria-hidden
                />
              )}
            </span>
          ) : null}
          <span className="text-center text-[9px] font-black uppercase leading-none tracking-[0.12em]">
            Live help
          </span>
          <span className="text-center text-[20px] font-black tabular-nums leading-none tracking-tight">
            {liveHelpWeekCount}
          </span>
          <span className="text-center text-[8px] font-bold uppercase tracking-wide text-white/90">
            this week
          </span>
        </span>
      ) : null}
      {liveWindow ? (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full",
            "bg-black/25 px-3 py-1.5 shadow-lg backdrop-blur-xl",
            "text-[10px] font-bold uppercase leading-none tracking-[0.16em] text-white",
            "ring-1 ring-inset ring-white/15",
          )}
          role="status"
          aria-label="Available for jobs"
        >
          <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
          </span>
          <span className="pr-0.5">Available</span>
        </span>
      ) : null}

      {canStartBadge ? (
        <span
          className={cn(
            "inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-1.5 pr-4",
            "bg-black/12 text-white shadow-lg backdrop-blur-md ring-1 ring-inset ring-white/15",
          )}
          role="status"
        >
          <Zap
            className="h-[1.125rem] w-[1.125rem] shrink-0 text-emerald-400"
            strokeWidth={2.5}
            aria-hidden
          />
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold leading-none text-white/80">
              Ready in
            </span>
            <span className="mt-0.5 text-[13px] font-black leading-none tracking-tight text-white">
              {canStartBadge.toLowerCase() === "immediately" ? "Now" : canStartBadge}
            </span>
          </div>
        </span>
      ) : null}
    </div>
  );
}

type ApplicantMediaSlide = {
  key: string;
  kind: "image" | "video";
  src: string;
};

function buildApplicantMediaSlides(
  photoUrl: string | null,
  gallery: PublicProfileGalleryRow[],
): ApplicantMediaSlide[] {
  const slides: ApplicantMediaSlide[] = [];
  const trimmed = photoUrl?.trim();
  if (trimmed) {
    slides.push({ key: "profile-photo", kind: "image", src: trimmed });
  }
  const sorted = [...gallery].sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  for (const row of sorted) {
    slides.push({
      key: row.id,
      kind: row.media_type === "video" ? "video" : "image",
      src: publicProfileMediaPublicUrl(row.storage_path),
    });
  }
  return slides;
}

/** Helpers-style horizontal media strip + slide index (confirmed applicant cards). */
function ConfirmedApplicantMediaHero({
  userId,
  photoUrl,
  initials,
  gallery,
  topBadges,
  respondsWithinLabel,
  bottomOverlay,
}: {
  userId: string;
  photoUrl: string | null;
  initials: string;
  gallery: PublicProfileGalleryRow[];
  topBadges: ReactNode;
  /** Placed bottom-right on the image, above the name strip. */
  respondsWithinLabel?: string | null;
  bottomOverlay: ReactNode;
}) {
  const slides = useMemo(
    () => buildApplicantMediaSlides(photoUrl, gallery),
    [photoUrl, gallery],
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const showStrip = slides.length > 1;
  const slidesKey = useMemo(() => slides.map((s) => s.key).join("|"), [slides]);

  const syncIndex = useCallback(() => {
    const el = scrollRef.current;
    if (!el || slides.length === 0) return;
    const w = el.clientWidth;
    if (w <= 0) return;
    const idx = Math.min(
      slides.length - 1,
      Math.max(0, Math.round(el.scrollLeft / w)),
    );
    setActiveIndex(idx);
  }, [slides.length]);

  useEffect(() => {
    syncIndex();
  }, [slidesKey, syncIndex]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: 0, behavior: "auto" });
    setActiveIndex(0);
  }, [userId, photoUrl, slidesKey]);

  return (
    <div
      className={cn(
        "relative aspect-[3/4] w-full max-md:max-h-[min(48vh,380px)] max-md:min-h-[200px] shrink-0 overflow-hidden rounded-t-[26px] bg-transparent text-left",
        "transition-[transform,filter] group-hover:brightness-[1.02]",
      )}
    >
      {showStrip ? (
        <div
          ref={scrollRef}
          onScroll={() => {
            window.requestAnimationFrame(syncIndex);
          }}
          className={cn(
            "absolute inset-0 z-0 flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden",
            "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
            "overscroll-x-contain [-webkit-overflow-scrolling:touch]",
          )}
        >
          {slides.map((slide) => (
            <div
              key={slide.key}
              className="relative h-full w-full min-w-full max-w-full shrink-0 snap-start snap-always overflow-hidden"
            >
              {slide.kind === "video" ? (
                <div
                  className="relative h-full w-full overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <video
                    src={slide.src}
                    className="absolute inset-0 h-full w-full bg-black object-cover object-center"
                    muted
                    playsInline
                    controls
                    preload="metadata"
                    controlsList="nodownload"
                  />
                </div>
              ) : (
                <img
                  src={slide.src}
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full bg-black object-cover object-center select-none"
                  draggable={false}
                />
              )}
            </div>
          ))}
        </div>
      ) : slides.length === 1 ? (
        <div className="absolute inset-0 z-0 overflow-hidden">
          {slides[0]!.kind === "video" ? (
            <div
              className="relative h-full w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <video
                src={slides[0]!.src}
                className="absolute inset-0 h-full w-full bg-black object-cover object-center"
                muted
                playsInline
                controls
                preload="metadata"
                controlsList="nodownload"
              />
            </div>
          ) : (
            <img
              src={slides[0]!.src}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full bg-black object-cover object-center select-none"
              draggable={false}
            />
          )}
        </div>
      ) : (
        <div className="absolute inset-0 z-0 flex items-center justify-center bg-gradient-to-br from-primary/25 via-muted to-primary/10">
          <Avatar className="h-28 w-28 border-4 border-white/80 shadow-xl ring-2 ring-primary/20">
            <AvatarFallback className="bg-primary/15 text-3xl font-black text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      {showStrip ? (
        <>
          <div
            className="pointer-events-none absolute left-1/2 top-3 z-[14] -translate-x-1/2"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="rounded-full bg-black/15 px-3 py-2 shadow-lg backdrop-blur-xl">
              <div className="flex items-center justify-center gap-1.5">
                {slides.map((s, idx) => (
                  <span
                    key={`${s.key}-dot`}
                    className={cn(
                      "h-1.5 w-7 rounded-full",
                      idx === activeIndex
                        ? "bg-white/85 shadow-[0_0_10px_rgba(255,255,255,0.25)]"
                        : "bg-white/20",
                    )}
                    aria-hidden
                  />
                ))}
              </div>
            </div>
          </div>
          <div
            className="pointer-events-none absolute right-3 top-3 z-[15] rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-black tabular-nums text-white shadow-md ring-1 ring-white/20"
            aria-label={`Media ${activeIndex + 1} of ${slides.length}`}
          >
            {activeIndex + 1} / {slides.length}
          </div>
        </>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[18]">
        {topBadges}
      </div>

      {respondsWithinLabel ? (
        <div className="pointer-events-none absolute right-3 top-3 z-[17] max-w-[min(100%-1.5rem,11rem)]">
          <span
            className={cn(
              "inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-1.5 pr-4",
              "bg-black/12 text-white shadow-lg backdrop-blur-md ring-1 ring-inset ring-white/15",
            )}
            role="status"
          >
            <MessageCircle
              className="h-[1.125rem] w-[1.125rem] shrink-0 text-purple-300"
              strokeWidth={2.5}
              aria-hidden
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold leading-none text-white/80">
                Replies
              </span>
              <span className="mt-0.5 text-[13px] font-black leading-none tracking-tight text-white">
                {respondsWithinLabel}
              </span>
            </div>
          </span>
        </div>
      ) : null}

      <div
        className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black/85 via-black/25 to-transparent"
        aria-hidden
      />

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[3] space-y-2 p-4 pt-16">
        {bottomOverlay}
      </div>
    </div>
  );
}

/** Map-only layer from API `live_map_helpers` (24h go-live, not job responders). */
interface LiveMapHelperSpot {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  city?: string | null;
}

function companionHelperVariant(f: Freelancer): CompanionPinHelperVariant {
  return f.is_open_job_accepted ? "open_offer" : "confirmed";
}

function freelancerListSignature(rows: Freelancer[]): string {
  return rows
    .map(
      (f) =>
        `${f.id}\u001f${f.confirmation_note ?? ""}\u001f${f.is_open_job_accepted ? "1" : "0"}`,
    )
    .join("\u001e");
}

function liveMapHelpersSignature(rows: LiveMapHelperSpot[]): string {
  return rows
    .map(
      (r) =>
        `${r.id}\u001f${String(r.location_lat ?? "")}\u001f${String(r.location_lng ?? "")}\u001f${r.city ?? ""}`,
    )
    .join("\u001e");
}

export default function ConfirmedListPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();

  const seededJob = useMemo(
    () => (location.state as { job?: any } | null)?.job ?? null,
    // Re-read when navigation entry changes
    [location.key],
  );

  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [requestComments, setRequestComments] = useState<any[]>([]);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  /** Full-page blocker only when we have no job to paint yet */
  const [loading, setLoading] = useState(() => !seededJob);
  const [freelancersLoading, setFreelancersLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [startTime] = useState(Date.now());
  const [job, setJob] = useState<any>(seededJob);
  const [customDetails, setCustomDetails] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editDuration, setEditDuration] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [updatingDetails, setUpdatingDetails] = useState(false);
  const [mobileRequestDetailsOpen, setMobileRequestDetailsOpen] =
    useState(false);
  useAuth();

  const [helperReplyStatsByHelperId, setHelperReplyStatsByHelperId] = useState<
    Record<string, { avg_seconds: number; sample_count: number }>
  >({});
  const [liveHelpWeekByHelperId, setLiveHelpWeekByHelperId] = useState<
    Record<string, number>
  >({});
  const [galleryByUserId, setGalleryByUserId] = useState<
    Record<string, PublicProfileGalleryRow[]>
  >({});

  const freelancerIdsKey = useMemo(
    () => [...freelancers].map((f) => f.id).sort().join(","),
    [freelancers],
  );

  useEffect(() => {
    const ids = freelancerIdsKey
      ? freelancerIdsKey.split(",").filter(Boolean)
      : [];
    if (ids.length === 0) {
      setHelperReplyStatsByHelperId({});
      setLiveHelpWeekByHelperId({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const [statRpc, weekRpc] = await Promise.all([
        supabase.rpc("get_helper_chat_response_stats", { p_helper_ids: ids }),
        supabase.rpc("get_helpers_live_help_week_counts", {
          p_helper_ids: ids,
        }),
      ]);
      if (cancelled) return;
      const { data: statRows, error: statErr } = statRpc;
      const { data: weekRows, error: weekErr } = weekRpc;
      if (statErr && import.meta.env.DEV) {
        console.warn(
          "[ConfirmedListPage] get_helper_chat_response_stats:",
          statErr,
        );
      }
      if (weekErr && import.meta.env.DEV) {
        console.warn(
          "[ConfirmedListPage] get_helpers_live_help_week_counts:",
          weekErr,
        );
      }
      if (!statErr && Array.isArray(statRows)) {
        const next: Record<string, { avg_seconds: number; sample_count: number }> =
          {};
        for (const sr of statRows as {
          helper_id: string;
          avg_seconds: number | null;
          sample_count: number | null;
        }[]) {
          if (!sr.helper_id || sr.avg_seconds == null || sr.sample_count == null)
            continue;
          next[sr.helper_id] = {
            avg_seconds: Number(sr.avg_seconds),
            sample_count: Number(sr.sample_count),
          };
        }
        setHelperReplyStatsByHelperId(next);
      } else {
        setHelperReplyStatsByHelperId({});
      }
      if (!weekErr && Array.isArray(weekRows)) {
        const weekNext: Record<string, number> = {};
        for (const wr of weekRows as {
          helper_id: string;
          live_help_week_count: number | string | null;
        }[]) {
          if (!wr.helper_id || wr.live_help_week_count == null) continue;
          const n = Number(wr.live_help_week_count);
          if (!Number.isFinite(n) || n <= 0) continue;
          weekNext[wr.helper_id] = Math.floor(n);
        }
        setLiveHelpWeekByHelperId(weekNext);
      } else {
        setLiveHelpWeekByHelperId({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [freelancerIdsKey]);

  useEffect(() => {
    const userIds = freelancerIdsKey
      ? freelancerIdsKey.split(",").filter(Boolean)
      : [];
    if (userIds.length === 0) {
      setGalleryByUserId({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("public_profile_media")
        .select("id, user_id, media_type, storage_path, sort_order, created_at")
        .in("user_id", userIds);
      if (cancelled) return;
      if (error) {
        if (import.meta.env.DEV) {
          console.warn(
            "[ConfirmedListPage] public_profile_media:",
            error.message,
          );
        }
        setGalleryByUserId({});
        return;
      }
      const rows = (data ?? []) as PublicProfileGalleryRow[];
      const by: Record<string, PublicProfileGalleryRow[]> = {};
      for (const id of userIds) by[id] = [];
      for (const row of rows) {
        const uid = row.user_id;
        if (!by[uid]) by[uid] = [];
        by[uid].push(row);
      }
      for (const uid of userIds) {
        by[uid].sort(
          (a, b) =>
            a.sort_order - b.sort_order ||
            new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime(),
        );
      }
      setGalleryByUserId(by);
    })();
    return () => {
      cancelled = true;
    };
  }, [freelancerIdsKey]);

  const fetchInFlight = useRef(false);
  const lastFreelancerSig = useRef<string>("");
  const [liveMapHelpers, setLiveMapHelpers] = useState<LiveMapHelperSpot[]>([]);

  useEffect(() => {
    const j = (location.state as { job?: any } | null)?.job;
    if (j) setJob(j);
  }, [location.key]);

  async function handleInlineEditDetails() {
    setUpdatingDetails(true);
    try {
      const updatedDetails = {
        ...(job?.service_details || {}),
        description: editNotes,
        custom: editNotes
      };
      
      const { error } = await supabase
        .from("job_requests")
        .update({
          time_duration: editDuration,
          service_details: updatedDetails
        })
        .eq("id", jobId);

      if (error) throw error;
      
      setJob((prev: any) => ({
        ...prev,
        time_duration: editDuration,
        service_details: updatedDetails
      }));
      setIsEditOpen(false);
      addToast({ title: "Success", description: "Job details updated successfully!" });
    } catch (err: any) {
      addToast({ title: "Error", description: err.message || "Failed to update details" });
    } finally {
      setUpdatingDetails(false);
    }
  }

  const fetchConfirmed = useCallback(async () => {
    if (!jobId || fetchInFlight.current) return;
    fetchInFlight.current = true;
    try {
      const debugParam =
        typeof window !== "undefined" &&
        window.localStorage?.getItem("CONFIRMED_MAP_DEBUG") === "1"
          ? "?debug=1"
          : "";

      const data = await apiGet<{
        freelancers: Freelancer[];
        live_map_helpers?: LiveMapHelperSpot[];
        confirm_ends_at: string;
        job: any;
        _map_debug?: Record<string, unknown>;
      }>(`/api/jobs/${jobId}/confirmed${debugParam}`);

      if (data._map_debug && (import.meta.env.DEV || debugParam)) {
        console.warn("[ConfirmedListPage] /confirmed _map_debug:", data._map_debug);
      }
      if (import.meta.env.DEV || debugParam) {
        console.debug(
          "[ConfirmedListPage] responders (list):",
          data.freelancers?.length ?? 0,
          "live_map_helpers (map dots):",
          data.live_map_helpers?.length ?? 0,
        );
      }

      if (data.job) {
        setJob((prev: any) => (prev ? { ...prev, ...data.job } : data.job));
      }

      const sorted = [...data.freelancers].sort((a, b) => {
        const ao = a.is_open_job_accepted ? 1 : 0;
        const bo = b.is_open_job_accepted ? 1 : 0;
        return bo - ao;
      });

      const normalized: Freelancer[] = sorted.map((row: Freelancer) => {
        const raw = row as unknown as {
          freelancer_profiles?: FreelancerProfile | FreelancerProfile[] | null;
        };
        let fp = raw.freelancer_profiles;
        if (Array.isArray(fp)) fp = fp[0] ?? null;
        return {
          ...row,
          freelancer_profiles: (fp ?? {
            bio: null,
            languages: [],
            has_first_aid: false,
            newborn_experience: false,
            special_needs_experience: false,
            hourly_rate_min: null,
            hourly_rate_max: null,
            rating_avg: 0,
            rating_count: 0,
          }) as FreelancerProfile,
        };
      });

      const liveHelpers = data.live_map_helpers ?? [];
      const combinedSig = `${freelancerListSignature(normalized)}\u001e${liveMapHelpersSignature(liveHelpers)}`;
      if (combinedSig !== lastFreelancerSig.current) {
        lastFreelancerSig.current = combinedSig;
        setFreelancers(normalized);
        setLiveMapHelpers(liveHelpers);
      }
    } catch (err) {
      console.error(
        "[ConfirmedListPage] Error fetching confirmed freelancers:",
        err,
      );
      setError("Failed to load job details");
    } finally {
      fetchInFlight.current = false;
      setLoading(false);
      setFreelancersLoading(false);
    }
  }, [jobId]);

  /** Refresh full job row after local edits (notes/images). API already returns full job on poll. */
  async function fetchJobDirectly() {
    if (!jobId) return;
    try {
      const { data, error } = await supabase
        .from("job_requests")
        .select("*")
        .eq("id", jobId)
        .single();

      if (data && !error) {
        setJob((prev: any) => ({ ...prev, ...data }));
      }
    } catch (e) {
      console.error("Error fetching job directly:", e);
    }
  }

  useJobRequestsRealtime({
    jobId,
    onJobUpdate: () => {
      void fetchConfirmed();
      void fetchJobDirectly();
    },
  });

  // Instant-match / browse-only flows removed from this page (kept in helpers browse).

  const handleSaveDetails = async () => {
    if (!jobId || !customDetails.trim()) return;
    setSavingDetails(true);
    try {
      const currentDetails = job?.service_details || {};
      const updatedDetails = {
        ...currentDetails,
        custom: customDetails,
      };

      const { error } = await supabase
        .from("job_requests")
        .update({ service_details: updatedDetails })
        .eq("id", jobId);

      if (error) throw error;

      addToast({
        title: "Details Saved",
        description: "Your custom details have been added to the request.",
        variant: "success",
      });
      fetchJobDirectly();
    } catch (err: any) {
      console.error("[ConfirmedListPage] Error saving details:", err);
      addToast({
        title: "Failed to save details",
        description: err.message || "An error occurred.",
        variant: "error",
      });
    } finally {
      setSavingDetails(false);
    }
  };

  useEffect(() => {
    if (!jobId) return;

    void fetchConfirmed();

    const POLL_MS = 5000;
    const tick = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      )
        return;
      void fetchConfirmed();
    };
    const interval = setInterval(tick, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchConfirmed();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [jobId, fetchConfirmed]);

  const fetchRequestComments = useCallback(async () => {
    if (!jobId) return;
    try {
      const { data, error } = await supabase
        .from("job_request_comments")
        .select(`
          id,
          body,
          created_at,
          author_id
        `)
        .eq("job_request_id", jobId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const authorIds = [...new Set(data.map((c) => c.author_id))];
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, photo_url")
          .in("id", authorIds);

        const profMap = new Map((profs || []).map((p) => [p.id, p]));
        const enriched = data.map((c) => ({
          ...c,
          author: profMap.get(c.author_id) || null,
        }));
        setRequestComments(enriched);
      } else {
        setRequestComments([]);
      }
    } catch (err) {
      console.error("Error fetching request comments:", err);
    }
  }, [jobId]);

  useEffect(() => {
    if (jobId) {
      void fetchRequestComments();
      const interval = setInterval(fetchRequestComments, 5000);
      return () => clearInterval(interval);
    }
  }, [jobId, fetchRequestComments]);

  const removeJobMediaAtIndex = useCallback(
    async (idx: number) => {
      if (!jobId || !job?.service_details?.images?.length) return;
      if (!window.confirm("Remove this photo or video from the request?"))
        return;
      setSavingDetails(true);
      try {
        const newList = job.service_details.images.filter(
          (_: unknown, i: number) => i !== idx,
        );
        const updatedDetails = {
          ...job.service_details,
          images: newList,
        };
        const { error } = await supabase
          .from("job_requests")
          .update({ service_details: updatedDetails })
          .eq("id", jobId);
        if (error) throw error;
        addToast({
          title: "Removed",
          description: "Media removed from your request.",
          variant: "success",
        });
        await fetchJobDirectly();
      } catch (err: unknown) {
        addToast({
          title: "Error",
          description:
            err instanceof Error ? err.message : "Could not remove media.",
          variant: "error",
        });
      } finally {
        setSavingDetails(false);
      }
    },
    [jobId, job, addToast, fetchJobDirectly],
  );

  async function handleFiles(files: File[]) {
    if (!files.length || !jobId) return;
    const media = filterJobMediaFiles(files);
    if (!media.length) {
      addToast({
        title: "Unsupported files",
        description: "Please choose image or video files.",
        variant: "error",
      });
      return;
    }
    setSavingDetails(true);
    try {
      const newImages: string[] = [];
      for (const file of media) {
        const fileExt = file.name.split(".").pop();
        const filePath = `${jobId}/${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("job-images")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("job-images").getPublicUrl(filePath);

        newImages.push(publicUrl);
      }

      const currentImages = job?.service_details?.images || [];
      const updatedDetails = {
        ...(job?.service_details || {}),
        images: [...currentImages, ...newImages],
      };

      const { error: dbError } = await supabase
        .from("job_requests")
        .update({ service_details: updatedDetails })
        .eq("id", jobId);

      if (dbError) throw dbError;

      addToast({
        title: "Media uploaded",
        description: "Your photos and videos have been added to the request.",
        variant: "success",
      });
      fetchJobDirectly();
    } catch (err: any) {
      console.error("[ConfirmedListPage] Error uploading media:", err);
      addToast({
        title: "Upload failed",
        description: err.message || "Could not upload files.",
        variant: "error",
      });
    } finally {
      setSavingDetails(false);
    }
  }

  // Sync customDetails from job data (v2)
  useEffect(() => {
    if (job?.service_details?.custom !== undefined && customDetails === "") {
      setCustomDetails(job.service_details.custom || "");
    }
  }, [job?.service_details?.custom]);

  async function handleSelect(freelancerId: string) {
    setSelecting(freelancerId);
    setError("");

    try {
      const result = await apiPost<{ conversation_id: string }>(
        `/api/jobs/${jobId}/select`,
        { freelancer_id: freelancerId },
      );
      navigate(`/chat/${result.conversation_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to select");
      setSelecting(null);
    }
  }

  async function handleDecline(freelancerId: string) {
    if (!jobId) return;

    setDeclining(freelancerId);
    setError("");

    try {
      await apiPost(`/api/jobs/${jobId}/decline`, {
        freelancer_id: freelancerId,
      });

      // Remove from local state
      setFreelancers((prev) => prev.filter((f) => f.id !== freelancerId));
    } catch (err) {
      console.error("[ConfirmedListPage] Error declining freelancer:", err);
      setError(
        err instanceof Error ? err.message : "Failed to decline freelancer",
      );
    } finally {
      setDeclining(null);
    }
  }

  async function handleStopRequest() {
    if (!jobId) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("job_requests")
        .delete()
        .eq("id", jobId);
      if (error) throw error;
      addToast({
        title: "Request stopped",
        description: "Your job request has been removed.",
        variant: "success",
        duration: 3000,
      });
      navigate("/client/jobs");
    } catch (err: any) {
      addToast({
        title: "Failed to stop request",
        description: err?.message || "Could not delete the job.",
        variant: "error",
        duration: 5000,
      });
    } finally {
      setDeleting(false);
    }
  }

  const liveStatusLine = useMemo(() => {
    if (!job) return "";
    if (freelancers.some((f) => f.is_open_job_accepted)) {
      return "A helper confirmed they can work this request.";
    }
    if (freelancersLoading && freelancers.length === 0) {
      return "Finding nearby helpers…";
    }
    if (freelancers.length === 0) {
      return "Finding nearby helpers…";
    }
    return "Helpers are connecting to your request…";
  }, [job, freelancersLoading, freelancers]);

  const categoryImageSrc = useMemo(() => {
    const raw = (job?.service_type as string | null | undefined) ?? null;
    if (!isServiceCategoryId(raw)) return null;
    return SERVICE_CATEGORIES.find((c) => c.id === raw)?.imageSrc ?? null;
  }, [job?.service_type]);

  const openInlineEdit = useCallback(() => {
    setEditDuration(job?.time_duration || "");
    setEditNotes(
      job?.service_details?.description || job?.service_details?.custom || "",
    );
    setIsEditOpen(true);
  }, [job]);

  const navigateToApplicantsMobile = useCallback(() => {
    window.requestAnimationFrame(() => {
      document.getElementById("applicants-section")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">loading request...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-confirmed-live-request-page=""
      className={cn(
        "relative flex min-h-0 flex-col bg-background",
        "flex-1 max-md:flex-none max-md:min-h-0 max-md:w-full max-md:overflow-visible max-md:pb-0",
        "md:block md:min-h-screen md:overflow-visible md:pb-10",
      )}
    >
      <div className="app-desktop-shell flex min-h-0 max-w-6xl flex-1 flex-col pt-4 max-md:!px-3 max-md:overflow-visible max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] max-md:min-h-0 md:block md:flex-none md:overflow-visible md:pb-10 md:pt-6">
        {/* Desktop: single column — map full-width with request summary overlaid on top-right */}
        <div className="flex min-h-0 flex-1 flex-col animate-fade-in overflow-hidden max-md:min-h-0 max-md:flex-none max-md:overflow-visible md:!overflow-visible md:block md:items-start md:gap-5 md:overflow-visible">

          {/* Map + live status — primary column */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col max-md:-mx-3 max-md:min-h-0 max-md:flex-none">
            <div
              className={cn(
                "relative flex min-h-0 w-full flex-col overflow-hidden max-md:transition-[height,max-height,flex-grow,flex-shrink] max-md:duration-300 max-md:ease-out",
                job
                  ? "max-md:h-[min(44vh,380px)] max-md:min-h-[220px] max-md:flex-none max-md:shrink-0"
                  : "max-md:min-h-[220px] max-md:flex-none",
              )}
            >
              {/* Desktop: floating timer + Stop on top of the map */}
              {job && !freelancers.some((f) => f.is_open_job_accepted) ? (
                <div className="pointer-events-none absolute left-4 top-[4.5rem] z-30 hidden md:block">
                  <div className="pointer-events-auto inline-flex items-center gap-2 rounded-2xl border border-white/40 bg-background/95 p-1.5 pl-3 shadow-xl backdrop-blur-xl dark:border-white/[0.08] dark:bg-zinc-950/90">
                    <div className="inline-flex items-center gap-2">
                      <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="font-mono text-[15px] font-bold tabular-nums text-foreground">
                        <ElapsedTimer
                          createdAt={job?.created_at}
                          startTime={startTime}
                        />
                      </span>
                    </div>
                    <div className="mx-1 h-6 w-px bg-border/60" aria-hidden />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-9 rounded-xl px-3 text-xs font-bold text-white [&_svg]:text-white"
                      onClick={handleStopRequest}
                      disabled={deleting}
                    >
                      {deleting ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <StopCircle className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Stop
                    </Button>
                  </div>
                </div>
              ) : null}

              {/* Desktop: Request summary — floating card on top-right of the map */}
              {job ? (
                <section className="pointer-events-none absolute right-4 top-4 z-30 hidden w-[340px] max-w-[calc(100%-2rem)] md:block lg:w-[360px]">
                  <div className="pointer-events-auto flex max-h-[calc(100%-2rem)] flex-col overflow-hidden rounded-[24px] border border-white/40 bg-background/95 p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] ring-1 ring-black/[0.04] backdrop-blur-xl dark:bg-zinc-950/90 dark:border-white/[0.08] dark:ring-white/[0.06]">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                        Request summary
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={openInlineEdit}
                        className="text-xs font-bold text-emerald-600 hover:bg-emerald-50/50 hover:text-emerald-700"
                      >
                        Edit details
                      </Button>
                    </div>
                    <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
                      <ConfirmedRequestSummaryBody
                        job={job}
                        categoryImageSrc={categoryImageSrc}
                        requestComments={requestComments}
                        onOpenComments={() => setIsCommentsOpen(true)}
                      />
                    </div>
                  </div>
                </section>
              ) : null}

              <LiveRequestHero
                job={job}
                freelancers={freelancers}
                freelancersLoading={freelancersLoading}
                liveMapHelpers={liveMapHelpers}
                createdAt={job?.created_at}
                startTime={startTime}
                onNavigateToApplicants={navigateToApplicantsMobile}
                mobileFixedDockLayout={!!job}
                mobileMapCompact={false}
                mobileMapBottomActions={
                  job &&
                  !freelancers.some((f) => f.is_open_job_accepted) ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-9 w-full min-w-0 rounded-xl px-3 text-[11px] font-bold text-white shadow-md sm:text-xs [&_svg]:text-white"
                      onClick={handleStopRequest}
                      disabled={deleting}
                    >
                      {deleting ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 shrink-0 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
                      ) : (
                        <StopCircle className="mr-1 h-3.5 w-3.5 shrink-0 sm:mr-2 sm:h-4 sm:w-4" />
                      )}
                      Stop
                    </Button>
                  ) : undefined
                }
              />
            </div>

          </div>
        </div>

        {error && (
          <div className="mt-6 border-y border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="mt-8 border-t border-border/50 md:mt-10" />

        {/* Freelancer cards — directly under action buttons */}
        {freelancers.length > 0 && (
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              {freelancers.length} helper{freelancers.length !== 1 ? "s" : ""}{" "}
              available
            </span>
          </div>
        )}
        <div
          id="applicants-section"
          className={cn(
            "mb-8 flex gap-4 pb-3",
            "max-md:flex-col max-md:overflow-x-visible max-md:overflow-y-visible",
            "md:-mx-4 md:mx-0 md:snap-x md:snap-mandatory md:overflow-x-auto md:overflow-y-hidden md:scroll-smooth md:px-4 md:px-0",
            freelancers.length === 0 && "hidden",
          )}
          style={{ scrollbarWidth: "thin" }}
        >
          <div className="flex w-full max-md:flex-col max-md:gap-4 md:flex-shrink-0 md:flex-row md:gap-4 md:pr-1">
            {freelancers.map((freelancer) => {
              const fp = freelancer.freelancer_profiles;
              const initials =
                freelancer.full_name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase() || "?";

              const rateLine =
                fp?.hourly_rate_min && fp?.hourly_rate_max
                  ? `₪${fp.hourly_rate_min}–${fp.hourly_rate_max}/hr`
                  : fp?.hourly_rate_min
                    ? `From ₪${fp.hourly_rate_min}/hr`
                    : fp?.hourly_rate_max
                      ? `Up to ₪${fp.hourly_rate_max}/hr`
                      : null;

              return (
                <div
                  key={freelancer.id}
                  role="link"
                  tabIndex={0}
                  onClick={() =>
                    navigate(`/profile/${encodeURIComponent(freelancer.id)}`)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(
                        `/profile/${encodeURIComponent(freelancer.id)}`,
                      );
                    }
                  }}
                  aria-label={`View ${freelancer.full_name ?? "helper"}'s profile`}
                  className={cn(
                    "group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-[22px] bg-zinc-950 shadow-2xl shadow-black/40 outline-none transition-transform active:scale-[0.995]",
                    "focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "max-md:mx-auto max-md:max-w-lg",
                    "md:w-[min(82vw,300px)] md:flex-shrink-0 md:snap-start",
                  )}
                >
                  <ConfirmedApplicantMediaHero
                    userId={freelancer.id}
                    photoUrl={freelancer.photo_url}
                    initials={initials}
                    gallery={galleryByUserId[freelancer.id] ?? []}
                    topBadges={
                      <ConfirmedApplicantHeroTopBadges
                        fp={fp}
                        liveHelpWeekCount={
                          liveHelpWeekByHelperId[freelancer.id]
                        }
                      />
                    }
                    respondsWithinLabel={respondsWithinCardLabel(
                      helperReplyStatsByHelperId[freelancer.id]?.avg_seconds,
                      helperReplyStatsByHelperId[freelancer.id]?.sample_count,
                    )}
                    bottomOverlay={
                      <>
                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[22px] font-black leading-tight tracking-tight text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.55)]">
                          <div className="flex min-w-0 items-baseline gap-1">
                            <h3 className="line-clamp-2 min-w-0">
                              {freelancer.full_name}
                            </h3>
                            {freelancer.is_verified ? (
                              <BadgeCheck
                                className="h-[0.95em] w-[0.95em] shrink-0 translate-y-[0.06em] fill-emerald-500 text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.45)]"
                                strokeWidth={2.25}
                                aria-label="Certified verified helper"
                              />
                            ) : null}
                          </div>
                          {freelancer.city ? (
                            <span className="line-clamp-1 max-w-full shrink-0 text-[14px] font-semibold leading-tight text-white/90 [text-shadow:0_1px_10px_rgba(0,0,0,0.45)]">
                              {freelancer.city}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <StarRating
                            rating={fp?.rating_avg || 0}
                            totalRatings={fp?.rating_count || 0}
                            size="sm"
                            showCount
                            numberClassName="text-white drop-shadow-sm"
                            countClassName="text-white/75"
                            starClassName="text-amber-400 drop-shadow-sm"
                            emptyStarClassName="text-white/30"
                          />
                          {rateLine ? (
                            <span className="text-[12px] font-bold tabular-nums text-white/90 drop-shadow-sm">
                              {rateLine}
                            </span>
                          ) : null}
                        </div>

                        {(fp?.has_first_aid || fp?.newborn_experience) && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {fp?.has_first_aid && (
                              <span className="inline-flex items-center rounded-full bg-emerald-500/85 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-md backdrop-blur-md">
                                🩹 First Aid
                              </span>
                            )}
                            {fp?.newborn_experience && (
                              <span className="inline-flex items-center rounded-full bg-black/45 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-md backdrop-blur-md ring-1 ring-inset ring-white/15">
                                👶 Newborn
                              </span>
                            )}
                          </div>
                        )}

                        {fp?.bio ? (
                          <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-white/85 [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">
                            {fp.bio}
                          </p>
                        ) : null}

                        {freelancer.confirmation_note ? (
                          <div
                            className={cn(
                              "mt-2 rounded-2xl px-3 py-2 backdrop-blur-md",
                              freelancer.is_open_job_accepted
                                ? "bg-amber-500/25 ring-1 ring-inset ring-amber-300/30"
                                : "bg-white/10 ring-1 ring-inset ring-white/15",
                            )}
                          >
                            <p
                              className={cn(
                                "mb-0.5 text-[10px] font-black uppercase tracking-wide",
                                freelancer.is_open_job_accepted
                                  ? "text-amber-100"
                                  : "text-white/75",
                              )}
                            >
                              Note from helper
                            </p>
                            <p className="line-clamp-2 text-[12.5px] leading-snug text-white">
                              {freelancer.confirmation_note}
                            </p>
                          </div>
                        ) : null}
                      </>
                    }
                  />

                  <div
                    className="flex items-stretch gap-2 border-t border-white/10 bg-zinc-950 px-3 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDecline(freelancer.id);
                      }}
                      disabled={
                        declining === freelancer.id ||
                        selecting === freelancer.id
                      }
                      className="h-11 flex-1 gap-1 rounded-full border-white/15 bg-white/5 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                    >
                      {declining === freelancer.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(freelancer.id);
                      }}
                      disabled={
                        selecting === freelancer.id ||
                        declining === freelancer.id
                      }
                      className="h-11 flex-[1.4] gap-1.5 rounded-full bg-emerald-500 font-bold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600"
                    >
                      {selecting === freelancer.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MessageCircle className="h-4 w-4" />
                      )}
                      Select & Chat
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {freelancersLoading && freelancers.length === 0 && (
          <div className="mb-8 flex flex-col gap-4 pb-3 max-md:px-0 md:flex-row md:overflow-x-auto md:px-0">
            {[0, 1].map((k) => (
              <div
                key={k}
                className="w-full max-w-lg shrink-0 overflow-hidden rounded-[22px] bg-zinc-950 shadow-2xl shadow-black/40 max-md:mx-auto md:w-[min(82vw,300px)] md:snap-start"
              >
                <div className="aspect-[3/4] bg-zinc-900 animate-pulse" />
                <div className="flex items-stretch gap-2 border-t border-white/10 px-3 py-3">
                  <div className="h-11 flex-1 rounded-full bg-zinc-900 animate-pulse" />
                  <div className="h-11 flex-[1.4] rounded-full bg-zinc-900 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!freelancersLoading && freelancers.length === 0 && (
          <div className="py-10 text-center">
            <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No Confirmations</h3>
            <p className="text-muted-foreground mb-4">
              Still waiting for helpers to confirm availability.
            </p>
            <Button onClick={() => navigate("/client/create")}>
              Try Again
            </Button>
          </div>
        )}

        {/* Structured fields & map — desktop inline; mobile uses dialog */}
        {job && (
          <div className="hidden md:block">
          <ConfirmedPageMoreSpecifics
            job={job}
            onOpenFullscreenMap={() => setMapModalOpen(true)}
          />

          <div className="grid gap-10 md:grid-cols-2 md:gap-8">
            {/* Additional Details Section */}
            <section className="py-6">
              <h3 className="text-sm font-black uppercase tracking-wide text-muted-foreground">
                Additional details
              </h3>
              <div className="mt-3">
                <p className="mb-4 text-sm text-muted-foreground">
                  Add any extra details, instructions, or requirements for this
                  job. These will be visible to helpers.
                </p>
                <div className="space-y-4">
                  <Textarea
                    placeholder="Type your custom job details here..."
                    className="min-h-[110px] resize-y border border-border/60 bg-transparent focus-visible:bg-transparent"
                    value={customDetails}
                    onChange={(e) => setCustomDetails(e.target.value)}
                  />
                  <div className="flex justify-end border-t border-border/60 pt-3">
                    <Button
                      onClick={handleSaveDetails}
                      disabled={
                        savingDetails ||
                        customDetails.trim() ===
                          (job?.service_details?.custom || "").trim()
                      }
                    >
                      {savingDetails ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Save Notes
                    </Button>
                  </div>
                </div>
              </div>
              <div className="mt-6 border-t border-border/60 md:hidden" />
            </section>

            <ConfirmedJobMediaSection
              job={job}
              jobId={jobId}
              uploadInputId="confirmed-job-media-desktop"
              savingDetails={savingDetails}
              onChooseFiles={handleFiles}
              onRemoveAt={removeJobMediaAtIndex}
              setLightboxIndex={setLightboxIndex}
            />
          </div>
          </div>
        )}
        {lightboxIndex !== null && (
          <Suspense fallback={null}>
            <ImageLightboxModal
              images={job.service_details?.images || []}
              initialIndex={lightboxIndex}
              isOpen={lightboxIndex !== null}
              onClose={() => setLightboxIndex(null)}
            />
          </Suspense>
        )}
        {job ? (
          <MobileSnapBottomSheet
            expanded={mobileRequestDetailsOpen}
            onExpandedChange={setMobileRequestDetailsOpen}
            bottomOffsetClass="bottom-[max(3.75rem,calc(env(safe-area-inset-bottom,0px)+3.25rem))]"
            ariaLabel="Drag to expand or collapse request details"
            collapsed={
              mobileRequestDetailsOpen ? (
                <div className="flex w-full flex-col items-center bg-background px-4 pb-2 pt-2">
                  <div
                    aria-hidden
                    className="h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/35"
                  />
                  <p className="sr-only">Swipe down to close request details</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setMobileRequestDetailsOpen(true)}
                  className="flex w-full flex-col bg-background pb-3 pt-1 text-left outline-none transition-colors hover:bg-muted/15 active:bg-muted/25"
                  aria-expanded={false}
                  aria-label="Add more information to your request"
                >
                  <div
                    aria-hidden
                    className="mx-auto mb-2 mt-2 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/35"
                  />
                  <div className="flex flex-col items-center gap-1.5 px-6 pb-1 pt-1 text-center">
                    <p className="text-base font-bold leading-snug text-foreground">
                      Add more information
                    </p>
                    <p className="sr-only">{liveStatusLine}</p>
                  </div>
                </button>
              )
            }
          >
            <div className="shrink-0 border-b border-border/40 bg-background px-5 pb-3 pt-1">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black tracking-tight text-foreground">
                  Full request details
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 font-bold text-emerald-600"
                  onClick={() => {
                    setMobileRequestDetailsOpen(false);
                    openInlineEdit();
                  }}
                >
                  Edit details
                </Button>
              </div>
            </div>
            <div className="space-y-5 px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
              <ConfirmedRequestSummaryBody
                job={job}
                categoryImageSrc={categoryImageSrc}
                requestComments={requestComments}
                onOpenComments={() => setIsCommentsOpen(true)}
                hideComments
              />
              <ConfirmedJobMediaSection
                job={job}
                jobId={jobId}
                uploadInputId="confirmed-job-media-mobile-dialog"
                savingDetails={savingDetails}
                onChooseFiles={handleFiles}
                onRemoveAt={removeJobMediaAtIndex}
                setLightboxIndex={setLightboxIndex}
                addMediaVariant="button"
              />
              <ConfirmedRequestCommentsPreview
                requestComments={requestComments}
                onOpenComments={() => setIsCommentsOpen(true)}
              />
              <ConfirmedPageMoreSpecifics
                job={job}
                onOpenFullscreenMap={() => {
                  setMobileRequestDetailsOpen(false);
                  setMapModalOpen(true);
                }}
              />
            </div>
          </MobileSnapBottomSheet>
        ) : null}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 border-none bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden rounded-[32px] animate-fade-in">
            <DialogHeader className="p-6 pb-4 border-b border-border/30">
              <DialogTitle className="text-xl font-black tracking-tight">Edit Request Details</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Duration</label>
                <select
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-bold shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:bg-zinc-900"
                >
                  <option value="1_2_hours">1-2 hours</option>
                  <option value="half_day">Half Day (3-4 hours)</option>
                  <option value="full_day">Full Day (6-8 hours)</option>
                  <option value="multi_day">Multi-day</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Notes / Instructions</label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add any extra information or specific needs..."
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none h-32"
                />
              </div>
            </div>
            <div className="p-6 pt-4 border-t border-border/30 flex items-center justify-end gap-3 bg-zinc-50 dark:bg-zinc-900/50">
              <Button variant="ghost" size="sm" onClick={() => setIsEditOpen(false)} disabled={updatingDetails}>
                Cancel
              </Button>
              <Button variant="default" size="sm" onClick={handleInlineEditDetails} disabled={updatingDetails} className="bg-emerald-600 hover:bg-emerald-700 font-bold px-6">
                {updatingDetails ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {jobId && (
          <JobRequestCommentsModal
            jobId={jobId}
            isOpen={isCommentsOpen}
            onClose={() => setIsCommentsOpen(false)}
            onCommentAdded={fetchRequestComments}
          />
        )}
        {job && (
          <Suspense fallback={null}>
            <FullscreenMapModal
              job={job}
              isOpen={mapModalOpen}
              onClose={() => setMapModalOpen(false)}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
