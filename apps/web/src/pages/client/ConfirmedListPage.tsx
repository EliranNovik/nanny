import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
  memo,
  lazy,
  Suspense,
} from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StarRating } from "@/components/StarRating";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  MapPin,
  Clock,
  MessageCircle,
  RotateCcw,
  StopCircle,
  X,
  Sparkles,
  UploadCloud,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { Textarea } from "@/components/ui/textarea";
const JobMap = lazy(() => import("@/components/JobMap"));
const ImageLightboxModal = lazy(() =>
  import("@/components/ImageLightboxModal").then((m) => ({ default: m.ImageLightboxModal }))
);
const FullscreenMapModal = lazy(() =>
  import("@/components/FullscreenMapModal").then((m) => ({ default: m.FullscreenMapModal }))
);

export const HOME_SIZES = [
  { id: '1_room', label: '1 Room' },
  { id: '2_rooms', label: '2 Rooms' },
  { id: '3_rooms', label: '3 Rooms' },
  { id: '4_rooms', label: '4 Rooms' },
  { id: '5_plus_rooms', label: '5+ Rooms' },
];

export const COOKING_WHO_FOR = [
  { id: 'kids', label: 'Kids' },
  { id: 'adults', label: 'Adults' },
  { id: 'family', label: 'Family' },
];

export const DELIVERY_WEIGHTS = [
  { id: 'light', label: 'Light (up to 5kg)' },
  { id: 'medium', label: 'Medium (5-15kg)' },
  { id: 'heavy', label: 'Heavy (15kg+)' },
];

export const NANNY_AGE_GROUPS = [
  { id: '0_1', label: '0-1 years' },
  { id: '1_3', label: '1-3 years' },
  { id: '3_6', label: '3-6 years' },
  { id: '6_plus', label: '6+ years' },
];

export const MOBILITY_LEVELS = [
  { id: 'independent', label: 'Independent' },
  { id: 'needs_assistance', label: 'Needs Assistance' },
  { id: 'wheelchair', label: 'Wheelchair Bound' },
  { id: 'bedridden', label: 'Bedridden' },
];

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
}

interface Freelancer {
  id: string;
  full_name: string;
  photo_url: string | null;
  city: string | null;
  freelancer_profiles: FreelancerProfile;
  confirmation_note?: string | null;
  is_open_job_accepted?: boolean;
}

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

const ElapsedTimer = memo(function ElapsedTimer({
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
});

function freelancerListSignature(rows: Freelancer[]): string {
  return rows
    .map(
      (f) =>
        `${f.id}\u001f${f.confirmation_note ?? ""}\u001f${f.is_open_job_accepted ? "1" : "0"}`
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
    [location.key]
  );

  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  /** Full-page blocker only when we have no job to paint yet */
  const [loading, setLoading] = useState(() => !seededJob);
  const [freelancersLoading, setFreelancersLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [restarting, setRestarting] = useState(false);
  const [startTime] = useState(Date.now());
  const [job, setJob] = useState<any>(seededJob);
  const [customDetails, setCustomDetails] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [mapModalOpen, setMapModalOpen] = useState(false);

  const fetchInFlight = useRef(false);
  const lastFreelancerSig = useRef<string>("");

  useEffect(() => {
    const j = (location.state as { job?: any } | null)?.job;
    if (j) setJob(j);
  }, [location.key]);

  const fetchConfirmed = useCallback(async () => {
    if (!jobId || fetchInFlight.current) return;
    fetchInFlight.current = true;
    try {
      const data = await apiGet<{
        freelancers: Freelancer[];
        confirm_ends_at: string;
        job: any;
      }>(`/api/jobs/${jobId}/confirmed`);

      if (data.job) {
        setJob((prev: any) => (prev ? { ...prev, ...data.job } : data.job));
      }

      const sorted = [...data.freelancers].sort((a, b) => {
        if (a.is_open_job_accepted && !b.is_open_job_accepted) return -1;
        if (!a.is_open_job_accepted && b.is_open_job_accepted) return 1;
        return 0;
      });

      const sig = freelancerListSignature(sorted);
      if (sig !== lastFreelancerSig.current) {
        lastFreelancerSig.current = sig;
        setFreelancers(sorted);
      }
    } catch (err) {
      console.error("[ConfirmedListPage] Error fetching confirmed freelancers:", err);
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

  const handleSaveDetails = async () => {
    if (!jobId || !customDetails.trim()) return;
    setSavingDetails(true);
    try {
      const currentDetails = job?.service_details || {};
      const updatedDetails = {
        ...currentDetails,
        custom: customDetails
      };

      const { error } = await supabase
        .from('job_requests')
        .update({ service_details: updatedDetails })
        .eq('id', jobId);

      if (error) throw error;

      addToast({ title: "Details Saved", description: "Your custom details have been added to the request.", variant: "success" });
      fetchJobDirectly();
    } catch (err: any) {
      console.error("[ConfirmedListPage] Error saving details:", err);
      addToast({ title: "Failed to save details", description: err.message || "An error occurred.", variant: "error" });
    } finally {
      setSavingDetails(false);
    }
  };

  useEffect(() => {
    if (!jobId) return;

    void fetchConfirmed();

    const POLL_MS = 5000;
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
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

  async function handleFiles(files: File[]) {
    if (!files.length || !jobId) return;
    setSavingDetails(true);
    try {
      const newImages: string[] = [];
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const filePath = `${jobId}/${Math.random()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('job-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('job-images')
          .getPublicUrl(filePath);
          
        newImages.push(publicUrl);
      }

      const currentImages = job?.service_details?.images || [];
      const updatedDetails = {
        ...(job?.service_details || {}),
        images: [...currentImages, ...newImages]
      };

      const { error: dbError } = await supabase
        .from('job_requests')
        .update({ service_details: updatedDetails })
        .eq('id', jobId);

      if (dbError) throw dbError;

      addToast({ title: "Images Uploaded", description: "Your images have been added to the request.", variant: "success" });
      fetchJobDirectly();
    } catch (err: any) {
      console.error("[ConfirmedListPage] Error uploading images:", err);
      addToast({ title: "Upload Failed", description: err.message || "Could not upload images.", variant: "error" });
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
        { freelancer_id: freelancerId }
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
      setError(err instanceof Error ? err.message : "Failed to decline freelancer");
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

  async function handleRestartSearch() {
    if (!jobId) return;

    setRestarting(true);
    setError("");

    try {
      await apiPost(`/api/jobs/${jobId}/restart`, {});
      // Refresh the page to reset timer
      window.location.reload();
    } catch (err) {
      console.error("[ConfirmedListPage] Error restarting search:", err);
      setError(err instanceof Error ? err.message : "Failed to restart search");
    } finally {
      setRestarting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">loading request...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-mesh pb-64 md:pb-32">
      <div className="app-desktop-shell pt-8">
        {/* Timer Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 bg-primary/10">
            <Clock className="w-5 h-5 text-primary animate-pulse-soft" />
            <span className="font-mono font-bold text-lg text-primary">
              <ElapsedTimer createdAt={job?.created_at} startTime={startTime} />
            </span>
          </div>
          <h1 className="text-2xl font-bold mb-2">Waiting for Confirmations...</h1>
          <p className="text-muted-foreground">
            {freelancers.length === 0
              ? "No freelancers have confirmed availability yet"
              : `${freelancers.length} freelancer${freelancers.length > 1 ? "s" : ""} available`}
          </p>

          <div className="flex gap-2 justify-center mt-4">
            <Button
              variant="default"
              size="sm"
              onClick={handleRestartSearch}
              disabled={restarting || deleting}
            >
              {restarting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Restarting...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restart Search
                </>
              )}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleStopRequest}
              disabled={deleting || restarting}
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Stopping...
                </>
              ) : (
                <>
                  <StopCircle className="w-4 h-4 mr-2" />
                  Stop Request
                </>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Freelancer cards — directly under action buttons */}
        {freelancers.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-muted-foreground">
              {freelancers.length} helper{freelancers.length !== 1 ? "s" : ""} available
            </span>
            {freelancers.length > 1 && (
              <Badge variant="secondary" className="text-xs">
                +{freelancers.length - 1} more
              </Badge>
            )}
          </div>
        )}
        <div
          className={cn(
            "flex gap-4 overflow-x-auto overflow-y-hidden pb-3 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory scroll-smooth mb-8",
            freelancers.length === 0 && "hidden"
          )}
          style={{ scrollbarWidth: "thin" }}
        >
          <div className="flex gap-4 flex-shrink-0 pr-1">
            {freelancers.map((freelancer, index) => {
              const fp = freelancer.freelancer_profiles;
              const initials = freelancer.full_name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase() || "?";

              return (
                <Card
                  key={freelancer.id}
                  className={cn(
                    "flex w-[min(82vw,300px)] flex-shrink-0 snap-start flex-col overflow-hidden",
                    "rounded-[28px] border border-slate-300/45 bg-card shadow-none",
                    "dark:border-zinc-500/35",
                    "md:shadow-[0_16px_40px_rgba(0,0,0,0.1)] md:dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
                  )}
                >
                  <CardContent className="flex flex-1 flex-col p-0">
                    {/* Portrait hero — tap opens public profile */}
                    <button
                      type="button"
                      className={cn(
                        "relative w-full shrink-0 overflow-hidden aspect-[3/4] border-0 bg-transparent p-0 text-left",
                        "cursor-pointer rounded-t-[26px] transition-[transform,filter] hover:brightness-[1.02] active:scale-[0.995]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                      )}
                      onClick={() => navigate(`/profile/${freelancer.id}`)}
                      aria-label={`View public profile of ${freelancer.full_name}`}
                    >
                      {freelancer.photo_url ? (
                        <img
                          src={freelancer.photo_url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          loading={index === 0 ? "eager" : "lazy"}
                          decoding="async"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/25 via-muted to-primary/10">
                          <Avatar className="h-28 w-28 border-4 border-white/80 shadow-xl ring-2 ring-primary/20">
                            <AvatarFallback className="bg-primary/15 text-3xl font-black text-primary">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      )}
                      <div
                        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none"
                        aria-hidden
                      />
                      <div className="absolute bottom-0 left-0 right-0 z-[1] p-4 pt-16 pointer-events-none">
                        <h3 className="text-[22px] font-black leading-tight tracking-tight text-white drop-shadow-md">
                          {freelancer.full_name}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <StarRating
                            rating={fp?.rating_avg || 0}
                            totalRatings={fp?.rating_count || 0}
                            size="md"
                            showCount={true}
                            numberClassName="text-white drop-shadow-sm"
                            countClassName="text-white/85"
                            starClassName="text-amber-400 drop-shadow-sm"
                            emptyStarClassName="text-white/35"
                          />
                        </div>
                      </div>
                    </button>

                    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 pt-3">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 shrink-0 text-primary/80" />
                        <span className="truncate">{freelancer.city || "Location not set"}</span>
                      </div>

                      {(fp?.hourly_rate_min || fp?.hourly_rate_max) && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Rate </span>
                          <span className="font-bold text-foreground">
                            {fp.hourly_rate_min && fp.hourly_rate_max
                              ? `₪${fp.hourly_rate_min}–${fp.hourly_rate_max}/hr`
                              : fp.hourly_rate_min
                                ? `From ₪${fp.hourly_rate_min}/hr`
                                : `Up to ₪${fp.hourly_rate_max}/hr`}
                          </span>
                        </p>
                      )}

                      <div className="flex flex-wrap gap-1.5">
                        {fp?.has_first_aid && (
                          <Badge variant="success" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                            🩹 First Aid
                          </Badge>
                        )}
                        {fp?.newborn_experience && (
                          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                            👶 Newborn
                          </Badge>
                        )}
                        {fp?.special_needs_experience && (
                          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                            💜 Special Needs
                          </Badge>
                        )}
                      </div>

                      {fp?.bio && (
                        <p className="line-clamp-3 text-sm leading-snug text-muted-foreground">
                          {fp.bio}
                        </p>
                      )}

                      {freelancer.confirmation_note && (
                        <div
                          className={cn(
                            "rounded-2xl border p-3",
                            freelancer.is_open_job_accepted
                              ? "border-amber-500/25 bg-amber-500/10"
                              : "border-primary/25 bg-primary/8"
                          )}
                        >
                          <p
                            className={cn(
                              "mb-1 text-[11px] font-bold uppercase tracking-wide",
                              freelancer.is_open_job_accepted
                                ? "text-amber-700 dark:text-amber-400"
                                : "text-primary"
                            )}
                          >
                            Note from helper
                          </p>
                          <p
                            className={cn(
                              "text-sm leading-snug",
                              freelancer.is_open_job_accepted
                                ? "text-amber-900 dark:text-amber-200"
                                : "text-foreground"
                            )}
                          >
                            {freelancer.confirmation_note}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-auto flex items-stretch gap-2 border-t border-border/60 bg-muted/40 px-3 py-3 dark:bg-muted/20">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDecline(freelancer.id)}
                        disabled={declining === freelancer.id || selecting === freelancer.id}
                        className="h-11 flex-1 gap-1 rounded-2xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
                        onClick={() => handleSelect(freelancer.id)}
                        disabled={selecting === freelancer.id || declining === freelancer.id}
                        className="h-11 flex-[1.15] gap-1.5 rounded-2xl font-bold shadow-sm"
                      >
                        {selecting === freelancer.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MessageCircle className="h-4 w-4" />
                        )}
                        Select & Chat
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {freelancersLoading && freelancers.length === 0 && (
          <div className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 md:mx-0 md:px-0 mb-8">
            {[0, 1].map((k) => (
              <div
                key={k}
                className="w-[min(82vw,300px)] flex-shrink-0 snap-start rounded-[28px] border border-border/40 bg-muted/40 overflow-hidden"
              >
                <div className="aspect-[3/4] bg-muted animate-pulse" />
                <div className="p-4 space-y-3">
                  <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                  <div className="h-10 rounded-2xl bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!freelancersLoading && freelancers.length === 0 && (
          <Card className="border-0 shadow-lg text-center py-12 mb-8">
            <CardContent>
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
            </CardContent>
          </Card>
        )}

        {/* Job Request Summary — matches jobs tab cards */}
        {job && (
          <Card
            className={cn(
              "mb-6 w-full overflow-hidden rounded-[32px] border border-slate-300/45 bg-card backdrop-blur-sm shadow-none",
              "dark:border-zinc-500/35",
              "md:shadow-[0_20px_50px_rgba(0,0,0,0.12)] md:dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]"
            )}
          >
            <CardContent className="p-6 md:p-7">
              <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100 mb-4">
                Your Request
              </h3>
              <div className="grid gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">
                      {job.service_type === 'cleaning' && '🧹'}
                      {job.service_type === 'cooking' && '👨‍🍳'}
                      {job.service_type === 'pickup_delivery' && '📦'}
                      {job.service_type === 'nanny' && '👶'}
                      {job.service_type === 'other_help' && '🔧'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium capitalize">
                      {job.service_type?.replace('_', ' & ')}
                      {job.service_type === 'other_help' && job.service_details?.other_type &&
                        ` - ${job.service_details.other_type.replace(/_/g, ' ').charAt(0).toUpperCase() + job.service_details.other_type.replace(/_/g, ' ').slice(1)}`
                      }
                    </p>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-muted-foreground">
                      {job.location_city && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{job.location_city}</span>
                        </div>
                      )}
                      {job.time_duration && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span className="capitalize">{job.time_duration.replace(/_/g, ' ')}</span>
                        </div>
                      )}
                      {job.care_frequency && (
                        <div>
                          <span className="capitalize">{job.care_frequency.replace('_', ' ')}</span>
                        </div>
                      )}
                      {job.service_details?.kids_count && (
                        <div>
                          <span>{job.service_details.kids_count.replace('_', '-')} kids</span>
                        </div>
                      )}
                      {job.service_type === 'cleaning' && job.service_details?.home_size && (
                        <div>
                          <span>{HOME_SIZES.find(s => s.id === job.service_details.home_size)?.label || job.service_details.home_size.replace(/_/g, ' ')}</span>
                        </div>
                      )}
                      {job.service_type === 'cooking' && job.service_details?.who_for && (
                        <div>
                          <span>For: {COOKING_WHO_FOR.find(w => w.id === job.service_details.who_for)?.label || job.service_details.who_for.replace(/_/g, ' ')}</span>
                        </div>
                      )}
                      {job.service_type === 'pickup_delivery' && job.service_details?.weight && (
                        <div>
                          <span>{DELIVERY_WEIGHTS.find(w => w.id === job.service_details.weight)?.label || job.service_details.weight.replace(/_/g, ' ')}</span>
                        </div>
                      )}
                      {job.service_type === 'nanny' && job.service_details?.age_group && (
                        <div>
                          <span>Ages: {NANNY_AGE_GROUPS.find(g => g.id === job.service_details.age_group)?.label || job.service_details.age_group.replace(/_/g, ' ')}</span>
                        </div>
                      )}
                      {job.service_type === 'other_help' && job.service_details?.mobility_level && (
                        <div>
                          <span>{job.service_details.mobility_level.replace(/_/g, ' ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {job.service_details?.custom && (
                  <div
                    className={cn(
                      "mt-4 w-full rounded-2xl border border-slate-200/90 bg-muted/40 p-4 sm:p-5",
                      "dark:border-border/50 dark:bg-muted/25"
                    )}
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                      Custom notes
                    </p>
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
                      {job.service_details.custom}
                    </p>
                  </div>
                )}

                {/* Pickup/Delivery Addresses */}
                {job.service_type === 'pickup_delivery' && job.service_details?.from_address && job.service_details?.to_address && (
                  <div className="mt-4 mb-2 space-y-2 text-sm border-t pt-4">
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 font-semibold min-w-[40px]">From:</span>
                      <span className="flex-1 text-muted-foreground">{job.service_details.from_address}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-red-600 font-semibold min-w-[40px]">To:</span>
                      <span className="flex-1 text-muted-foreground">{job.service_details.to_address}</span>
                    </div>
                  </div>
                )}

                {/* Job Map — tap opens full map modal */}
                {(job.service_type === 'pickup_delivery' || job.location_city) && (
                  <div className="relative mt-4 h-28 overflow-hidden rounded-2xl border border-slate-200/80 ring-1 ring-black/5 dark:border-border/40 dark:ring-white/10 shadow-sm">
                    <button
                      type="button"
                      className="absolute inset-0 z-10 cursor-pointer rounded-2xl bg-transparent p-0 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-primary"
                      onClick={() => setMapModalOpen(true)}
                      aria-label="Open full map"
                    />
                    <div className="h-full w-full">
                      <Suspense
                        fallback={
                          <div className="h-full w-full min-h-[7rem] bg-muted animate-pulse" />
                        }
                      >
                        <JobMap job={job} />
                      </Suspense>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Additional Details Section */}
        {job && (
          <Card className="mb-6 shadow-sm border border-border/50">
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-primary" />
                Additional Job Details
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add any extra details, instructions, or requirements for this job. These will be visible to helpers.
              </p>
              <div className="space-y-4">
                <Textarea
                  placeholder="Type your custom job details here..."
                  className="min-h-[100px] bg-muted/30 focus-visible:bg-background resize-y"
                  value={customDetails}
                  onChange={(e) => setCustomDetails(e.target.value)}
                />
                <div className="flex justify-end pt-2 border-t">
                  <Button 
                    onClick={handleSaveDetails} 
                    disabled={savingDetails || customDetails.trim() === (job?.service_details?.custom || "").trim()}
                  >
                    {savingDetails ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Save Notes
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Job Images Section */}
        {job && (
          <Card className="mb-6 shadow-sm border border-border/50">
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Job Images
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload photos to help helpers understand the task better (e.g., items to pick up, area to clean).
              </p>

              <div className="space-y-6">
                <input
                  type="file"
                  id="job-image-upload"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files?.length || !jobId) return;
                    await handleFiles(Array.from(files));
                  }}
                />

                <div
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary', 'bg-primary/5'); }}
                  onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-primary', 'bg-primary/5'); }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
                    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                    if (files.length > 0 && jobId) await handleFiles(files);
                  }}
                  className={cn(
                    "relative group cursor-pointer transition-all duration-300",
                    "border-2 border-dashed border-border/60 hover:border-primary/50 hover:bg-primary/5",
                    "rounded-[2.5rem] p-10 text-center flex flex-col items-center justify-center gap-3",
                    savingDetails && "opacity-50 pointer-events-none"
                  )}
                  onClick={() => document.getElementById('job-image-upload')?.click()}
                >
                  <div className="w-20 h-20 rounded-[1.8rem] bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-500">
                    <UploadCloud className="w-10 h-10" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-foreground">Drag & Drop or Add Photos</h4>
                    <p className="text-sm text-muted-foreground mt-1 px-4">
                      Tap to choose camera or library — or drag files here on desktop
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-2 rounded-2xl font-black gap-2 px-8 py-6 h-auto"
                    disabled={savingDetails}
                  >
                    <Plus className="w-5 h-5" />
                    Add Photos
                  </Button>

                  {savingDetails && (
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] rounded-[2.5rem] flex items-center justify-center z-10">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <span className="text-xs font-bold text-primary uppercase tracking-widest">Uploading...</span>
                      </div>
                    </div>
                  )}
                </div>

                {job?.service_details?.images && job.service_details.images.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
                    {job.service_details.images.map((img: string, idx: number) => (
                      <div key={idx} className="relative aspect-square rounded-[1.5rem] overflow-hidden border border-black/10 dark:border-white/10 group cursor-zoom-in shadow-sm hover:shadow-md transition-all">
                        <img
                          src={img}
                          alt={`Job detail ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onClick={() => setLightboxIndex(idx)}
                        />
                        <div className="absolute inset-x-0 top-0 p-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                           <button
                             className="bg-black/50 hover:bg-black/70 backdrop-blur-md text-white rounded-full p-2 shadow-lg scale-90 hover:scale-100 transition-all"
                             onClick={async (e) => {
                                e.stopPropagation();
                                if(!confirm("Are you sure you want to remove this image?")) return;
                                setSavingDetails(true);
                                try {
                                    const newImgList = job.service_details.images.filter((_: any, i: number) => i !== idx);
                                    const updatedDetails = { ...job.service_details, images: newImgList };

                                    const { error } = await supabase
                                        .from('job_requests')
                                        .update({ service_details: updatedDetails })
                                        .eq('id', jobId);

                                    if (error) throw error;
                                    addToast({ title: "Image Removed", description: "Image successfully deleted", variant: "success" });
                                    fetchJobDirectly();
                                } catch (err: any) {
                                    addToast({ title: "Error", description: err.message, variant: "error" });
                                } finally {
                                    setSavingDetails(false);
                                }
                             }}
                           >
                             <X className="w-4 h-4" />
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
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
        {job && (
          <Suspense fallback={null}>
            <FullscreenMapModal
              job={job}
              isOpen={mapModalOpen}
              onClose={() => setMapModalOpen(false)}
            />
          </Suspense>
        )}
      </div >
    </div >
  );
}

