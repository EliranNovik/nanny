import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ArrowLeft,
  Loader2,
  Clock,
  MapPin,
  Baby,
  MessageCircle,
  CheckCircle2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Eye,
  X,
  Bell
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getJobStageBadge } from "@/lib/jobStages";

interface JobRequest {
  id: string;
  status: string;
  stage: string | null;
  care_type: string;
  children_count: number;
  children_age_group: string;
  location_city: string;
  start_at: string | null;
  selected_freelancer_id: string | null;
  created_at: string;
  confirm_ends_at: string | null;
}

interface Conversation {
  id: string;
  job_id: string;
  freelancer_id: string;
  created_at: string;
}

interface FreelancerProfile {
  id: string;
  full_name: string | null;
  photo_url: string | null;
}

export default function ActiveJobsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeJob, setActiveJob] = useState<JobRequest | null>(null);
  const [openRequests, setOpenRequests] = useState<JobRequest[]>([]);
  const [pastJobs, setPastJobs] = useState<JobRequest[]>([]);
  const [conversations, setConversations] = useState<Record<string, Conversation>>({});
  const [freelancerProfiles, setFreelancerProfiles] = useState<Record<string, FreelancerProfile>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmationCounts, setConfirmationCounts] = useState<Record<string, number>>({});
  const [openRequestsExpanded, setOpenRequestsExpanded] = useState(true);
  const [pastJobsExpanded, setPastJobsExpanded] = useState(false);
  const [hasNewActions, setHasNewActions] = useState(false);

  useEffect(() => {
    async function loadJobs() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Fetch all jobs
        const { data: allJobs } = await supabase
          .from("job_requests")
          .select("*")
          .eq("client_id", user.id)
          .order("created_at", { ascending: false });

        if (!allJobs) {
          setLoading(false);
          return;
        }

        // Separate into active, open requests, and past jobs
        const active = allJobs.find(j => j.status === "locked" || j.status === "active");
        const open = allJobs.filter(j => 
          j.status === "ready" || 
          j.status === "notifying" || 
          j.status === "confirmations_closed"
        );
        const past = allJobs.filter(j => 
          j.status === "completed" || 
          j.status === "cancelled"
        );

        setActiveJob(active || null);
        setOpenRequests(open);
        setPastJobs(past);

        // Fetch confirmation counts for open requests
        if (open.length > 0) {
          const { data: confirmations } = await supabase
            .from("job_confirmations")
            .select("job_id")
            .in("job_id", open.map((j) => j.id))
            .eq("status", "available");

          const countsMap: Record<string, number> = {};
          (confirmations || []).forEach((conf) => {
            countsMap[conf.job_id] = (countsMap[conf.job_id] || 0) + 1;
          });
          setConfirmationCounts(countsMap);
        }

        // Fetch conversations and freelancer profiles for active job
        if (active && active.selected_freelancer_id) {
          const { data: convos } = await supabase
            .from("conversations")
            .select("id, job_id, freelancer_id, created_at")
            .eq("job_id", active.id)
            .maybeSingle();

          if (convos) {
            setConversations({ [active.id]: convos });
            
            const { data: profile } = await supabase
              .from("profiles")
              .select("id, full_name, photo_url")
              .eq("id", active.selected_freelancer_id)
              .single();

            if (profile) {
              setFreelancerProfiles({ [active.selected_freelancer_id]: profile });
            }
            
            // Check for schedule requests that need confirmation
            const { data: messages } = await supabase
              .from("messages")
              .select("body, created_at, sender_id")
              .eq("conversation_id", convos.id)
              .order("created_at", { ascending: false })
              .limit(10);
            
            if (messages) {
              // Check if there's a schedule request from client that hasn't been confirmed
              const scheduleRequest = messages.find(msg => 
                msg.body?.includes("📅 Schedule Request") && 
                msg.sender_id === user.id
              );
              
              if (scheduleRequest) {
                // Check if there's a confirmation after the request
                const confirmation = messages.find(msg => 
                  (msg.body?.includes("Schedule confirmed") || 
                   msg.body?.includes("✓")) &&
                  msg.sender_id === active.selected_freelancer_id &&
                  new Date(msg.created_at) > new Date(scheduleRequest.created_at)
                );
                
                // If no confirmation found, there's a new action available
                setHasNewActions(!confirmation);
              } else {
                setHasNewActions(false);
              }
            }
          }
        }
      } catch (err) {
        console.error("Error loading jobs:", err);
      } finally {
        setLoading(false);
      }
    }

    loadJobs();

    // Poll for confirmation counts every 5 seconds
    const interval = setInterval(() => {
      if (user && openRequests.length > 0) {
        supabase
          .from("job_confirmations")
          .select("job_id")
          .in("job_id", openRequests.map((j) => j.id))
          .eq("status", "available")
          .then(({ data: confirmations }) => {
            const countsMap: Record<string, number> = {};
            (confirmations || []).forEach((conf) => {
              countsMap[conf.job_id] = (countsMap[conf.job_id] || 0) + 1;
            });
            setConfirmationCounts(countsMap);
          });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [user, openRequests.length]);

  // function formatCareType(type: string): string {
  //   const map: Record<string, string> = {
  //     occasional: "One-time",
  //     part_time: "Part-time",
  //     full_time: "Full-time",
  //   };
  //   return map[type] || type;
  // }

  function formatAgeGroup(group: string): string {
    const map: Record<string, string> = {
      newborn: "0-3 months",
      infant: "3-12 months",
      toddler: "1-3 years",
      preschool: "3-5 years",
      mixed: "Mixed ages",
    };
    return map[group] || group;
  }

  function getJobStatusBadge(status: string): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      locked: { label: "Scheduled", variant: "default" },
      active: { label: "In progress", variant: "default" },
      notifying: { label: "Finding nannies", variant: "secondary" },
      confirmations_closed: { label: "Waiting for availability", variant: "secondary" },
      completed: { label: "Completed", variant: "outline" },
      cancelled: { label: "Cancelled", variant: "destructive" },
    };
    return map[status] || { label: status, variant: "outline" };
  }

  function getPrimaryAction(job: JobRequest): { label: string; onClick: () => void; icon?: any } {
    if (job.status === "locked" || job.status === "active") {
      const conversation = conversations[job.id];
      if (conversation) {
        return {
          label: "Open Chat",
          onClick: () => navigate(`/chat/${conversation.id}`),
          icon: MessageCircle,
        };
      }
    }
    if (job.status === "notifying" || job.status === "confirmations_closed") {
      return {
        label: "View Responses",
        onClick: () => navigate(`/client/jobs/${job.id}/confirmed`),
        icon: CheckCircle2,
      };
    }
    return {
      label: "View Details",
      onClick: () => navigate(`/client/jobs/${job.id}`),
      icon: Eye,
    };
  }

  async function handleDelete(jobId: string) {
    setDeleting(jobId);

    try {
      const { error } = await supabase
        .from("job_requests")
        .delete()
        .eq("id", jobId);

      if (error) throw error;

      setOpenRequests(prev => prev.filter(j => j.id !== jobId));
      addToast({
        title: "Job deleted",
        description: "The job request has been removed.",
        variant: "success",
        duration: 3000,
      });
    } catch (err: any) {
      addToast({
        title: "Failed to delete",
        description: err?.message || "Could not delete the job.",
        variant: "error",
        duration: 5000,
      });
    } finally {
      setDeleting(null);
    }
  }

  function formatJobTitle(job: JobRequest): string {
    return `Nanny – ${job.children_count} kid${job.children_count > 1 ? "s" : ""} (${formatAgeGroup(job.children_age_group)})`;
  }

  if (loading) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-mesh p-4 pb-24">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Jobs</h1>
        </div>

        {/* A. Active/In-progress Job Card (TOP, big card) */}
        {activeJob && (
          <Card className="border-0 shadow-xl mb-6">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <CardTitle className="text-xl">
                      {formatJobTitle(activeJob)}
                    </CardTitle>
                    {hasNewActions && (
                      <div className="relative">
                        <Bell className="w-5 h-5 text-primary animate-pulse" />
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-background"></span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={cn("text-xs", getJobStatusBadge(activeJob.status).variant === "default" ? "bg-primary/10 text-primary" : "")}>
                      {getJobStatusBadge(activeJob.status).label}
                    </Badge>
                    {activeJob.stage && (
                      <Badge variant={getJobStageBadge(activeJob.stage).variant} className="text-xs">
                        {getJobStageBadge(activeJob.stage).label}
                      </Badge>
                    )}
                  </div>
                </div>
                {activeJob.selected_freelancer_id && freelancerProfiles[activeJob.selected_freelancer_id] && (
                  <Avatar className="w-14 h-14 border-2 border-primary/20">
                    <AvatarImage src={freelancerProfiles[activeJob.selected_freelancer_id].photo_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {freelancerProfiles[activeJob.selected_freelancer_id].full_name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
              {activeJob.start_at && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(activeJob.start_at).toLocaleDateString()}</span>
                  <Clock className="w-4 h-4 ml-2" />
                  <span>{new Date(activeJob.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}
              {activeJob.selected_freelancer_id && freelancerProfiles[activeJob.selected_freelancer_id] && (
                <div className="mt-2 text-sm">
                  <span className="text-muted-foreground">With: </span>
                  <span className="font-medium">{freelancerProfiles[activeJob.selected_freelancer_id].full_name}</span>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {activeJob.location_city}
                </div>
                <div className="flex items-center gap-1">
                  <Baby className="w-4 h-4" />
                  {formatAgeGroup(activeJob.children_age_group)}
                </div>
              </div>
              {(() => {
                const action = getPrimaryAction(activeJob);
                const ActionIcon = action.icon;
                return (
                  <Button className="w-full" size="lg" onClick={action.onClick}>
                    {ActionIcon && <ActionIcon className="w-4 h-4 mr-2" />}
                    {action.label}
                  </Button>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* B. Open Requests (collapsed list) */}
        {openRequests.length > 0 && (
          <Card className="border-0 shadow-lg mb-6">
            <CardHeader 
              className="cursor-pointer"
              onClick={() => setOpenRequestsExpanded(!openRequestsExpanded)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Open Requests</CardTitle>
                {openRequestsExpanded ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
            {openRequestsExpanded && (
              <CardContent className="space-y-3">
                {openRequests.map((job) => {
                  const statusBadge = getJobStatusBadge(job.status);
                  const stageBadge = getJobStageBadge(job.stage);
                  const action = getPrimaryAction(job);
                  return (
                    <div key={job.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm truncate">{formatJobTitle(job)}</span>
                          {confirmationCounts[job.id] > 0 && (
                            <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-2 border-background">
                              <span className="text-[10px] font-bold text-white">
                                {confirmationCounts[job.id] > 9 ? "9+" : confirmationCounts[job.id]}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={statusBadge.variant} className="text-xs">
                            {statusBadge.label}
                          </Badge>
                          {job.stage && (
                            <Badge variant={stageBadge.variant} className="text-xs">
                              {stageBadge.label}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={action.onClick}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {(job.status === "notifying" || job.status === "confirmations_closed") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(job.id)}
                            disabled={deleting === job.id}
                          >
                            {deleting === job.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <X className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>
        )}

        {/* C. Past Jobs (collapsed by default) */}
        {pastJobs.length > 0 && (
          <Card className="border-0 shadow-lg">
            <CardHeader 
              className="cursor-pointer"
              onClick={() => setPastJobsExpanded(!pastJobsExpanded)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Past Jobs</CardTitle>
                {pastJobsExpanded ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
            {pastJobsExpanded && (
              <CardContent className="space-y-3">
                {pastJobs.map((job) => {
                  const statusBadge = getJobStatusBadge(job.status);
                  const stageBadge = getJobStageBadge(job.stage);
                  return (
                    <div key={job.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{new Date(job.created_at).toLocaleDateString()}</span>
                          <span className="text-sm text-muted-foreground truncate">{formatJobTitle(job)}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={statusBadge.variant} className="text-xs">
                            {statusBadge.label}
                          </Badge>
                          {job.stage && (
                            <Badge variant={stageBadge.variant} className="text-xs">
                              {stageBadge.label}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate("/client/create")}>
                        Rebook
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>
        )}

        {/* Empty State */}
        {!activeJob && openRequests.length === 0 && pastJobs.length === 0 && (
          <Card className="border-0 shadow-lg text-center py-12">
            <CardContent>
              <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                <Calendar className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No Jobs Yet</h3>
              <p className="text-muted-foreground mb-4">
                Create a job request to get started.
              </p>
              <Button onClick={() => navigate("/client/create")}>
                Find a Nanny
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
