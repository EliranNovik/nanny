import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  Star, 
  MapPin, 
  Clock, 
  CheckCircle2,
  MessageCircle,
  Heart,
  RefreshCw,
  RotateCcw,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(90);
  const [windowEnded, setWindowEnded] = useState(false);
  const [restarting, setRestarting] = useState(false);

  async function fetchConfirmed() {
    try {
      console.log("[ConfirmedListPage] Fetching confirmed freelancers for job", jobId);
      const data = await apiGet<{ freelancers: Freelancer[]; confirm_ends_at: string }>(
        `/api/jobs/${jobId}/confirmed`
      );
      console.log("[ConfirmedListPage] Received", data.freelancers.length, "confirmed freelancers");
      
      // Sort: open job acceptances first, then regular confirmations
      const sorted = [...data.freelancers].sort((a, b) => {
        if (a.is_open_job_accepted && !b.is_open_job_accepted) return -1;
        if (!a.is_open_job_accepted && b.is_open_job_accepted) return 1;
        return 0;
      });
      
      setFreelancers(sorted);
      
      // Update countdown if confirm_ends_at is provided
      if (data.confirm_ends_at) {
        const endTime = new Date(data.confirm_ends_at).getTime();
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        setCountdown(remaining);
        setWindowEnded(remaining === 0);
      }
    } catch (err) {
      console.error("[ConfirmedListPage] Error fetching confirmed freelancers:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!jobId) return;
    
    fetchConfirmed();
    
    // Poll every 3 seconds during window to get new confirmations
    const interval = setInterval(() => {
      if (!windowEnded) {
        fetchConfirmed();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [jobId, windowEnded]);

  useEffect(() => {
    // Countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setWindowEnded(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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

  async function handleRestartSearch() {
    if (!jobId) return;
    
    setRestarting(true);
    setError("");

    try {
      console.log("[ConfirmedListPage] Restarting search for job", jobId);
      const result = await apiPost<{ job_id: string; confirm_ends_at: string; notifications_sent: number }>(
        `/api/jobs/${jobId}/restart`,
        {}
      );
      console.log("[ConfirmedListPage] Search restarted successfully, notifications sent:", result.notifications_sent);
      
      // Reset state and refresh
      setFreelancers([]);
      setWindowEnded(false);
      setCountdown(90);
      
      // Refresh the confirmed list
      await fetchConfirmed();
    } catch (err) {
      console.error("[ConfirmedListPage] Error restarting search:", err);
      setError(err instanceof Error ? err.message : "Failed to restart search");
    } finally {
      setRestarting(false);
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Finding available nannies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-mesh p-4 pb-24">
      <div className="max-w-2xl mx-auto pt-8">
        {/* Timer Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4",
            windowEnded ? "bg-muted" : "bg-primary/10"
          )}>
            <Clock className={cn(
              "w-5 h-5",
              windowEnded ? "text-muted-foreground" : "text-primary animate-pulse-soft"
            )} />
            <span className={cn(
              "font-mono font-bold text-lg",
              windowEnded ? "text-muted-foreground" : "text-primary"
            )}>
              {windowEnded ? "Window Closed" : formatTime(countdown)}
            </span>
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {windowEnded 
              ? "Confirmation Window Ended" 
              : "Waiting for Confirmations..."}
          </h1>
          <p className="text-muted-foreground">
            {freelancers.length === 0 
              ? "No nannies have confirmed availability yet"
              : `${freelancers.length} nanny${freelancers.length > 1 ? "s" : ""} available`}
          </p>
          {windowEnded && freelancers.some((f) => f.is_open_job_accepted) && (
            <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                <strong>Note:</strong> Some nannies have expressed interest in this open job. Review their notes below.
              </p>
            </div>
          )}
          
          <div className="flex gap-2 justify-center mt-4">
            {!windowEnded && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => fetchConfirmed()}
                disabled={restarting}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            )}
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleRestartSearch}
              disabled={restarting}
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
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

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

                          {fp?.rating_count > 0 && (
                            <div className="flex items-center gap-1 text-amber-500">
                              <Star className="w-4 h-4 fill-current" />
                              <span className="font-medium">{fp.rating_avg}</span>
                              <span className="text-xs text-muted-foreground">
                                ({fp.rating_count})
                              </span>
                            </div>
                          )}
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

        {/* Empty State */}
        {freelancers.length === 0 && windowEnded && (
          <Card className="border-0 shadow-lg text-center py-12">
            <CardContent>
              <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                <Clock className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No Confirmations</h3>
              <p className="text-muted-foreground mb-4">
                No nannies confirmed availability for this request.
              </p>
              <Button onClick={() => navigate("/client/create")}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

