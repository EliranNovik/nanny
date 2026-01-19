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
  Calendar as CalendarIcon,
  LogOut,
  Bell,
  ChevronRight
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
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [selectedFreelancer, setSelectedFreelancer] = useState<{ full_name: string | null; photo_url: string | null } | null>(null);
  const [dashboardState, setDashboardState] = useState<DashboardState>("first_time");
  const [nextAppointment, setNextAppointment] = useState<JobRequest & { freelancer_profile?: { full_name: string | null; photo_url: string | null } } | null>(null);
  const [latestRequests, setLatestRequests] = useState<JobRequest[]>([]);
  const [confirmationCounts, setConfirmationCounts] = useState<Record<string, number>>({});

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

        // Fetch next scheduled appointment (earliest future appointment)
        const now = new Date().toISOString();
        const { data: scheduledJobs } = await supabase
          .from("job_requests")
          .select("*")
          .eq("client_id", user.id)
          .in("status", ["locked", "active"])
          .not("start_at", "is", null)
          .gte("start_at", now)
          .order("start_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (scheduledJobs) {
          // Fetch freelancer profile if job has one
          let freelancerProfileData: { full_name: string | null; photo_url: string | null } | null = null;
          if (scheduledJobs.selected_freelancer_id) {
            const { data: freelancerProfile } = await supabase
              .from("profiles")
              .select("id, full_name, photo_url")
              .eq("id", scheduledJobs.selected_freelancer_id)
              .single();

            if (freelancerProfile) {
              freelancerProfileData = {
                full_name: freelancerProfile.full_name,
                photo_url: freelancerProfile.photo_url,
              };
            }
          }

          setNextAppointment({
            ...scheduledJobs,
            freelancer_profile: freelancerProfileData || undefined,
          });
        } else {
          setNextAppointment(null);
        }

        // Fetch latest open requests (ready, notifying, confirmations_closed)
        const { data: openRequests } = await supabase
          .from("job_requests")
          .select("*")
          .eq("client_id", user.id)
          .in("status", ["ready", "notifying", "confirmations_closed"])
          .order("created_at", { ascending: false })
          .limit(5);

        setLatestRequests(openRequests || []);

        // Fetch confirmation counts for open requests
        if (openRequests && openRequests.length > 0) {
          const { data: confirmations } = await supabase
            .from("job_confirmations")
            .select("job_id")
            .in("job_id", openRequests.map((j) => j.id))
            .eq("status", "available");

          const countsMap: Record<string, number> = {};
          (confirmations || []).forEach((conf) => {
            countsMap[conf.job_id] = (countsMap[conf.job_id] || 0) + 1;
          });
          setConfirmationCounts(countsMap);
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
            {/* Logo inside the card */}
            <div className="mb-4">
              <img 
                src="/ChatGPT Image Jan 19, 2026, 08_14_59 PM.png" 
                alt="MamaLama Logo" 
                className="h-24 w-auto mx-auto rounded-lg"
              />
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

        {/* Latest Requests Section */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                Latest Requests
              </CardTitle>
              {latestRequests.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/client/active-jobs")}
                  className="gap-1"
                >
                  View All
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestRequests.length > 0 ? (
              latestRequests.map((request) => {
                const confirmationCount = confirmationCounts[request.id] || 0;
                return (
                  <div
                    key={request.id}
                    className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer relative"
                    onClick={() => {
                      if (request.status === "confirmations_closed") {
                        navigate(`/client/jobs/${request.id}/confirmed`);
                      } else {
                        navigate("/client/active-jobs");
                      }
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0 pr-6">
                        <h3 className="font-semibold text-sm mb-1 truncate">
                          {request.children_count} kid{request.children_count > 1 ? "s" : ""} ({formatAgeGroup(request.children_age_group)})
                        </h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {request.location_city}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Baby className="w-3 h-3" />
                            {formatAgeGroup(request.children_age_group)}
                          </span>
                          {request.start_at && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <CalendarIcon className="w-3 h-3" />
                              {new Date(request.start_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {confirmationCount > 0 && (
                          <Badge variant="default" className="text-xs">
                            {confirmationCount} available
                          </Badge>
                        )}
                        <Badge
                          variant={
                            request.status === "confirmations_closed"
                              ? "default"
                              : request.status === "notifying"
                              ? "secondary"
                              : "outline"
                          }
                          className="text-xs"
                        >
                          {getStatusLabel(request.status)}
                        </Badge>
                        {request.stage && (
                          <Badge
                            variant={getJobStageBadge(request.stage).variant}
                            className="text-xs"
                          >
                            {getJobStageBadge(request.stage).label}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                      <Clock className="w-3 h-3" />
                      {formatDate(request.created_at)}
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground absolute top-4 right-4 flex-shrink-0" />
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground mb-4">
                  No open requests at the moment
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/client/create")}
                >
                  Create New Request
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Next Scheduled Appointment Section */}
        {nextAppointment && (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-2 flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-primary" />
                    Next Scheduled Appointment
                  </CardTitle>
                  <div className="flex items-center gap-2 mb-2">
                    {nextAppointment.stage && (
                      <Badge variant={getJobStageBadge(nextAppointment.stage).variant} className="text-xs">
                        {getJobStageBadge(nextAppointment.stage).label}
                      </Badge>
                    )}
                    {nextAppointment.location_city && (
                      <span className="text-sm text-muted-foreground">
                        {nextAppointment.location_city}
                      </span>
                    )}
                  </div>
                  {nextAppointment.freelancer_profile && (
                    <p className="text-sm text-muted-foreground">
                      Freelancer: {nextAppointment.freelancer_profile.full_name || "Unknown"}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-start gap-4 mb-2">
                  {nextAppointment.freelancer_profile && (
                    <Avatar className="w-12 h-12 border-2 border-primary/20 flex-shrink-0">
                      <AvatarImage
                        src={nextAppointment.freelancer_profile.photo_url || undefined}
                      />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {nextAppointment.freelancer_profile.full_name
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Job:</span>
                      <span className="font-medium">
                        {nextAppointment.children_count} kid{nextAppointment.children_count > 1 ? "s" : ""} ({formatAgeGroup(nextAppointment.children_age_group)})
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Location:</span>
                      <span className="font-medium">{nextAppointment.location_city}</span>
                    </div>
                  </div>
                </div>
                {nextAppointment.start_at && (
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" />
                        Date:
                      </span>
                      <span className="font-semibold text-primary">
                        {new Date(nextAppointment.start_at).toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Time:
                      </span>
                      <span className="font-medium">
                        {new Date(nextAppointment.start_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/calendar")}
                  className="gap-1"
                >
                  View Calendar
                  <ArrowRight className="w-4 h-4" />
                </Button>
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

