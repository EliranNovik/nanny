import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ArrowLeft,
  MessageCircle,
  Loader2,
  Clock,
  MapPin,
  Baby,
  Calendar,
  ChevronDown,
  ChevronUp
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
  created_at: string;
}

interface Conversation {
  id: string;
  job_id: string;
  client_id: string;
  created_at: string;
}

interface ClientProfile {
  id: string;
  full_name: string | null;
  photo_url: string | null;
}

export default function FreelancerActiveJobsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeJob, setActiveJob] = useState<JobRequest | null>(null);
  const [pastJobs, setPastJobs] = useState<JobRequest[]>([]);
  const [conversations, setConversations] = useState<Record<string, Conversation>>({});
  const [clientProfiles, setClientProfiles] = useState<Record<string, ClientProfile>>({});
  const [pastJobsExpanded, setPastJobsExpanded] = useState(false);

  useEffect(() => {
    async function loadJobs() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Fetch all jobs where this freelancer is selected
        const { data: allJobs } = await supabase
          .from("job_requests")
          .select("*")
          .eq("selected_freelancer_id", user.id)
          .order("created_at", { ascending: false });

        if (!allJobs) {
          setLoading(false);
          return;
        }

        // Separate into active and past jobs
        const active = allJobs.find(j => j.status === "locked" || j.status === "active");
        const past = allJobs.filter(j => j.status === "completed" || j.status === "cancelled");

        setActiveJob(active || null);
        setPastJobs(past);

        // Fetch conversations and client profiles for active job
        if (active) {
          const { data: convos } = await supabase
            .from("conversations")
            .select("id, job_id, client_id, created_at")
            .eq("job_id", active.id)
            .maybeSingle();

          if (convos) {
            setConversations({ [active.id]: convos });
            
            const { data: profile } = await supabase
              .from("profiles")
              .select("id, full_name, photo_url")
              .eq("id", convos.client_id)
              .single();

            if (profile) {
              setClientProfiles({ [convos.client_id]: profile });
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
  }, [user]);

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
      completed: { label: "Completed", variant: "outline" },
      cancelled: { label: "Cancelled", variant: "destructive" },
    };
    return map[status] || { label: status, variant: "outline" };
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
            onClick={() => navigate("/freelancer/dashboard")}
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
                  <CardTitle className="text-xl mb-2">
                    {formatJobTitle(activeJob)}
                  </CardTitle>
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
                {conversations[activeJob.id] && clientProfiles[conversations[activeJob.id].client_id] && (
                  <Avatar className="w-14 h-14 border-2 border-primary/20">
                    <AvatarImage src={clientProfiles[conversations[activeJob.id].client_id].photo_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {clientProfiles[conversations[activeJob.id].client_id].full_name
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
              {conversations[activeJob.id] && clientProfiles[conversations[activeJob.id].client_id] && (
                <div className="mt-2 text-sm">
                  <span className="text-muted-foreground">With: </span>
                  <span className="font-medium">{clientProfiles[conversations[activeJob.id].client_id].full_name}</span>
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
              {conversations[activeJob.id] && (
                <Button 
                  className="w-full" 
                  size="lg" 
                  onClick={() => navigate(`/chat/${conversations[activeJob.id].id}`)}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Open Chat
                </Button>
              )}
            </CardContent>
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
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>
        )}

        {/* Empty State */}
        {!activeJob && pastJobs.length === 0 && (
          <Card className="border-0 shadow-lg text-center py-12">
            <CardContent>
              <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                <Calendar className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No Active Jobs</h3>
              <p className="text-muted-foreground mb-4">
                You'll see jobs here once clients select you.
              </p>
              <Button onClick={() => navigate("/freelancer/profile")}>
                Update Profile
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
