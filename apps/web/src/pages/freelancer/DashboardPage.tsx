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
  const [activeJob, setActiveJob] = useState<JobRequest | null>(null);
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
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
        // Active job (freelancer is selected)
        const { data: jobs } = await supabase
          .from("job_requests")
          .select("*")
          .eq("selected_freelancer_id", user.id)
          .in("status", ["locked", "active"])
          .order("created_at", { ascending: false })
          .limit(1);

        const job = jobs?.[0] || null;
        setActiveJob(job);

        if (job?.client_id) {
          const { data: cp } = await supabase
            .from("profiles")
            .select("full_name, photo_url, average_rating, total_ratings")
            .eq("id", job.client_id)
            .single();
          setClientProfile(cp || null);

          const { data: conv } = await supabase
            .from("conversations")
            .select("id")
            .eq("job_id", job.id)
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

  function getJobStatusLabel(status: string) {
    const map: Record<string, string> = {
      locked: "In Progress", active: "In Progress",
      ready: "Ready", notifying: "Checking availability",
      confirmations_closed: "Waiting confirmations",
    };
    return map[status] || status;
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

        {/* Floating logo CTA */}
        <div className="flex justify-center">
          <button
            onClick={() => navigate("/client/create")}
            className="group transition-all duration-300 hover:scale-110 active:scale-95"
            title="Find a helper"
          >
            <img
              src="/ChatGPT Image Jan 19, 2026, 08_14_59 PM.png"
              alt="Find a helper"
              className="w-24 h-24 object-contain rounded-3xl drop-shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
            />
          </button>
        </div>

        {/* Active Job Card - styled like Live Jobs tab */}
        {activeJob && (
          <Card className="border border-border/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden bg-white dark:bg-card">
            <CardContent className="p-0">
              {/* Header bar */}
              <div className="px-5 py-3 flex items-center justify-between border-b border-border/30 bg-primary/5">
                <div className="flex items-center gap-2">
                  {activeJob.status === "active"
                    ? <Clock className="w-4 h-4 text-emerald-500" />
                    : <Calendar className="w-4 h-4 text-primary" />}
                  <span className={cn("text-sm font-semibold capitalize",
                    activeJob.status === "active" ? "text-emerald-600" : "text-primary")}>
                    {getJobStatusLabel(activeJob.status)}
                  </span>
                </div>
                <Badge variant="default" className="flex items-center gap-1 text-xs px-2.5 py-0.5 font-semibold">
                  {getServiceIcon(activeJob.service_type)}{formatJobTitle(activeJob)}
                </Badge>
              </div>

              {/* Client info */}
              {clientProfile && (
                <div className="px-5 py-4 border-b border-border/40">
                  <div className="flex items-center gap-3.5">
                    <Avatar className="w-14 h-14 border-2 border-primary/10 shadow-sm">
                      <AvatarImage src={clientProfile.photo_url || undefined} className="object-cover" />
                      <AvatarFallback className="bg-primary/5 text-primary font-bold text-xl">
                        {clientProfile.full_name?.charAt(0).toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-0.5">
                      <p className="font-bold text-lg leading-tight">{clientProfile.full_name || "Client"}</p>
                      {(clientProfile.average_rating ?? 0) > 0 && (
                        <StarRating rating={clientProfile.average_rating ?? 0} totalRatings={clientProfile.total_ratings ?? 0} size="sm" showCount={true} />
                      )}
                      {activeJob.location_city && (
                        <div className="flex items-center text-muted-foreground text-sm">
                          <MapPin className="w-3.5 h-3.5 mr-1 text-primary/70" />{activeJob.location_city}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Details */}
              <div className="px-5 pt-4 pb-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  {activeJob.start_at && (
                    <div className="flex flex-wrap items-center gap-2 col-span-2 bg-muted/30 px-3 py-2 rounded-xl border border-border/40 mb-1">
                      <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="font-bold text-foreground">{new Date(activeJob.start_at).toLocaleDateString()}</span>
                      <span className="text-muted-foreground">at</span>
                      <span className="font-bold text-foreground">{new Date(activeJob.start_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  )}
                  {activeJob.time_duration && (
                    <div className="flex items-center gap-2 col-span-1">
                      <Hourglass className="w-3.5 h-3.5 text-primary/70 flex-shrink-0" />
                      <span className="font-medium text-foreground text-xs">{activeJob.time_duration.replace(/_/g, "-")}</span>
                    </div>
                  )}
                  {activeJob.care_frequency && (
                    <div className="flex items-center gap-2 col-span-1">
                      <Repeat className="w-3.5 h-3.5 text-primary/70 flex-shrink-0" />
                      <span className="font-medium text-foreground capitalize text-xs">{activeJob.care_frequency.replace(/_/g, " ")}</span>
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
            </CardContent>
          </Card>
        )}

        {/* Latest Messages */}
        {lastConversation && (
          <Card className="border border-border/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden bg-white dark:bg-card">
            <CardContent className="p-0">
              <div className="px-5 py-4 border-b border-border/30 flex items-center justify-between">
                <h2 className="text-base font-bold flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-primary" /> Messages
                </h2>
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-8"
                  onClick={() => navigate(`/chat/${lastConversation.id}`)}>
                  Open <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="px-5 py-4 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => navigate(`/chat/${lastConversation.id}`)}>
                <Avatar className="w-12 h-12 border-2 border-primary/10 shadow-sm flex-shrink-0">
                  <AvatarImage src={lastConversation.otherPhoto || undefined} className="object-cover" />
                  <AvatarFallback className="bg-primary/5 text-primary font-bold text-lg">
                    {lastConversation.otherName?.charAt(0).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="font-semibold text-sm">{lastConversation.otherName || "Client"}</p>
                    {lastConversation.lastMessageTime && (
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                        {new Date(lastConversation.lastMessageTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {lastConversation.lastMessage || "No messages yet"}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Latest Requests with toggle */}
        <Card className="border border-border/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden bg-white dark:bg-card">
          <CardContent className="p-0">
            {/* Section header */}
            <div className="px-5 py-4 border-b border-border/30">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary" /> Latest Requests
                </h2>
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-8"
                  onClick={() => navigate("/freelancer/active-jobs")}>
                  View All <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
              {/* Toggle */}
              <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
                <button
                  onClick={() => setRequestsTab("invitations")}
                  className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all",
                    requestsTab === "invitations"
                      ? "bg-orange-500 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground")}
                >
                  <Bell className="w-3.5 h-3.5" /> Invitations
                </button>
                <button
                  onClick={() => setRequestsTab("my")}
                  className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all",
                    requestsTab === "my"
                      ? "bg-orange-500 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground")}
                >
                  <Briefcase className="w-3.5 h-3.5" /> My Requests
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="divide-y divide-border/30">
              {requestsTab === "invitations" ? (
                invitations.length > 0 ? invitations.map((notif) => {
                  const job = notif.job_requests;
                  const isDeclined = notif.isDeclined;
                  const isConfirmed = notif.isConfirmed;
                  return (
                    <div key={notif.id}
                      className={cn("px-5 py-4 flex items-center gap-3 hover:bg-muted/30 transition-colors cursor-pointer", isDeclined && "opacity-60")}
                      onClick={() => navigate("/freelancer/active-jobs?tab=requests")}>
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                        {getServiceIcon(job?.service_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{formatJobTitle(job)}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" /> {job?.location_city}
                          {job?.start_at && <><Calendar className="w-3 h-3 ml-1" />{new Date(job.start_at).toLocaleDateString()}</>}
                        </div>
                      </div>
                      <Badge
                        variant={isDeclined ? "destructive" : isConfirmed ? "default" : "secondary"}
                        className="text-xs flex-shrink-0">
                        {isDeclined ? "Declined" : isConfirmed ? "Confirmed" : "Pending"}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  );
                }) : (
                  <div className="px-5 py-10 text-center text-muted-foreground">
                    <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No invitations right now</p>
                  </div>
                )
              ) : (
                myRequests.length > 0 ? myRequests.map((req) => (
                  <div key={req.id}
                    className="px-5 py-4 flex items-center gap-3 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => navigate("/client/active-jobs")}>
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                      {getServiceIcon(req.service_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{formatJobTitle(req)}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" /> {req.location_city}
                        {req.start_at && <><Calendar className="w-3 h-3 ml-1" />{new Date(req.start_at).toLocaleDateString()}</>}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      {getJobStatusLabel(req.status)}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                )) : (
                  <div className="px-5 py-10 text-center text-muted-foreground">
                    <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No open requests at the moment</p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/client/create")}>
                      Post a Request
                    </Button>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>

        {/* Welcome empty state */}
        {!activeJob && invitations.length === 0 && myRequests.length === 0 && (
          <Card className="border-0 shadow-lg text-center py-12">
            <CardContent>
              <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                <Briefcase className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Welcome!</h3>
              <p className="text-muted-foreground mb-4">Complete your profile to start receiving job requests.</p>
              <Button onClick={() => navigate("/freelancer/profile/edit")}>Complete Profile</Button>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
