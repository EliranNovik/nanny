import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Baby, Sparkles, Clock, MapPin, ArrowRight, Loader2, Bell, Briefcase,
  UtensilsCrossed, Truck, HelpCircle, Calendar, Repeat,
  Hourglass, MessageCircle, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StarRating } from "@/components/StarRating";
import JobMap from "@/components/JobMap";

interface JobRequest {
  id: string;
  status: string;
  client_id: string;
  selected_freelancer_id: string | null;
  care_type?: string;
  children_count?: number;
  children_age_group?: string;
  location_city: string;
  start_at: string | null;
  created_at: string;
  service_type?: string;
  service_details?: any;
  time_duration?: string;
  care_frequency?: string;
}

interface Invitation {
  id: string;
  job_id: string;
  status: string;
  created_at: string;
  isConfirmed?: boolean;
  isDeclined?: boolean;
  job_requests: JobRequest & {
    profiles?: { full_name: string | null; photo_url: string | null };
  };
}

interface MyPostedRequest extends JobRequest {
  // outbound: my own jobs as client
}

interface ClientProfile {
  full_name: string | null;
  photo_url: string | null;
  average_rating?: number;
  total_ratings?: number;
}

export default function FreelancerDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [activeJobs, setActiveJobs] = useState<JobRequest[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [clientProfiles, setClientProfiles] = useState<Record<string, ClientProfile>>({});
  const [lastConversation, setLastConversation] = useState<{
    id: string;
    otherName: string | null;
    otherPhoto: string | null;
    lastMessage: string | null;
    lastMessageTime: string | null;
  } | null>(null);

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [myRequests, setMyRequests] = useState<MyPostedRequest[]>([]);
  const [requestsTab, setRequestsTab] = useState<"invitations" | "my">("invitations");

  useEffect(() => {
    async function load() {
      if (!user) return;
      try {
        // Active jobs (freelancer is selected)
        const { data: jobs } = await supabase
          .from("job_requests")
          .select("*")
          .eq("selected_freelancer_id", user.id)
          .in("status", ["locked", "active"])
          .order("created_at", { ascending: false })
          .limit(3);

        const activeJobsList = jobs || [];
        setActiveJobs(activeJobsList);

        if (activeJobsList.length > 0) {
          const clientIds = Array.from(new Set(activeJobsList.map(j => j.client_id)));
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, photo_url, average_rating, total_ratings")
            .in("id", clientIds);

          const profileMap: Record<string, ClientProfile> = {};
          profiles?.forEach(p => {
            profileMap[p.id] = p;
          });
          setClientProfiles(profileMap);

          // Get conversation for the first active job
          const { data: conv } = await supabase
            .from("conversations")
            .select("id")
            .eq("job_id", activeJobsList[0].id)
            .maybeSingle();
          setActiveConversationId(conv?.id || null);
        }

        // Latest conversation (most recent, any job)
        const { data: convRows } = await supabase
          .from("conversations")
          .select("id, job_id, client_id")
          .eq("freelancer_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (convRows) {
          const { data: otherProfile } = await supabase
            .from("profiles")
            .select("full_name, photo_url")
            .eq("id", convRows.client_id)
            .single();
          const { data: lastMsg } = await supabase
            .from("messages")
            .select("body, created_at")
            .eq("conversation_id", convRows.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          setLastConversation({
            id: convRows.id,
            otherName: otherProfile?.full_name || null,
            otherPhoto: otherProfile?.photo_url || null,
            lastMessage: lastMsg?.body || null,
            lastMessageTime: lastMsg?.created_at || null,
          });
        }

        // Invitations (notifications sent to this freelancer)
        const { data: notifs } = await supabase
          .from("job_candidate_notifications")
          .select(`id, job_id, status, created_at,
            job_requests (
              id, client_id, service_type, care_type, children_count, children_age_group,
              location_city, start_at, created_at, service_details, time_duration, care_frequency, selected_freelancer_id,
              profiles!job_requests_client_id_fkey ( full_name, photo_url )
            )`)
          .eq("freelancer_id", user.id)
          .in("status", ["pending", "opened"])
          .order("created_at", { ascending: false })
          .limit(3);

        const { data: confs } = await supabase
          .from("job_confirmations")
          .select("job_id, status")
          .eq("freelancer_id", user.id);
        const confirmedIds = new Set((confs || []).filter(c => c.status === "available").map(c => c.job_id));
        const declinedIds = new Set((confs || []).filter(c => c.status === "declined").map(c => c.job_id));

        const mapped = (notifs || [])
          .filter((n: any) => n.job_requests)
          .map((n: any) => ({
            ...n,
            isConfirmed: confirmedIds.has(n.job_id),
            isDeclined: declinedIds.has(n.job_id),
          }));
        setInvitations(mapped);

        // My Posted Requests (freelancer also acts as a client)
        const { data: openReqs } = await supabase
          .from("job_requests")
          .select("*")
          .eq("client_id", user.id)
          .in("status", ["ready", "notifying", "confirmations_closed"])
          .order("created_at", { ascending: false })
          .limit(3);
        setMyRequests(openReqs || []);

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  function formatJobTitle(job: JobRequest) {
    if (job.service_type === "cleaning") return "Cleaning";
    if (job.service_type === "cooking") return "Cooking";
    if (job.service_type === "pickup_delivery") return "Pickup & Delivery";
    if (job.service_type === "nanny") return "Nanny";
    if (job.service_type === "other_help") return "Other Help";
    return "Service Request";
  }

  function getServiceIcon(serviceType?: string) {
    if (serviceType === "cleaning") return <Sparkles className="w-3.5 h-3.5" />;
    if (serviceType === "cooking") return <UtensilsCrossed className="w-3.5 h-3.5" />;
    if (serviceType === "pickup_delivery") return <Truck className="w-3.5 h-3.5" />;
    if (serviceType === "nanny") return <Baby className="w-3.5 h-3.5" />;
    if (serviceType === "other_help") return <HelpCircle className="w-3.5 h-3.5" />;
    return <Briefcase className="w-3.5 h-3.5" />;
  }

  function getJobStatusBadge(status: string): { label: string; variant: "default" | "secondary" | "outline" } {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      locked: { label: "In Progress", variant: "default" },
      active: { label: "In Progress", variant: "default" },
      ready: { label: "Ready", variant: "secondary" },
      notifying: { label: "Checking availability", variant: "secondary" },
      confirmations_closed: { label: "Waiting confirmations", variant: "secondary" },
    };
    return map[status] || { label: status, variant: "outline" };
  }

  if (loading) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-mesh p-4 pb-64 md:pb-32">
      <div className="max-w-2xl mx-auto pt-8 space-y-6">



        {/* Active Job Card - styled like client's */}
        {activeJobs[0] && (
          <Card className="border border-border/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden">
            <CardContent className="p-0">
              {/* Header bar */}
              <div className="px-5 py-3 flex items-center justify-between bg-white dark:bg-zinc-900 border-b border-black/10 dark:border-white/10 shadow-sm">
                <div className="flex items-center gap-2">
                  {activeJobs[0].status === "active"
                    ? <Clock className="w-4 h-4 text-slate-900 dark:text-slate-100" />
                    : <Calendar className="w-4 h-4 text-slate-900 dark:text-slate-100" />}
                  <span className="text-sm font-bold capitalize text-slate-900 dark:text-slate-100 tracking-tight">
                    {getJobStatusBadge(activeJobs[0].status).label}
                  </span>
                </div>
                <Badge variant="outline" className="flex items-center gap-1 text-xs px-2.5 py-1 font-bold border-0 bg-primary text-white shadow-sm">
                  {getServiceIcon(activeJobs[0].service_type)}{formatJobTitle(activeJobs[0])}
                </Badge>
              </div>

              <div className="bg-white dark:bg-zinc-900">
                {/* Client info */}
                {clientProfiles[activeJobs[0].client_id] && (
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-3.5">
                      <Avatar className="w-14 h-14 border-2 border-primary/10 shadow-sm">
                        <AvatarImage src={clientProfiles[activeJobs[0].client_id].photo_url || undefined} className="object-cover" />
                        <AvatarFallback className="bg-primary/5 text-primary font-bold text-xl">
                          {clientProfiles[activeJobs[0].client_id].full_name?.charAt(0).toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-0.5">
                        <p className="font-bold text-lg leading-tight">{clientProfiles[activeJobs[0].client_id].full_name || "Client"}</p>
                        <StarRating rating={clientProfiles[activeJobs[0].client_id].average_rating ?? 0} totalRatings={clientProfiles[activeJobs[0].client_id].total_ratings ?? 0} size="sm" showCount={true} />
                        {activeJobs[0].location_city && (
                          <div className="flex items-center text-slate-600 dark:text-slate-400 text-sm">
                            <MapPin className="w-3.5 h-3.5 mr-1 text-primary/70" />{activeJobs[0].location_city}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Job Map */}
                {(activeJobs[0].service_type === 'pickup_delivery' || activeJobs[0].location_city) ? (
                  <div className="mt-2 overflow-hidden">
                    <JobMap job={activeJobs[0]} />
                  </div>
                ) : null}

                {/* Details */}
                <div className="px-5 pt-4 pb-2">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
                    {activeJobs[0].start_at && (
                      <div className="flex flex-wrap items-center gap-2 col-span-2 bg-slate-100 dark:bg-zinc-800/30 px-3 py-2 rounded-xl border border-border/40 mb-1">
                        <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="font-bold text-slate-900 dark:text-slate-100">{new Date(activeJobs[0].start_at).toLocaleDateString()}</span>
                        <span className="text-slate-600 dark:text-slate-400">at</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">{new Date(activeJobs[0].start_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    )}
                    {activeJobs[0].time_duration && (
                      <div className="flex items-center gap-2 col-span-1">
                        <Hourglass className="w-3.5 h-3.5 text-primary/70 flex-shrink-0" />
                        <span className="font-medium text-slate-900 dark:text-slate-100 text-xs">{activeJobs[0].time_duration.replace(/_/g, "-")}</span>
                      </div>
                    )}
                    {activeJobs[0].care_frequency && (
                      <div className="flex items-center gap-2 col-span-1">
                        <Repeat className="w-3.5 h-3.5 text-primary/70 flex-shrink-0" />
                        <span className="font-medium text-slate-900 dark:text-slate-100 capitalize text-xs">{activeJobs[0].care_frequency.replace(/_/g, " ")}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Buttons */}
                <div className="px-5 pb-5 pt-2 flex gap-3">
                  <Button className="flex-1 h-11 text-sm font-semibold border-2" variant="outline"
                    onClick={() => activeConversationId ? navigate(`/chat/${activeConversationId}`) : navigate(`/freelancer/active-jobs`)}>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Contact
                  </Button>
                  <Button className="flex-1 h-11 text-sm font-semibold bg-primary hover:bg-primary/90 text-white shadow-md"
                    onClick={() => navigate("/freelancer/active-jobs")}>
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Show More
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Latest Messages */}
        {lastConversation && (
          <Card className="border border-border/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden">
            <CardContent className="p-0">
              <div className="px-5 py-3 flex items-center justify-between bg-white dark:bg-zinc-900 border-b border-black/10 dark:border-white/10 shadow-sm">
                <h2 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <MessageCircle className="w-4 h-4 text-slate-900 dark:text-slate-100" /> MESSAGES
                </h2>
                <Button variant="ghost" size="sm" className="gap-1 text-[10px] uppercase tracking-wider h-7 text-white/80 hover:text-white hover:bg-white/10"
                  onClick={() => navigate(`/chat/${lastConversation.id}`)}>
                  Open <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
              <div className="bg-white dark:bg-zinc-900">
                <div className="px-5 py-4 flex items-center gap-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  onClick={() => navigate(`/chat/${lastConversation.id}`)}>
                  <Avatar className="w-12 h-12 border-2 border-primary/10 shadow-sm flex-shrink-0">
                    <AvatarImage src={lastConversation.otherPhoto || undefined} className="object-cover" />
                    <AvatarFallback className="bg-primary/5 text-primary font-bold text-lg">
                      {lastConversation.otherName?.charAt(0).toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{lastConversation.otherName || "Client"}</p>
                      {lastConversation.lastMessageTime && (
                        <span className="text-xs text-slate-600 dark:text-slate-400 flex-shrink-0 ml-2">
                          {new Date(lastConversation.lastMessageTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                      {lastConversation.lastMessage || "No messages yet"}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600/40 dark:text-slate-400/40 flex-shrink-0" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Latest Requests with toggle */}
        <Card className="border border-border/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            {/* Section header */}
            <div className="px-5 py-3 flex items-center justify-between bg-white dark:bg-zinc-900 border-b border-black/10 dark:border-white/10 shadow-sm">
              <h2 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <Bell className="w-4 h-4 text-slate-900 dark:text-slate-100" /> LATEST REQUESTS
              </h2>
              <Button variant="ghost" size="sm" className="gap-1 text-[10px] uppercase tracking-wider h-7 text-white/80 hover:text-white hover:bg-white/10"
                onClick={() => navigate("/freelancer/active-jobs")}>
                View All <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
            <div className="bg-white dark:bg-zinc-900">
              <div className="px-5 py-3 border-b border-black/5 dark:border-white/5">
                {/* Toggle */}
                <div className="flex gap-1 bg-black/5 dark:bg-white/5 rounded-xl p-1 border border-black/5 dark:border-white/5">
                  <button
                    onClick={() => setRequestsTab("invitations")}
                    className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all",
                      requestsTab === "invitations"
                        ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white")}
                  >
                    <Bell className="w-3.5 h-3.5" /> Invitations
                  </button>
                  <button
                    onClick={() => setRequestsTab("my")}
                    className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all",
                      requestsTab === "my"
                        ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white")}
                  >
                    <Briefcase className="w-3.5 h-3.5" /> My Requests
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="divide-y divide-black/5">
                {requestsTab === "invitations" ? (
                  invitations.length > 0 ? invitations.map((notif) => {
                    const job = notif.job_requests;
                    const isDeclined = notif.isDeclined;
                    const isConfirmed = notif.isConfirmed;
                    return (
                      <div key={notif.id}
                        className={cn("px-5 py-4 flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer", isDeclined && "opacity-60")}
                        onClick={() => navigate("/freelancer/active-jobs?tab=requests")}>
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                          {getServiceIcon(job?.service_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{formatJobTitle(job)}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                            <MapPin className="w-3 h-3" /> {job?.location_city}
                            {job?.start_at && <><Calendar className="w-3 h-3 ml-1" />{new Date(job.start_at).toLocaleDateString()}</>}
                          </div>
                        </div>
                        <Badge
                          variant={isDeclined ? "destructive" : isConfirmed ? "default" : "secondary"}
                          className={cn("text-xs flex-shrink-0", !isDeclined && !isConfirmed && "bg-white/10 text-slate-600 dark:text-slate-400 border-black/10 dark:border-white/10")}>
                          {isDeclined ? "Declined" : isConfirmed ? "Confirmed" : "Pending"}
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-slate-600/40 dark:text-slate-400/40 flex-shrink-0" />
                      </div>
                    );
                  }) : (
                    <div className="px-5 py-10 text-center text-slate-600/60 dark:text-slate-400/60">
                      <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No invitations right now</p>
                    </div>
                  )
                ) : (
                  myRequests.length > 0 ? myRequests.map((req) => (
                    <div key={req.id}
                      className="px-5 py-4 flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => navigate("/client/active-jobs")}>
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                        {getServiceIcon(req.service_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{formatJobTitle(req)}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                          <MapPin className="w-3 h-3" /> {req.location_city}
                          {req.start_at && <><Calendar className="w-3 h-3 ml-1" />{new Date(req.start_at).toLocaleDateString()}</>}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-xs flex-shrink-0 border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-400">
                        {getJobStatusBadge(req.status).label}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-slate-600/40 dark:text-slate-400/40 flex-shrink-0" />
                    </div>
                  )) : (
                    <div className="px-5 py-10 text-center text-slate-600/60 dark:text-slate-400/60">
                      <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No open requests at the moment</p>
                      <Button variant="outline" size="sm" className="mt-4 border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-white/5" onClick={() => navigate("/client/create")}>
                        Post a Request
                      </Button>
                    </div>
                  )
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Welcome empty state */}
        {activeJobs.length === 0 && invitations.length === 0 && myRequests.length === 0 && (
          <Card className="border-0 shadow-lg text-center py-12 bg-white dark:bg-zinc-900">
            <CardContent>
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-zinc-800 mx-auto mb-4 flex items-center justify-center">
                <Briefcase className="w-8 h-8 text-slate-600 dark:text-slate-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Welcome!</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">Complete your profile to start receiving job requests.</p>
              <Button onClick={() => navigate("/freelancer/profile/edit")}>Complete Profile</Button>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
