import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Baby, 
  Sparkles, 
  Clock, 
  MapPin, 
  MessageCircle,
  ArrowRight,
  Loader2,
  Users,
  Calendar,
  LogOut
} from "lucide-react";
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
}

interface Conversation {
  id: string;
  job_id: string;
  freelancer_id: string;
  created_at: string;
  freelancer_profile?: {
    full_name: string | null;
    photo_url: string | null;
  };
  last_message?: {
    body: string;
    created_at: string;
  };
}

type DashboardState = "first_time" | "job_in_progress" | "job_matched" | "no_active_job";

export default function DashboardPage() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeJob, setActiveJob] = useState<JobRequest | null>(null);
  const [pastJobs, setPastJobs] = useState<JobRequest[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [selectedFreelancer, setSelectedFreelancer] = useState<{ full_name: string | null; photo_url: string | null } | null>(null);
  const [dashboardState, setDashboardState] = useState<DashboardState>("first_time");

  useEffect(() => {
    async function loadDashboard() {
      if (!user) return;

      try {
        // Fetch user's jobs
        const { data: jobs } = await supabase
          .from("job_requests")
          .select("*")
          .eq("client_id", user.id)
          .order("created_at", { ascending: false });

        if (!jobs) return;

        // Find active job (not completed, not cancelled)
        const active = jobs.find(
          (j) => !["completed", "cancelled"].includes(j.status)
        );

        // Past jobs (completed or cancelled)
        const past = jobs.filter((j) =>
          ["completed", "cancelled"].includes(j.status)
        );

        setActiveJob(active || null);
        setPastJobs(past);

        // Fetch selected freelancer profile if job has one
        let freelancerProfileData: { full_name: string | null; photo_url: string | null } | null = null;
        if (active?.selected_freelancer_id) {
          const { data: freelancerProfile } = await supabase
            .from("profiles")
            .select("full_name, photo_url")
            .eq("id", active.selected_freelancer_id)
            .single();

          if (freelancerProfile) {
            freelancerProfileData = {
              full_name: freelancerProfile.full_name,
              photo_url: freelancerProfile.photo_url,
            };
            setSelectedFreelancer(freelancerProfileData);
          } else {
            setSelectedFreelancer(null);
          }
        } else {
          setSelectedFreelancer(null);
        }

        // If active job is locked/matched or active, fetch conversation
        if (active && (active.status === "locked" || active.status === "active") && active.selected_freelancer_id) {
          const { data: convo } = await supabase
            .from("conversations")
            .select("id, job_id, freelancer_id, created_at")
            .eq("job_id", active.id)
            .maybeSingle();

          if (convo) {
            // Fetch last message
            const { data: lastMessage } = await supabase
              .from("messages")
              .select("body, created_at")
              .eq("conversation_id", convo.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            setActiveConversation({
              id: convo.id,
              job_id: convo.job_id,
              freelancer_id: convo.freelancer_id,
              created_at: convo.created_at,
              freelancer_profile: freelancerProfileData || {
                full_name: null,
                photo_url: null,
              },
              last_message: lastMessage || undefined,
            });
          }
        } else {
          setActiveConversation(null);
        }

        // Determine dashboard state
        if (!active) {
          setDashboardState(past.length > 0 ? "no_active_job" : "first_time");
        } else if (active.status === "locked") {
          setDashboardState("job_matched");
        } else {
          setDashboardState("job_in_progress");
        }
      } catch (err) {
        console.error("Error loading dashboard:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [user]);

  function getStatusLabel(status: string): string {
    const statusMap: Record<string, string> = {
      draft: "Draft",
      ready: "Ready",
      notifying: "Checking availability",
      confirmations_closed: "Waiting for confirmations",
      locked: "Nanny selected",
      active: "In progress",
      completed: "Completed",
      cancelled: "Cancelled",
    };
    return statusMap[status] || status;
  }

  function getStatusBadge(status: string) {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" }> = {
      draft: { label: "Draft", variant: "secondary" },
      ready: { label: "Ready", variant: "secondary" },
      notifying: { label: "Checking availability", variant: "warning" },
      confirmations_closed: { label: "Waiting for confirmations", variant: "warning" },
      locked: { label: "Nanny selected", variant: "success" },
      active: { label: "In progress", variant: "success" },
      completed: { label: "Completed", variant: "secondary" },
      cancelled: { label: "Cancelled", variant: "secondary" },
    };

    const config = statusMap[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "Not set";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getJobAction(job: JobRequest) {
    if (job.status === "notifying" || job.status === "confirmations_closed") {
      return { label: "View matches", path: `/client/jobs/${job.id}/confirmed` };
    }
    if (job.status === "locked" || job.status === "active") {
      return { label: "Open chat", path: `/chat/${activeConversation?.id || ""}` };
    }
    return { label: "View details", path: `#` };
  }

  async function handleLogout() {
    await signOut();
    navigate("/login", { replace: true });
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
      <div className="max-w-2xl mx-auto pt-8 space-y-6">
        {/* Primary CTA - Always visible */}
        <Card className="border-0 shadow-xl overflow-hidden">
          <div className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary mb-4 shadow-lg">
              <Baby className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Find a nanny</h1>
            <p className="text-muted-foreground mb-6">
              {dashboardState === "first_time" 
                ? "Get matched in minutes"
                : "Post another request"}
            </p>
            <Button 
              size="lg" 
              className="w-full"
              onClick={() => navigate("/client/create")}
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Find a nanny
            </Button>
          </div>
        </Card>

        {/* Active Job Card - Only if exists */}
        {activeJob && (
          <Card className="border-0 shadow-lg animate-fade-in">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Active Job</CardTitle>
                {(activeJob.status === "locked" || activeJob.status === "active") && selectedFreelancer ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={selectedFreelancer.photo_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {selectedFreelancer.full_name
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{selectedFreelancer.full_name || "Nanny"}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(activeJob.status)}
                    {activeJob.stage && (
                      <Badge variant={getJobStageBadge(activeJob.stage).variant} className="text-xs">
                        {getJobStageBadge(activeJob.stage).label}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Job Summary */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>{activeJob.children_count} child{activeJob.children_count > 1 ? "ren" : ""} · {activeJob.children_age_group}</span>
                </div>
                {activeJob.start_at && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>{formatDate(activeJob.start_at)}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{activeJob.location_city}</span>
                </div>
              </div>

              {/* Status explanation */}
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-medium">{getStatusLabel(activeJob.status)}</span>
                {activeJob.stage && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">Stage:</span>
                    <span className="font-medium">{getJobStageBadge(activeJob.stage).label}</span>
                  </>
                )}
              </div>
              {activeJob.status === "notifying" && (
                <p className="text-sm text-muted-foreground">
                  We're checking which nannies are available for your request.
                </p>
              )}
              {activeJob.status === "confirmations_closed" && (
                <p className="text-sm text-muted-foreground">
                  Waiting for nannies to confirm availability.
                </p>
              )}
              {activeJob.status === "locked" && (
                <p className="text-sm text-muted-foreground">
                  You're connected with a nanny. Start chatting to coordinate.
                </p>
              )}
              {activeJob.status === "active" && (
                <p className="text-sm text-muted-foreground">
                  Job is in progress. Keep in touch with your nanny.
                </p>
              )}

              {/* Action Button */}
              <Button
                className="w-full"
                onClick={() => {
                  const action = getJobAction(activeJob);
                  if (action.path) navigate(action.path);
                }}
              >
                {getJobAction(activeJob).label}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Messages Preview - Only if conversation exists */}
        {activeConversation && (
          <Card className="border-0 shadow-lg animate-fade-in">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-primary" />
                Messages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={activeConversation.freelancer_profile?.photo_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {activeConversation.freelancer_profile?.full_name?.[0] || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {activeConversation.freelancer_profile?.full_name || "Nanny"}
                  </p>
                  {activeConversation.last_message && (
                    <p className="text-sm text-muted-foreground truncate">
                      {activeConversation.last_message.body}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/chat/${activeConversation.id}`)}
                >
                  Open
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Past Jobs - Collapsed by default if empty */}
        {pastJobs.length > 0 && (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Your Jobs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pastJobs.slice(0, 5).map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-medium">
                          {formatDate(job.created_at)}
                        </span>
                        {getStatusBadge(job.status)}
                        {job.stage && (
                          <Badge variant={getJobStageBadge(job.stage).variant} className="text-xs">
                            {getJobStageBadge(job.stage).label}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {job.care_type} · {job.location_city}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </div>
                ))}
                {pastJobs.length > 5 && (
                  <p className="text-sm text-center text-muted-foreground">
                    +{pastJobs.length - 5} more jobs
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mini Profile */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarImage src={profile?.photo_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {profile?.full_name?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{profile?.full_name || "User"}</p>
                  <p className="text-sm text-muted-foreground">
                    {profile?.city || "Location not set"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/client/profile")}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

