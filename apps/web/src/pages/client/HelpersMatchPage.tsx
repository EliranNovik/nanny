import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
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
import { Clock, Loader2, MapPin, Navigation, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { SwipeDecisionLayer } from "@/components/discover/SwipeDecisionLayer";
import { SERVICE_CATEGORIES, serviceCategoryLabel } from "@/lib/serviceCategories";
import type { ServiceCategoryId } from "@/lib/serviceCategories";
import { isServiceCategoryId } from "@/lib/serviceCategories";
import {
  getLastCategory,
  setLastCategory,
  hasProfileCoords,
} from "@/lib/discoverMatchPreferences";
import {
  fetchRankedHelperStack,
  type HelperRpcRow,
} from "@/lib/fetchRankedHelperStack";
import { findOrCreateDirectConversation } from "@/lib/findOrCreateDirectConversation";
import { findOrCreateJobConversation } from "@/lib/findOrCreateJobConversation";
import { insertMatchIntroMessage } from "@/lib/matchIntroMessage";
import { trackEvent } from "@/lib/analytics";
import { formatPriceHintFromPayload } from "@/lib/availabilityPosts";
import type { AvailabilityPayload } from "@/lib/availabilityPosts";
import { ExpiryCountdown } from "@/components/ExpiryCountdown";
import { matchSwipeCardShell, matchSwipeSectionLabel } from "@/components/discover/matchSwipeCardStyles";

function normalizeCityLabel(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

const R_MIN = 5;
const R_MAX = 100;

type HelperLivePostRow = {
  id: string;
  author_id: string;
  title: string;
  body: string;
  note: string | null;
  expires_at: string;
  created_at: string;
  availability_payload: AvailabilityPayload | null;
};

type ActiveMatchParams = {
  category: string;
  lat: number;
  lng: number;
  radiusKm: number;
  jobId?: string;
};

export default function HelpersMatchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const { addToast } = useToast();

  const jobIdQ = searchParams.get("job_id");
  const [jobScope, setJobScope] = useState<{
    id: string;
    service_type: ServiceCategoryId;
  } | null>(null);
  const [jobScopeErr, setJobScopeErr] = useState<string | null>(null);
  const [jobScopeLoading, setJobScopeLoading] = useState(() => !!jobIdQ);

  const [gateCategory, setGateCategory] = useState<ServiceCategoryId | "">(
    () => getLastCategory("hire") ?? "",
  );
  const [gateRadius, setGateRadius] = useState(() => {
    const r = profile?.service_radius != null ? Number(profile.service_radius) : 25;
    if (Number.isNaN(r)) return 25;
    return Math.min(R_MAX, Math.max(R_MIN, Math.round(r / 5) * 5));
  });
  const [locating, setLocating] = useState(false);

  const [loading, setLoading] = useState(false);
  const [stack, setStack] = useState<HelperRpcRow[]>([]);
  const [livePostByHelperId, setLivePostByHelperId] = useState<
    Record<string, HelperLivePostRow>
  >({});
  const [idx, setIdx] = useState(0);

  const category = searchParams.get("category");
  const latS = searchParams.get("lat");
  const lngS = searchParams.get("lng");
  const radiusS = searchParams.get("radius");

  useEffect(() => {
    if (!jobIdQ || !user?.id) {
      setJobScope(null);
      setJobScopeErr(null);
      setJobScopeLoading(false);
      return;
    }
    let cancelled = false;
    setJobScopeLoading(true);
    setJobScopeErr(null);
    void (async () => {
      const { data, error } = await supabase
        .from("job_requests")
        .select("id, client_id, service_type")
        .eq("id", jobIdQ)
        .maybeSingle();
      if (cancelled) return;
      setJobScopeLoading(false);
      if (error || !data) {
        setJobScope(null);
        setJobScopeErr("We couldn’t load that request.");
        return;
      }
      if (data.client_id !== user.id) {
        setJobScope(null);
        setJobScopeErr("That request isn’t yours.");
        return;
      }
      if (!isServiceCategoryId(data.service_type)) {
        setJobScope(null);
        setJobScopeErr("Invalid category on this request.");
        return;
      }
      setJobScope({ id: data.id, service_type: data.service_type });
    })();
    return () => {
      cancelled = true;
    };
  }, [jobIdQ, user?.id]);

  const activeParams = useMemo((): ActiveMatchParams | null => {
    if (jobIdQ) {
      if (!jobScope || jobScopeLoading || jobScopeErr) return null;
      if (!profile || !hasProfileCoords(profile)) return null;
      const r =
        profile.service_radius != null ? Number(profile.service_radius) : 25;
      const radiusKm = Math.min(
        R_MAX,
        Math.max(R_MIN, Number.isNaN(r) ? 25 : Math.round(r / 5) * 5),
      );
      return {
        category: jobScope.service_type,
        lat: Number(profile.location_lat),
        lng: Number(profile.location_lng),
        radiusKm,
        jobId: jobScope.id,
      };
    }
    if (!category || !latS || !lngS || !radiusS) return null;
    if (!isServiceCategoryId(category)) return null;
    const lat = Number(latS);
    const lng = Number(lngS);
    const radius = Number(radiusS);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius))
      return null;
    return {
      category,
      lat,
      lng,
      radiusKm: Math.min(R_MAX, Math.max(R_MIN, radius)),
    };
  }, [
    jobIdQ,
    jobScope,
    jobScopeLoading,
    jobScopeErr,
    profile,
    category,
    latS,
    lngS,
    radiusS,
  ]);

  const loadStack = useCallback(async () => {
    if (!activeParams || !user?.id) return;
    if (!isServiceCategoryId(activeParams.category)) return;
    setLoading(true);
    trackEvent("helpers_match_fetch", {
      category: activeParams.category,
      jobId: activeParams.jobId,
    });
    try {
      const viewerCityNorm = normalizeCityLabel(profile?.city);
      const ranked = await fetchRankedHelperStack({
        category: activeParams.category,
        searchLat: activeParams.lat,
        searchLng: activeParams.lng,
        radiusKm: activeParams.radiusKm,
        viewerCityNorm,
        excludeUserId: user.id,
      });
      setStack(ranked);
      setIdx(0);

      const authorIds = ranked.map((r) => r.id);
      if (authorIds.length > 0) {
        const nowIso = new Date().toISOString();
        const { data: postRows } = await supabase
          .from("community_posts")
          .select(
            "id, author_id, title, body, note, expires_at, created_at, availability_payload",
          )
          .in("author_id", authorIds)
          .eq("category", activeParams.category)
          .eq("status", "active")
          .gt("expires_at", nowIso);
        const byAuthor: Record<string, HelperLivePostRow> = {};
        const sorted = [...(postRows || [])].sort(
          (a, b) =>
            new Date((b as HelperLivePostRow).created_at).getTime() -
            new Date((a as HelperLivePostRow).created_at).getTime(),
        );
        for (const p of sorted) {
          const row = p as HelperLivePostRow;
          const aid = String(row.author_id);
          if (!byAuthor[aid]) byAuthor[aid] = row;
        }
        setLivePostByHelperId(byAuthor);
      } else {
        setLivePostByHelperId({});
      }
    } catch (e: unknown) {
      console.error(e);
      addToast({
        title: "Could not load helpers",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "error",
      });
      setStack([]);
      setLivePostByHelperId({});
    } finally {
      setLoading(false);
    }
  }, [activeParams, user?.id, profile?.city, addToast]);

  useEffect(() => {
    void loadStack();
  }, [loadStack]);

  const current = stack[idx] ?? null;

  function applyGateAndGo() {
    if (!gateCategory || !profile) return;
    if (!hasProfileCoords(profile)) {
      addToast({
        title: "Location needed",
        description: "Add a location in your profile or use My location.",
        variant: "default",
      });
      return;
    }
    setLastCategory("hire", gateCategory);
    const lat = Number(profile.location_lat);
    const lng = Number(profile.location_lng);
    const p = new URLSearchParams();
    p.set("category", gateCategory);
    p.set("lat", String(lat));
    p.set("lng", String(lng));
    p.set("radius", String(gateRadius));
    setSearchParams(p, { replace: true });
    trackEvent("helpers_match_gate", { category: gateCategory });
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
        trackEvent("helpers_match_gps", {});
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  async function onInstantMatch(helper: HelperRpcRow) {
    if (!user?.id || !profile || profile.role !== "client") {
      addToast({ title: "Sign in as a client", variant: "error" });
      return;
    }
    if (!activeParams || !isServiceCategoryId(activeParams.category)) return;
    trackEvent("instant_match_helper", {
      helperId: helper.id,
      jobId: activeParams.jobId,
    });
    const freelancerId = helper.id;
    const clientId = user.id;
    try {
      let conversationId: string;
      let created: boolean;
      if (activeParams.jobId) {
        const r = await findOrCreateJobConversation({
          jobId: activeParams.jobId,
          clientId,
          freelancerId,
        });
        conversationId = r.conversationId;
        created = r.created;
      } else {
        const r = await findOrCreateDirectConversation({
          clientId,
          freelancerId,
        });
        conversationId = r.conversationId;
        created = r.created;
      }
      const catLabel = serviceCategoryLabel(activeParams.category);
      const loc = helper.city?.trim() || "Nearby";
      const timeLabel = new Date().toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
      if (created) {
        await insertMatchIntroMessage({
          conversationId,
          senderId: user.id,
          payload: {
            kind: "helper",
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
      trackEvent("chat_open_match", { kind: "helper" });
      navigate(`/messages?${nav.toString()}`);
    } catch (e: unknown) {
      addToast({
        title: "Could not open chat",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "error",
      });
    }
  }

  if (jobIdQ && jobScopeLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
      </div>
    );
  }

  if (jobIdQ && jobScopeErr) {
    return (
      <div className="app-desktop-shell max-w-md space-y-4 py-10">
        <h1 className="text-xl font-black">Can’t open browse</h1>
        <p className="text-sm text-muted-foreground">{jobScopeErr}</p>
        <Button type="button" asChild variant="outline">
          <Link to="/client/home">Back to home</Link>
        </Button>
      </div>
    );
  }

  if (jobIdQ && jobScope && !hasProfileCoords(profile)) {
    return (
      <div className="app-desktop-shell max-w-md space-y-4 py-10">
        <h1 className="text-xl font-black">Location needed</h1>
        <p className="text-sm text-muted-foreground">
          Add coordinates to your profile so we can match helpers to this
          request.
        </p>
        <Button type="button" asChild>
          <Link to="/client/profile">Edit profile</Link>
        </Button>
      </div>
    );
  }

  if (!activeParams) {
    return (
      <div className="min-h-screen bg-background pb-8">
        <div className="app-desktop-shell max-w-md space-y-6 pt-8">
          <h1 className="text-2xl font-black tracking-tight">Find helpers</h1>
          <p className="text-sm text-muted-foreground">
            Pick a category and confirm search radius. We use your profile
            location — or GPS below.
          </p>
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Category</label>
                <Select
                  value={gateCategory || undefined}
                  onValueChange={(v) =>
                    setGateCategory(isServiceCategoryId(v) ? v : "")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose category" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_CATEGORIES.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">
                  Radius: {gateRadius} km
                </label>
                <input
                  type="range"
                  min={R_MIN}
                  max={R_MAX}
                  step={5}
                  value={gateRadius}
                  onChange={(e) => setGateRadius(Number(e.target.value))}
                  className="w-full accent-orange-500"
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
                Use my location for search center
              </Button>
              <Button
                type="button"
                className="w-full"
                disabled={!gateCategory || !hasProfileCoords(profile)}
                onClick={applyGateAndGo}
              >
                Start swiping
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loading && stack.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!loading && stack.length === 0) {
    return (
      <div className="app-desktop-shell max-w-md space-y-6 pt-10">
        <h1 className="text-xl font-black">No matches</h1>
        <p className="text-sm text-muted-foreground">
          Try a wider radius, another category, or browse Explore.
        </p>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="default"
            onClick={() => {
              const r = Math.min(R_MAX, activeParams.radiusKm + 15);
              if (activeParams.jobId) {
                addToast({
                  title: "Radius is tied to your profile",
                  description: "Widen service radius in profile settings.",
                  variant: "default",
                });
                return;
              }
              const p = new URLSearchParams(searchParams);
              p.set("radius", String(r));
              setSearchParams(p, { replace: true });
              trackEvent("helpers_match_expand_radius", { radius: r });
            }}
          >
            {activeParams.jobId ? "Profile radius" : "Expand radius (+15 km)"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (activeParams.jobId) {
                navigate(`/client/jobs/${activeParams.jobId}/live`);
                return;
              }
              const p = new URLSearchParams();
              setSearchParams(p, { replace: true });
              trackEvent("helpers_match_change_category", {});
            }}
          >
            {activeParams.jobId ? "Back to request" : "Change category"}
          </Button>
          <Button type="button" variant="ghost" asChild>
            <Link to="/client/explore">Go to Explore</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="app-desktop-shell py-10 text-center text-muted-foreground">
        Done swiping this list.
        <div className="mt-4">
          <Button type="button" asChild variant="outline">
            <Link to="/client/explore">Explore</Link>
          </Button>
        </div>
      </div>
    );
  }

  const dist = current.distance_km;
  const livePost = livePostByHelperId[current.id];
  const priceHint = formatPriceHintFromPayload(livePost?.availability_payload);
  const fp = current.freelancer_profiles;
  const rateLine =
    fp?.hourly_rate_min != null &&
    fp?.hourly_rate_max != null &&
    fp.hourly_rate_min <= fp.hourly_rate_max
      ? `₪${fp.hourly_rate_min}–₪${fp.hourly_rate_max}/h`
      : null;
  const postBlurb =
    (livePost?.note && livePost.note.trim()) ||
    (livePost?.body && livePost.body.trim()) ||
    null;

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="app-desktop-shell max-w-md pt-6">
        {activeParams.jobId && (
          <p className="mb-2 rounded-2xl border border-orange-200/70 bg-orange-500/10 px-3 py-2 text-center text-xs font-semibold text-orange-900 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-100">
            Helpers shown for this request only · category + your profile
            location
          </p>
        )}
        <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-zinc-400">
          {serviceCategoryLabel(activeParams.category as ServiceCategoryId)} ·{" "}
          {activeParams.radiusKm} km
        </p>
        <SwipeDecisionLayer
          onSwipeLeft={() => {
            trackEvent("helpers_swipe", { dir: "left" });
            setIdx((i) => i + 1);
          }}
          onSwipeRight={() => {
            trackEvent("helpers_swipe", { dir: "right" });
            void onInstantMatch(current);
          }}
          variant="availability"
          leftStamp="CHAT"
          rightStamp="MATCH"
        >
          <div className={matchSwipeCardShell}>
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-white">
              <Avatar className="h-full w-full rounded-none">
                <AvatarImage
                  src={current.photo_url || undefined}
                  className="object-cover"
                />
                <AvatarFallback className="rounded-none bg-gradient-to-br from-orange-50 to-amber-50 text-4xl font-bold text-orange-400 dark:from-zinc-800 dark:to-zinc-900 dark:text-orange-200">
                  {(current.full_name || "?").charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span
                className="absolute right-[10%] top-[10%] z-10 h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm ring-2 ring-white dark:ring-zinc-900"
                aria-hidden
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />
            </div>
            <div className="space-y-4 p-5">
              <div>
                <h2 className="text-[1.35rem] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">
                  {current.full_name || "Helper"}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600 dark:text-zinc-300">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4 shrink-0 text-orange-500/90" />
                    {current.city || "—"}
                  </span>
                  {dist != null && (
                    <span className="font-semibold text-orange-600 dark:text-orange-400">
                      {dist < 1
                        ? `${Math.round(dist * 1000)} m`
                        : `${dist.toFixed(1)} km`}
                    </span>
                  )}
                </div>
              </div>

              {livePost ? (
                <div className="space-y-2 rounded-2xl border border-violet-200/70 bg-violet-500/[0.06] p-4 dark:border-violet-500/25 dark:bg-violet-950/35">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                    <span className={matchSwipeSectionLabel}>
                      Live availability post
                    </span>
                  </div>
                  <p className="font-semibold leading-snug text-slate-900 dark:text-zinc-50">
                    {livePost.title?.trim() || "Availability"}
                  </p>
                  {postBlurb ? (
                    <p className="line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
                      {postBlurb}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
                    {priceHint ? (
                      <span className="rounded-full bg-white/80 px-2 py-0.5 font-semibold text-slate-800 shadow-sm dark:bg-zinc-800/80 dark:text-zinc-100">
                        {priceHint}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Clock className="h-3.5 w-3.5" />
                      <ExpiryCountdown
                        expiresAtIso={livePost.expires_at}
                        compact
                        className="!text-xs font-medium"
                      />
                    </span>
                  </div>
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200/90 px-3 py-2 text-center text-xs text-slate-500 dark:border-zinc-600 dark:text-zinc-400">
                  No live board post in this category right now — profile &
                  rates below still apply.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {fp?.available_now ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                    Available now
                  </span>
                ) : null}
                {rateLine ? (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {rateLine}
                  </span>
                ) : null}
              </div>

              {fp?.bio ? (
                <div>
                  <p className={matchSwipeSectionLabel}>About</p>
                  <p className="mt-1 line-clamp-4 text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
                    {fp.bio}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </SwipeDecisionLayer>
        <p className="mt-4 text-center text-xs text-slate-500 dark:text-zinc-500">
          Swipe right to match & chat · left to skip
        </p>
      </div>
    </div>
  );
}
