import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Baby, Sparkles, MapPin, ArrowRight, Loader2, Bell, Briefcase,
  UtensilsCrossed, Truck, HelpCircle, Calendar,
  MessageCircle, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StarRating } from "@/components/StarRating";
import { FullscreenMapModal } from "@/components/FullscreenMapModal";
import DashboardLiveJobCard from "@/components/DashboardLiveJobCard";

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

interface Profile {
  full_name: string | null;
  photo_url: string | null;
  average_rating?: number;
  total_ratings?: number;
}

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [activeJobs, setActiveJobs] = useState<JobRequest[]>([]);
  const [freelancerProfiles, setFreelancerProfiles] = useState<Record<string, Profile>>({});
  const [activeConversationIds, setActiveConversationIds] = useState<Record<string, string>>({});
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<JobRequest[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [requestsTab, setRequestsTab] = useState<"my" | "invitations">("my");
  const [selectedMapJob, setSelectedMapJob] = useState<JobRequest | null>(null);

  // Load cache on mount
  useEffect(() => {
    if (!user) return;
    try {
      const cacheKey = `client_dashboard_cache_${user.id}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Use cache if less than 1 hour old
        if (Date.now() - timestamp < 3600000) {
          setActiveJobs(data.activeJobs || []);
          setFreelancerProfiles(data.freelancerProfiles || {});
          setActiveConversationIds(data.activeConversationIds || {});
          setMyRequests(data.myRequests || []);
          setInvitations(data.invitations || []);
          setRecentMessages(data.recentMessages || []);
          setLoading(false); 
        }
      }
    } catch (e) {
      console.error("Cache load error:", e);
    }
  }, [user]);

  useEffect(() => {
    async function load() {
      if (!user) return;
      
      try {
        const [activeJobRes, openRequestsRes, invitationsRes, recentMessagesRes] = await Promise.all([
          // 1. Active jobs
          supabase
            .from("job_requests")
            .select("*")
            .eq("client_id", user.id)
            .in("status", ["locked", "active"])
            .order("created_at", { ascending: false }),
            
          // 2. Open requests
          supabase
            .from("job_requests")
            .select("*")
            .eq("client_id", user.id)
            .in("status", ["ready", "notifying", "confirmations_closed"])
            .order("created_at", { ascending: false })
            .limit(3),
            
          // 3. Invitations
          supabase
            .from("job_candidate_notifications")
            .select(`id, job_id, status, created_at,
              job_requests (
                id, client_id, service_type, care_type, children_count, children_age_group,
                location_city, start_at, created_at, service_details, time_duration, care_frequency, selected_freelancer_id,
                profiles!job_requests_client_id_fkey ( full_name, photo_url, average_rating, total_ratings )
              )`)
            .eq("freelancer_id", user.id)
            .in("status", ["pending", "opened"])
            .order("created_at", { ascending: false })
            .limit(3),

          supabase
            .from("conversations")
            .select(`
              id, 
              freelancer_id, 
              created_at,
              messages (
                body, 
                created_at,
                sender_id
              ),
              profiles:freelancer_id (
                full_name,
                photo_url
              )
            `)
            .eq("client_id", user.id)
            .order("created_at", { ascending: false })
            .limit(3)
        ]);

        // Process active job dependencies
        const jobs = activeJobRes.data || [];
        setActiveJobs(jobs);

        let profileMap: Record<string, Profile> = {};
        let conversationMap: Record<string, string> = {};

        if (jobs.length > 0) {
          const freelancerIds = Array.from(new Set(jobs.map((j: any) => j.selected_freelancer_id).filter(Boolean))) as string[];
          const jobIds = jobs.map((j: any) => j.id);

          if (freelancerIds.length > 0) {
            const [profRes, convRes, fallbackConvRes] = await Promise.all([
              supabase
                .from("profiles")
                .select("id, full_name, photo_url, average_rating, total_ratings")
                .in("id", freelancerIds),
              supabase
                .from("conversations")
                .select("id, job_id, freelancer_id")
                .in("job_id", jobIds),
              supabase
                .from("conversations")
                .select("id, freelancer_id, client_id")
                .eq("client_id", user.id)
                .in("freelancer_id", freelancerIds)
            ]);

            profRes.data?.forEach(p => { profileMap[p.id] = p; });

            jobs.forEach((job: any) => {
              const conv = convRes.data?.find(c => c.job_id === job.id);
              if (conv) {
                conversationMap[job.id] = conv.id;
              } else {
                const fallback = fallbackConvRes.data?.find(c => c.freelancer_id === job.selected_freelancer_id);
                if (fallback) {
                   conversationMap[job.id] = fallback.id;
                }
              }
            });
          }
        }

        setFreelancerProfiles(profileMap);
        setActiveConversationIds(conversationMap);

        // Process recent messages
        const processedMessages = (recentMessagesRes.data || []).map((conv: any) => {
          const lastMsg = conv.messages?.sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0];
          
          return {
            id: conv.id,
            otherName: conv.profiles?.full_name || "Helper",
            otherPhoto: conv.profiles?.photo_url || null,
            lastMessage: lastMsg?.body || "No messages yet",
            lastMessageTime: lastMsg?.created_at || conv.created_at,
            isUnread: lastMsg ? lastMsg.sender_id !== user.id : false,
          };
        });
        setRecentMessages(processedMessages);

        // Process requests and invitations
        const requestsList = openRequestsRes.data || [];
        setMyRequests(requestsList);
        
        const rawInvitations = invitationsRes.data || [];
        const { data: confs } = await supabase
          .from("job_confirmations")
          .select("job_id, status")
          .eq("freelancer_id", user.id);
          
        const confirmedIds = new Set((confs || []).filter(c => c.status === "available").map(c => c.job_id));
        const declinedIds = new Set((confs || []).filter(c => c.status === "declined").map(c => c.job_id));

        const mappedInvitations = rawInvitations
          .filter((n: any) => n.job_requests)
          .map((n: any) => ({
            ...n,
            isConfirmed: confirmedIds.has(n.job_id),
            isDeclined: declinedIds.has(n.job_id),
          }));
        setInvitations(mappedInvitations);

        // Update cache
        const cacheKey = `client_dashboard_cache_${user.id}`;
        localStorage.setItem(cacheKey, JSON.stringify({
          timestamp: Date.now(),
          data: {
            activeJobs: jobs,
            freelancerProfiles: profileMap,
            activeConversationIds: conversationMap,
            myRequests: requestsList,
            invitations: mappedInvitations,
            recentMessages: processedMessages
          }
        }));

      } catch (e) {
        console.error("Dashboard load error:", e);
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
        {/* Welcome Section */}
        <div className="mb-2 px-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
            Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}!
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-500" />
            Here's what's happening with your requests today.
          </p>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card 
            className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl cursor-pointer hover:bg-slate-50 transition-all active:scale-[0.98]"
            onClick={() => navigate("/jobs")}
          >
            <CardContent className="p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-bold uppercase tracking-wider">Active Jobs</span>
                <Briefcase className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-foreground">{activeJobs.length}</p>
            </CardContent>
          </Card>

          <Card 
            className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl cursor-pointer hover:bg-slate-50 transition-all active:scale-[0.98]"
            onClick={() => navigate("/jobs")}
          >
            <CardContent className="p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-bold uppercase tracking-wider">My Requests</span>
                <Bell className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-orange-500">{myRequests.length}</p>
            </CardContent>
          </Card>

          <Card 
            className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl cursor-pointer hover:bg-slate-50 transition-all active:scale-[0.98]"
            onClick={() => navigate("/jobs")}
          >
            <CardContent className="p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-bold uppercase tracking-wider">Inbound</span>
                <span className="text-xs font-bold text-primary">NEW</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{invitations.length}</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl">
            <CardContent className="p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-bold uppercase tracking-wider">Rating</span>
                <StarRating rating={1} size="sm" showCount={false} />
              </div>
              <div className="flex items-baseline gap-1">
                <p className="text-2xl font-bold text-foreground">{(profile as any)?.average_rating || "5.0"}</p>
                <span className="text-[10px] text-muted-foreground">/ 5.0</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Jobs Card - styled like Live Jobs tab */}
        {activeJobs.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2 uppercase">
                ACTIVE {activeJobs.length === 1 ? 'JOB' : 'JOBS'}
              </h2>
            </div>
            
            <div className="space-y-4">
              {activeJobs.map(job => (
                <DashboardLiveJobCard 
                  key={job.id}
                  job={job}
                  participant={{
                    full_name: job.selected_freelancer_id ? freelancerProfiles[job.selected_freelancer_id]?.full_name || "Helper" : "Helper",
                    photo_url: job.selected_freelancer_id ? freelancerProfiles[job.selected_freelancer_id]?.photo_url || undefined : undefined,
                    average_rating: job.selected_freelancer_id ? freelancerProfiles[job.selected_freelancer_id]?.average_rating : undefined,
                    total_ratings: job.selected_freelancer_id ? freelancerProfiles[job.selected_freelancer_id]?.total_ratings : undefined
                  }}
                  onMapClick={() => setSelectedMapJob(job)}
                  onChatClick={() => activeConversationIds[job.id] ? navigate(`/chat/${activeConversationIds[job.id]}`) : navigate("/messages")}
                  onNavigateClick={() => {
                    if (job.service_type === 'pickup_delivery' && job.service_details?.from_address && job.service_details?.to_address) {
                      const origin = encodeURIComponent(job.service_details.from_address);
                      const destination = encodeURIComponent(job.service_details.to_address);
                      window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`, '_blank');
                    } else {
                      const query = encodeURIComponent(job.location_city || "");
                      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                    }
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden bg-white dark:bg-zinc-900">
          <CardContent className="p-0">
            <div className="px-5 py-4 flex items-center justify-between border-b border-black/5 dark:border-white/5">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                </div>
                MESSAGES
              </h2>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary"
                onClick={() => navigate("/messages")}
              >
                VIEW ALL
              </Button>
            </div>
            
            <div className="divide-y divide-black/5 dark:divide-white/5">
              {recentMessages.length > 0 ? recentMessages.map((msg) => (
                <div 
                  key={msg.id} 
                  className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-all group"
                  onClick={() => navigate(`/chat/${msg.id}`)}
                >
                  <div className="relative">
                    <Avatar className="w-12 h-12 border border-black/5">
                      <AvatarImage src={msg.otherPhoto} className="object-cover" />
                      <AvatarFallback className="bg-primary/5 text-primary font-bold">
                        {msg.otherName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    {msg.isUnread && (
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary border-2 border-white dark:border-zinc-900 rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className={cn("text-sm font-bold truncate", msg.isUnread ? "text-foreground" : "text-slate-700 dark:text-slate-300")}>
                        {msg.otherName}
                      </p>
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {msg.lastMessageTime ? new Date(msg.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                      </span>
                    </div>
                    <p className={cn("text-xs truncate", msg.isUnread ? "font-semibold text-slate-900 dark:text-slate-100" : "text-muted-foreground")}>
                      {msg.lastMessage}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold text-primary hover:bg-primary/5 rounded-full px-3 border border-primary/10">
                      REPLY
                    </Button>
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
                      <ArrowRight className="w-4 h-4 text-primary" />
                    </div>
                  </div>
                </div>
              )) : (
                <div className="px-5 py-10 text-center text-muted-foreground">
                  <p className="text-sm">No recent messages</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Latest Requests with toggle */}
        <Card className="border border-border/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            {/* Section header */}
            <div className="px-5 py-3 flex items-center justify-between bg-white dark:bg-zinc-900 border-b border-black/10 dark:border-white/10 shadow-sm">
              <h2 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <Bell className="w-4 h-4 text-slate-900 dark:text-slate-100" /> LATEST REQUESTS
              </h2>
              <Button variant="ghost" size="sm" className="gap-1 text-[10px] uppercase tracking-wider h-7 text-white/80 hover:text-white hover:bg-white/10"
                onClick={() => navigate("/client/jobs")}>
                View All <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
            <div className="bg-white dark:bg-zinc-900">
              <div className="px-5 py-3 border-b border-black/5 dark:border-white/5">
                {/* Toggle - Smaller & Built-in */}
                <div className="flex items-center justify-center gap-1.5 p-1 bg-black/5 dark:bg-white/5 rounded-xl w-fit mx-auto">
                  <button
                    onClick={() => setRequestsTab("my")}
                    className={cn("flex items-center justify-center gap-1.5 py-1 px-4 rounded-lg text-[10px] font-bold transition-all",
                      requestsTab === "my"
                        ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white")}
                  >
                    <Briefcase className="w-3 h-3" /> My Requests
                  </button>
                  <button
                    onClick={() => setRequestsTab("invitations")}
                    className={cn("flex items-center justify-center gap-1.5 py-1 px-4 rounded-lg text-[10px] font-bold transition-all",
                      requestsTab === "invitations"
                        ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white")}
                  >
                    <Bell className="w-3 h-3" /> Invitations
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="divide-y divide-black/5">
                {requestsTab === "my" ? (
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
                      <ChevronRight className="w-4 h-4 text-slate-600/40 dark:text-slate-400/40 flex-shrink-0" />
                    </div>
                  )) : (
                    <div className="px-5 py-10 text-center text-slate-600/60 dark:text-slate-400/60">
                      <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No open requests at the moment</p>
                      <Button variant="outline" size="sm" className="mt-4 border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-white/5" onClick={() => navigate("/client/create")}>
                        Create Request
                      </Button>
                    </div>
                  )
                ) : (
                  invitations.length > 0 ? invitations.map((notif) => {
                    const job = notif.job_requests;
                    const isDeclined = notif.isDeclined;
                    const isConfirmed = notif.isConfirmed;
                    return (
                      <div key={notif.id}
                        className={cn("px-5 py-4 flex items-center gap-3 hover:bg-black/5 transition-colors cursor-pointer", isDeclined && "opacity-60")}
                        onClick={() => navigate("/client/active-jobs?tab=requests")}>
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                          {getServiceIcon(job?.service_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-black">{formatJobTitle(job)}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-black/60">
                            <MapPin className="w-3 h-3" /> {job?.location_city}
                          </div>
                        </div>
                        <Badge
                          variant={isDeclined ? "destructive" : isConfirmed ? "default" : "secondary"}
                          className={cn("text-xs flex-shrink-0", !isDeclined && !isConfirmed && "bg-black/5 text-black/70 border-none")}>
                          {isDeclined ? "Declined" : isConfirmed ? "Waiting for confirmation" : "Pending"}
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-black/30 flex-shrink-0" />
                      </div>
                    );
                  }) : (
                    <div className="px-5 py-10 text-center text-black/40">
                      <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No invitations right now</p>
                    </div>
                  )
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* No active job empty state */}
        {activeJobs.length === 0 && myRequests.length === 0 && (
          <Card className="border-0 shadow-lg text-center py-12 bg-white dark:bg-zinc-900">
            <CardContent>
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-zinc-800 mx-auto mb-4 flex items-center justify-center">
                <Baby className="w-8 h-8 text-slate-600 dark:text-slate-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No Active Jobs</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">Post a request to get matched with a helper.</p>
              <Button onClick={() => navigate("/client/create")}>Create Request</Button>
            </CardContent>
          </Card>
        )}

        <FullscreenMapModal 
          job={selectedMapJob} 
          isOpen={!!selectedMapJob} 
          onClose={() => setSelectedMapJob(null)} 
        />
      </div>
    </div>
  );
}
