import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useFreelancerRequests } from "@/hooks/data/useFreelancerRequests";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Banknote,
  Calendar,
  Loader2,
  MapPin,
  Navigation,
  StickyNote,
} from "lucide-react";
import { SwipeDecisionLayer } from "@/components/discover/SwipeDecisionLayer";
import { SERVICE_CATEGORIES, serviceCategoryLabel } from "@/lib/serviceCategories";
import type { ServiceCategoryId } from "@/lib/serviceCategories";
import { isServiceCategoryId } from "@/lib/serviceCategories";
import {
  getLastCategory,
  setLastCategory,
  hasProfileCoords,
} from "@/lib/discoverMatchPreferences";
import { findOrCreateJobConversation } from "@/lib/findOrCreateJobConversation";
import { insertMatchIntroMessage } from "@/lib/matchIntroMessage";
import { trackEvent } from "@/lib/analytics";
import { useToast } from "@/components/ui/toast";
import { matchSwipeCardShell, matchSwipeSectionLabel } from "@/components/discover/matchSwipeCardStyles";

type JobRow = {
  id: string;
  notifId: string;
  job: {
    id: string;
    client_id: string;
    service_type?: string;
    location_city?: string;
    created_at?: string;
    shift_hours?: string | null;
    time_duration?: string | null;
    notes?: string | null;
    requirements?: string | null;
    start_at?: string | null;
    service_details?: string | null;
    budget_min?: number | null;
    budget_max?: number | null;
    profiles?: { full_name?: string | null; photo_url?: string | null };
  };
};

const R_MIN = 5;
const R_MAX = 100;

function formatJobTitle(serviceType?: string) {
  const s = (serviceType || "").replace(/_/g, " ");
  return s ? s.slice(0, 1).toUpperCase() + s.slice(1) : "Request";
}

/** job_requests text columns may be non-strings from PostgREST (json / numbers). */
function safeJobTrim(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

export default function FreelancerJobsMatchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const { addToast } = useToast();
  const { data: frData, isLoading: frLoading } = useFreelancerRequests(user?.id);

  const [gateCategory, setGateCategory] = useState<ServiceCategoryId | "">(
    () => getLastCategory("work") ?? "",
  );
  const [gateRadius, setGateRadius] = useState(25);
  const [locating, setLocating] = useState(false);

  const category = searchParams.get("category");
  const latS = searchParams.get("lat");
  const lngS = searchParams.get("lng");

  const activeParams = useMemo(() => {
    if (!category || !latS || !lngS) return null;
    if (!isServiceCategoryId(category)) return null;
    const lat = Number(latS);
    const lng = Number(lngS);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { category, lat, lng };
  }, [category, latS, lngS]);

  const stack = useMemo(() => {
    if (!activeParams || !frData?.inboundNotifications) return [];
    const cat = activeParams.category;
    const rows: JobRow[] = [];
    for (const n of frData.inboundNotifications as any[]) {
      const jr = n.job_requests;
      if (!jr?.id || jr.community_post_id) continue;
      if (jr.service_type && jr.service_type !== cat) continue;
      rows.push({
        id: jr.id,
        notifId: n.id,
        job: {
          id: jr.id,
          client_id: jr.client_id,
          service_type: jr.service_type,
          location_city: jr.location_city,
          created_at: jr.created_at,
          shift_hours: jr.shift_hours ?? null,
          time_duration: jr.time_duration ?? null,
          notes: jr.notes ?? null,
          requirements: jr.requirements ?? null,
          start_at: jr.start_at ?? null,
          service_details: jr.service_details ?? null,
          budget_min: jr.budget_min ?? null,
          budget_max: jr.budget_max ?? null,
          profiles: jr.profiles,
        },
      });
    }
    rows.sort((a, b) => {
      const ta = new Date(a.job.created_at || 0).getTime();
      const tb = new Date(b.job.created_at || 0).getTime();
      return tb - ta;
    });
    return rows;
  }, [activeParams, frData]);

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
  }, [activeParams, stack.length]);

  const current = stack[idx] ?? null;

  function applyGate() {
    if (!gateCategory || !profile || !hasProfileCoords(profile)) {
      addToast({
        title: "Location needed",
        description: "Set your location in profile first.",
        variant: "default",
      });
      return;
    }
    setLastCategory("work", gateCategory);
    const lat = Number(profile.location_lat);
    const lng = Number(profile.location_lng);
    const p = new URLSearchParams();
    p.set("category", gateCategory);
    p.set("lat", String(lat));
    p.set("lng", String(lng));
    p.set("radius", String(gateRadius));
    setSearchParams(p, { replace: true });
    trackEvent("jobs_match_gate", { category: gateCategory });
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = new URLSearchParams(searchParams);
        if (gateCategory) p.set("category", gateCategory);
        p.set("lat", String(pos.coords.latitude));
        p.set("lng", String(pos.coords.longitude));
        p.set("radius", String(gateRadius));
        setSearchParams(p, { replace: true });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  const onInstantMatch = useCallback(
    async (row: JobRow) => {
      if (!user?.id || profile?.role !== "freelancer") return;
      trackEvent("instant_match_job", { jobId: row.id });
      const job = row.job;
      const clientId = job.client_id;
      const freelancerId = user.id;
      try {
        const { conversationId, created } = await findOrCreateJobConversation({
          jobId: job.id,
          clientId,
          freelancerId,
        });
        const catLabel = serviceCategoryLabel(
          (job.service_type as ServiceCategoryId) || "other_help",
        );
        const loc = job.location_city?.trim() || "—";
        const timeLabel = job.created_at
          ? new Date(job.created_at).toLocaleString()
          : new Date().toLocaleString();
        if (created) {
          await insertMatchIntroMessage({
            conversationId,
            senderId: user.id,
            payload: {
              kind: "job",
              category: catLabel,
              location: loc,
              time: timeLabel,
            },
          });
        }
        const nav = new URLSearchParams();
        nav.set("conversation", conversationId);
        nav.set("mc", encodeURIComponent(catLabel));
        nav.set("ml", encodeURIComponent(loc));
        nav.set("mt", encodeURIComponent(timeLabel));
        nav.set("mma", "1");
        trackEvent("chat_open_match", { kind: "job" });
        navigate(`/messages?${nav.toString()}`);
      } catch (e: unknown) {
        addToast({
          title: "Could not open chat",
          description: e instanceof Error ? e.message : "Try again.",
          variant: "error",
        });
      }
    },
    [user?.id, profile?.role, navigate, addToast],
  );

  if (!activeParams) {
    return (
      <div className="min-h-screen bg-background pb-8">
        <div className="app-desktop-shell max-w-md space-y-6 pt-8">
          <h1 className="text-2xl font-black tracking-tight">Find jobs</h1>
          <p className="text-sm text-muted-foreground">
            Choose your service category and confirm location context.
          </p>
          <Card>
            <CardContent className="space-y-4 p-5">
              <Select
                value={gateCategory || undefined}
                onValueChange={(v) =>
                  setGateCategory(isServiceCategoryId(v) ? v : "")
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="space-y-2">
                <label className="text-sm font-semibold">
                  Prefer radius context: {gateRadius} km
                </label>
                <input
                  type="range"
                  min={R_MIN}
                  max={R_MAX}
                  step={5}
                  value={gateRadius}
                  onChange={(e) => setGateRadius(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={useMyLocation}
                disabled={locating}
              >
                {locating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Navigation className="h-4 w-4" />
                )}
                Use my location
              </Button>
              <Button
                type="button"
                className="w-full"
                disabled={!gateCategory || !hasProfileCoords(profile)}
                onClick={applyGate}
              >
                Start
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (frLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!frLoading && stack.length === 0) {
    return (
      <div className="app-desktop-shell max-w-md space-y-6 pt-10">
        <h1 className="text-xl font-black">No requests in this category</h1>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
          >
            Change category
          </Button>
          <Button type="button" variant="ghost" asChild>
            <Link to="/freelancer/explore">Go to Explore</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="app-desktop-shell py-10 text-center">
        <p className="text-muted-foreground">You&apos;re caught up.</p>
        <Button className="mt-4" asChild variant="outline">
          <Link to="/freelancer/explore">Explore</Link>
        </Button>
      </div>
    );
  }

  const job = current.job;
  const radiusS = searchParams.get("radius");
  const radiusKm = radiusS ? Number(radiusS) : null;
  const budgetLine =
    job.budget_min != null &&
    job.budget_max != null &&
    job.budget_min <= job.budget_max
      ? `₪${job.budget_min} – ₪${job.budget_max}`
      : null;
  const scheduleLine = (() => {
    const parts: string[] = [];
    if (job.start_at) {
      try {
        const d = new Date(job.start_at);
        if (!Number.isNaN(d.getTime())) {
          parts.push(
            d.toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
          );
        }
      } catch {
        /* ignore */
      }
    }
    const sh = safeJobTrim(job.shift_hours);
    const td = safeJobTrim(job.time_duration);
    if (sh) parts.push(sh);
    if (td) parts.push(td);
    return parts.length ? parts.join(" · ") : null;
  })();

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="app-desktop-shell max-w-md pt-6">
        <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-zinc-400">
          {serviceCategoryLabel(activeParams.category as ServiceCategoryId)}
          {radiusKm != null && Number.isFinite(radiusKm)
            ? ` · ${radiusKm} km`
            : ""}
        </p>
        <SwipeDecisionLayer
          onSwipeLeft={() => {
            trackEvent("jobs_swipe", { dir: "left" });
            setIdx((i) => i + 1);
          }}
          onSwipeRight={() => {
            trackEvent("jobs_swipe", { dir: "right" });
            void onInstantMatch(current);
          }}
          leftStamp="SKIP"
          rightStamp="CHAT"
        >
          <div className={matchSwipeCardShell}>
            <div className="flex gap-4 border-b border-slate-100 p-5 dark:border-zinc-800">
              <div className="relative shrink-0">
                <Avatar className="h-20 w-20 shadow-md ring-0">
                  <AvatarImage
                    src={job.profiles?.photo_url || undefined}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-gradient-to-br from-emerald-50 to-teal-50 text-2xl font-bold text-emerald-700 dark:from-zinc-800 dark:to-zinc-900 dark:text-emerald-300">
                    {(job.profiles?.full_name || "C").charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className="absolute right-0.5 top-0.5 z-10 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900"
                  aria-hidden
                />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="truncate text-lg font-bold leading-tight text-slate-900 dark:text-white">
                  {job.profiles?.full_name || "Client"}
                </p>
                <p className="mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  {formatJobTitle(job.service_type)}
                </p>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <p className={matchSwipeSectionLabel}>Request details</p>
                <div className="mt-2 space-y-2.5 text-sm text-slate-700 dark:text-zinc-200">
                  <div className="flex gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{job.location_city || "Location not set"}</span>
                  </div>
                  {scheduleLine ? (
                    <div className="flex gap-2">
                      <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span className="leading-snug">{scheduleLine}</span>
                    </div>
                  ) : null}
                  {budgetLine ? (
                    <div className="flex gap-2">
                      <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>{budgetLine}</span>
                    </div>
                  ) : null}
                  {safeJobTrim(job.service_details) ? (
                    <p className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm leading-relaxed text-slate-800 shadow-sm dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-100">
                      {safeJobTrim(job.service_details)}
                    </p>
                  ) : null}
                  {safeJobTrim(job.requirements) ? (
                    <div>
                      <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                        Requirements
                      </span>
                      <p className="mt-1 leading-relaxed text-slate-700 dark:text-zinc-200">
                        {safeJobTrim(job.requirements)}
                      </p>
                    </div>
                  ) : null}
                  {safeJobTrim(job.notes) ? (
                    <div className="flex gap-2">
                      <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 dark:text-zinc-400" />
                      <p className="leading-relaxed text-slate-600 dark:text-zinc-300">
                        {safeJobTrim(job.notes)}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </SwipeDecisionLayer>
        <p className="mt-4 text-center text-xs text-slate-500 dark:text-zinc-500">
          Swipe right to open chat · left to skip
        </p>
      </div>
    </div>
  );
}
