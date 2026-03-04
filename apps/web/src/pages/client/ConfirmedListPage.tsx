import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StarRating } from "@/components/StarRating";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  MapPin,
  Clock,
  CheckCircle2,
  MessageCircle,
  Heart,
  RotateCcw,
  StopCircle,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import JobFollowUpSection, {
  HOME_SIZES,
  COOKING_WHO_FOR,
  DELIVERY_WEIGHTS,
  NANNY_AGE_GROUPS,
  MOBILITY_LEVELS
} from "@/components/JobFollowUpSection";
import JobMap from "@/components/JobMap";

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

export default function ConfirmedListPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restarting, setRestarting] = useState(false);
  const [startTime] = useState(Date.now());
  const [job, setJob] = useState<any>((location.state as any)?.job || null);

  // Get service details from job state
  const serviceType = job?.service_type;
  const serviceDetails = job?.service_details;

  async function fetchConfirmed() {
    try {
      console.log("[ConfirmedListPage] Fetching confirmed freelancers for job", jobId);
      const data = await apiGet<{
        freelancers: Freelancer[];
        confirm_ends_at: string;
        job: any;
      }>(
        `/api/jobs/${jobId}/confirmed`
      );
      console.log("[ConfirmedListPage] Received data:", data);

      // Store job details
      if (data.job) {
        console.log("[ConfirmedListPage] Setting job state with:", data.job);
        setJob(data.job);
      } else {
        console.warn("[ConfirmedListPage] No job data received from API");
      }

      // Sort: open job acceptances first, then regular confirmations
      const sorted = [...data.freelancers].sort((a, b) => {
        if (a.is_open_job_accepted && !b.is_open_job_accepted) return -1;
        if (!a.is_open_job_accepted && b.is_open_job_accepted) return 1;
        return 0;
      });

      setFreelancers(sorted);
    } catch (err) {
      console.error("[ConfirmedListPage] Error fetching confirmed freelancers:", err);
      setError("Failed to load job details");
    } finally {
      setLoading(false);
    }
  }

  // Fetch job details directly from Supabase
  async function fetchJobDirectly() {
    if (!jobId) return;
    try {
      const { data, error } = await supabase
        .from('job_requests')
        .select('*')
        .eq('id', jobId)
        .single();

      if (data && !error) {
        console.log("[ConfirmedListPage] Fetched job directly:", data);
        setJob((prev: any) => ({ ...prev, ...data }));
      }
    } catch (e) {
      console.error("Error fetching job directly:", e);
    }
  }

  useEffect(() => {
    if (!jobId) return;

    fetchConfirmed();

    // Poll every 3 seconds to get new confirmations
    const interval = setInterval(() => {
      fetchConfirmed();
    }, 3000);


    fetchJobDirectly();

    return () => {
      clearInterval(interval);
    };
  }, [jobId]);

  // Timer effect
  useEffect(() => {
    const timerInterval = setInterval(() => {
      const start = job?.created_at ? new Date(job.created_at).getTime() : startTime;
      const elapsed = Math.floor((Date.now() - start) / 1000);
      setElapsedSeconds(elapsed >= 0 ? elapsed : 0);
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [job, startTime]);

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
      console.log("[ConfirmedListPage] Declining freelancer", freelancerId);
      await apiPost(`/api/jobs/${jobId}/decline`, {
        freelancer_id: freelancerId,
      });
      console.log("[ConfirmedListPage] Freelancer declined successfully");

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
      console.log("[ConfirmedListPage] Restarting search for job", jobId);
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
    <div className="min-h-screen gradient-mesh p-4 pb-64 md:pb-32">
      <div className="max-w-2xl mx-auto pt-8">
        {/* Timer Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 bg-primary/10">
            <Clock className="w-5 h-5 text-primary animate-pulse-soft" />
            <span className="font-mono font-bold text-lg text-primary">
              {formatElapsedTime(elapsedSeconds)}
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

        {/* Job Request Summary */}
        {job && (
          <Card className="border-0 shadow-lg mb-6">
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg mb-4">Your Request</h3>
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
                          <span>{MOBILITY_LEVELS.find(l => l.id === job.service_details.mobility_level)?.label || job.service_details.mobility_level.replace(/_/g, ' ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

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

                {/* Job Map */}
                {(job.service_type === 'pickup_delivery' || job.location_city) && (
                  <JobMap job={job} />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Follow-up Section */}
        {
          serviceType && jobId && (
            <JobFollowUpSection
              jobId={jobId}
              serviceType={serviceType}
              otherType={serviceDetails?.other_type}
              onUpdate={fetchJobDirectly}
              initialDetails={job?.service_details}
            />
          )
        }

        {
          error && (
            <div className="p-3 mb-4 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )
        }

        {/* Freelancer Cards */}
        <div className="space-y-4 animate-stagger">
          {freelancers.map((freelancer) => {
            const fp = freelancer.freelancer_profiles;
            const initials = freelancer.full_name
              ?.split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase() || "?";

            return (
              <Card
                key={freelancer.id}
                className="border-0 shadow-lg overflow-hidden"
              >
                <CardContent className="p-0">
                  <div className="p-6">
                    <div className="flex gap-4">
                      <Avatar className="w-16 h-16 border-2 border-primary/20">
                        <AvatarImage src={freelancer.photo_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-lg">
                              {freelancer.full_name}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {freelancer.city || "Location not set"}
                            </div>
                          </div>

                          <StarRating
                            rating={fp?.rating_avg || 0}
                            totalRatings={fp?.rating_count || 0}
                            size="sm"
                            showCount={true}
                          />
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {fp?.has_first_aid && (
                            <Badge variant="success">🩹 First Aid</Badge>
                          )}
                          {fp?.newborn_experience && (
                            <Badge variant="secondary">👶 Newborn Exp.</Badge>
                          )}
                          {fp?.special_needs_experience && (
                            <Badge variant="secondary">💜 Special Needs</Badge>
                          )}
                        </div>

                        {/* Rate */}
                        {(fp?.hourly_rate_min || fp?.hourly_rate_max) && (
                          <div className="mt-3 text-sm">
                            <span className="text-muted-foreground">Rate: </span>
                            <span className="font-semibold text-foreground">
                              {fp.hourly_rate_min && fp.hourly_rate_max
                                ? `₪${fp.hourly_rate_min}-${fp.hourly_rate_max}/hr`
                                : fp.hourly_rate_min
                                  ? `From ₪${fp.hourly_rate_min}/hr`
                                  : `Up to ₪${fp.hourly_rate_max}/hr`}
                            </span>
                          </div>
                        )}

                        {/* Bio */}
                        {fp?.bio && (
                          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                            {fp.bio}
                          </p>
                        )}

                        {/* Confirmation Note */}
                        {freelancer.confirmation_note && (
                          <div className={cn(
                            "mt-4 p-3 rounded-lg border",
                            freelancer.is_open_job_accepted
                              ? "bg-amber-500/10 border-amber-500/20"
                              : "bg-primary/10 border-primary/20"
                          )}>
                            <p className={cn(
                              "text-xs font-medium mb-1",
                              freelancer.is_open_job_accepted
                                ? "text-amber-700 dark:text-amber-400"
                                : "text-primary"
                            )}>
                              Note from nanny:
                            </p>
                            <p className={cn(
                              "text-sm",
                              freelancer.is_open_job_accepted
                                ? "text-amber-800 dark:text-amber-300"
                                : "text-foreground"
                            )}>
                              {freelancer.confirmation_note}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="px-6 py-4 bg-muted/50 border-t flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      {freelancer.is_open_job_accepted ? (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Open Job Acceptance
                        </span>
                      ) : (
                        <span className="text-primary flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          Available Now
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                      >
                        <Heart className="w-4 h-4" />
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDecline(freelancer.id)}
                        disabled={declining === freelancer.id || selecting === freelancer.id}
                        className="gap-1 text-destructive hover:text-destructive"
                      >
                        {declining === freelancer.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                        Decline
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSelect(freelancer.id)}
                        disabled={selecting === freelancer.id || declining === freelancer.id}
                        className="gap-1"
                      >
                        {selecting === freelancer.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <MessageCircle className="w-4 h-4" />
                        )}
                        Select & Chat
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Empty State - removed windowEnded check since jobs stay open */}
        <Card className="border-0 shadow-lg text-center py-12">
          <CardContent>
            <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No Confirmations</h3>
            <p className="text-muted-foreground mb-4">

            </p>
            <Button onClick={() => navigate("/client/create")}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div >
    </div >
  );
}

