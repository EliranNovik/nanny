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
  UtensilsCrossed, Truck, HelpCircle, Calendar, MessageCircle, ChevronRight
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
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [activeJobs, setActiveJobs] = useState<JobRequest[]>([]);
  const [clientProfiles, setClientProfiles] = useState<Record<string, ClientProfile>>({});
  const [activeConversationIds, setActiveConversationIds] = useState<Record<string, string>>({});


  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [myRequests, setMyRequests] = useState<MyPostedRequest[]>([]);
  const [requestsTab, setRequestsTab] = useState<"invitations" | "my">("invitations");
  
  const [earningsToday, setEarningsToday] = useState(0);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [selectedMapJob, setSelectedMapJob] = useState<JobRequest | null>(null);

  // Load cache on mount
  useEffect(() => {
    if (!user) return;
    try {
      const cacheKey = `freelancer_dashboard_cache_${user.id}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Use cache if less than 1 hour old
        if (Date.now() - timestamp < 3600000) {
          setActiveJobs(data.activeJobs || []);
          setClientProfiles(data.clientProfiles || {});
          setActiveConversationIds(data.activeConversationIds || {});
          setInvitations(data.invitations || []);
          setMyRequests(data.myRequests || []);
          setEarningsToday(data.earningsToday || 0);
          setRecentMessages(data.recentMessages || []);
          setLoading(false); // Show cached data immediately
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
        const [activeJobsRes, latestConvRes, invitationsRes, myPostedRes, earningsTodayRes, recentMessagesRes] = await Promise.all([
          // 1. Active jobs (freelancer is selected)
          supabase
            .from("job_requests")
            .select("*")
            .eq("selected_freelancer_id", user.id)
            .in("status", ["locked", "active"])
            .order("created_at", { ascending: false }),
            
          // 2. Latest conversation
          supabase
            .from("conversations")
            .select("id, client_id")
            .eq("freelancer_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
            
          // 3. Invitations
          supabase
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
            .limit(3),
            
          // 4. My Posted Requests
          supabase
            .from("job_requests")
            .select("*")
            .eq("client_id", user.id)
            .in("status", ["ready", "notifying", "confirmations_closed"])
            .order("created_at", { ascending: false })
            .limit(3),

          // 5. Earnings Today
          supabase
            .from("payments")
            .select("total_amount")
            .eq("freelancer_id", user.id)
            .gte("created_at", new Date().toISOString().split('T')[0]),

          // 6. Recent Messages (last 3 conversations)
          supabase
            .from("conversations")
            .select(`
              id, 
              client_id, 
              created_at,
              messages (
                body, 
                created_at,
                sender_id
              ),
              profiles:client_id (
                full_name,
                photo_url
              )
            `)
            .eq("freelancer_id", user.id)
            .order("created_at", { ascending: false })
            .limit(3)
        ]);

        const earningsSum = (earningsTodayRes.data || []).reduce((acc: number, curr: any) => acc + Number(curr.total_amount), 0);
        setEarningsToday(earningsSum);

        const processedMessages = (recentMessagesRes.data || []).map((conv: any) => {
          const lastMsg = conv.messages?.sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0];
          
          return {
            id: conv.id,
            otherName: conv.profiles?.full_name || "Client",
            otherPhoto: conv.profiles?.photo_url || null,
            lastMessage: lastMsg?.body || "No messages yet",
            lastMessageTime: lastMsg?.created_at || conv.created_at,
            isUnread: lastMsg ? lastMsg.sender_id !== user.id : false, // Simplistic unread check
          };
        });
        setRecentMessages(processedMessages);

        const activeJobsList = activeJobsRes.data || [];
        setActiveJobs(activeJobsList);
        
        let profileMap: Record<string, ClientProfile> = {};
        let conversationMap: Record<string, string> = {};
        if (activeJobsList.length > 0) {
          const clientIds = Array.from(new Set(activeJobsList.map((j: any) => j.client_id)));
          const jobIds = activeJobsList.map((j: any) => j.id);

          const [profRes, convRes, fallbackConvRes] = await Promise.all([
            supabase
              .from("profiles")
              .select("id, full_name, photo_url, average_rating, total_ratings")
              .in("id", clientIds),
            supabase
              .from("conversations")
              .select("id, job_id, client_id")
              .in("job_id", jobIds),
            supabase
              .from("conversations")
              .select("id, client_id, freelancer_id")
              .eq("freelancer_id", user.id)
              .in("client_id", clientIds)
          ]);
          
          profRes.data?.forEach(p => { profileMap[p.id] = p; });
          
          activeJobsList.forEach((job: any) => {
            const conv = convRes.data?.find(c => c.job_id === job.id);
            if (conv) {
              conversationMap[job.id] = conv.id;
            } else {
              const fallback = fallbackConvRes.data?.find(c => c.client_id === job.client_id);
              if (fallback) {
                 conversationMap[job.id] = fallback.id;
              }
            }
          });
          setClientProfiles(profileMap);
          setActiveConversationIds(conversationMap);
        }

        // Process latest conversation dependencies
        const latestConv = latestConvRes.data;
        if (latestConv) {
          // No need to process latestConv separately anymore, recentMessages handles it
        }

        // Process invitations and my posted requests
        const myRequestsList = myPostedRes.data || [];
        setMyRequests(myRequestsList);
        
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

        // Fetch own rating if not in profile
        const { data: myProf } = await supabase
          .from("profiles")
          .select("average_rating, total_ratings")
          .eq("id", user.id)
          .single();

        // Update cache
        const cacheKey = `freelancer_dashboard_cache_${user.id}`;
        localStorage.setItem(cacheKey, JSON.stringify({
          timestamp: Date.now(),
          data: {
            activeJobs: activeJobsList,
            clientProfiles: profileMap,
            activeConversationIds: conversationMap,
            invitations: mappedInvitations,
            myRequests: myRequestsList,
            earningsToday: earningsSum,
            recentMessages: processedMessages,
            myRating: myProf
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
            Here's what's happening with your jobs today.
          </p>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card 
            className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl cursor-pointer hover:bg-slate-50 transition-all active:scale-[0.98]"
            onClick={() => navigate("/freelancer/active-jobs")}
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
            onClick={() => navigate("/freelancer/active-jobs?tab=requests")}
          >
            <CardContent className="p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-bold uppercase tracking-wider">Requests</span>
                <Bell className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-orange-500">{invitations.length}</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl">
            <CardContent className="p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-bold uppercase tracking-wider">Earnings Today</span>
                <span className="text-xs font-bold">₪</span>
              </div>
              <p className="text-2xl font-bold text-foreground">₪{earningsToday}</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl">
            <CardContent className="p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-bold uppercase tracking-wider">Avg Rating</span>
                <StarRating rating={1} size="sm" showCount={false} />
              </div>
              <div className="flex items-baseline gap-1">
                <p className="text-2xl font-bold text-foreground">{(profile as any)?.average_rating || "0.0"}</p>
                <span className="text-[10px] text-muted-foreground">/ 5.0</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* PRO-LEVEL ACTIVE JOB SECTION */}
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
                    full_name: clientProfiles[job.client_id]?.full_name || "Client",
                    photo_url: clientProfiles[job.client_id]?.photo_url || undefined,
                    average_rating: clientProfiles[job.client_id]?.average_rating,
                    total_ratings: clientProfiles[job.client_id]?.total_ratings
                  }}
                  onMapClick={() => setSelectedMapJob(job)}
                  onChatClick={() => activeConversationIds[job.id] ? navigate(`/chat/${activeConversationIds[job.id]}`) : navigate("/messages")}
                  onDetailsClick={() => navigate(`/jobs/${job.id}/details`)}
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

        {/* Enhanced Messages List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              MESSAGES
            </h2>
            <Button variant="ghost" size="sm" className="text-xs font-bold text-primary">View All</Button>
          </div>
          
          <div className="space-y-3">
            {recentMessages.length > 0 ? recentMessages.map((msg) => (
              <Card key={msg.id} className="border-none shadow-[0_4px_15px_rgba(0,0,0,0.02)] rounded-2xl overflow-hidden hover:bg-slate-50 transition-colors cursor-pointer group"
                onClick={() => navigate(`/chat/${msg.id}`)}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="w-12 h-12 shadow-sm flex-shrink-0">
                      <AvatarImage src={msg.otherPhoto || undefined} className="object-cover" />
                      <AvatarFallback className="bg-primary/5 text-primary font-bold">
                        {msg.otherName?.charAt(0).toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    {msg.isUnread && (
                      <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-orange-500 border-2 border-white dark:border-zinc-900 rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="font-bold text-sm">{msg.otherName}</p>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {msg.lastMessageTime ? new Date(msg.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <p className={cn("text-xs truncate", msg.isUnread ? "font-bold text-foreground" : "text-muted-foreground")}>
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
                </CardContent>
              </Card>
            )) : (
              <p className="text-center text-muted-foreground py-8 text-sm italic">No recent messages</p>
            )}
          </div>
        </div>

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
                {/* Toggle - Smaller & Built-in */}
                <div className="flex items-center justify-center gap-1.5 p-1 bg-black/5 dark:bg-white/5 rounded-xl w-fit mx-auto">
                  <button
                    onClick={() => setRequestsTab("invitations")}
                    className={cn("flex items-center justify-center gap-1.5 py-1 px-4 rounded-lg text-[10px] font-bold transition-all",
                      requestsTab === "invitations"
                        ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white")}
                  >
                    <Bell className="w-3 h-3" /> Invitations
                  </button>
                  <button
                    onClick={() => setRequestsTab("my")}
                    className={cn("flex items-center justify-center gap-1.5 py-1 px-4 rounded-lg text-[10px] font-bold transition-all",
                      requestsTab === "my"
                        ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white")}
                  >
                    <Briefcase className="w-3 h-3" /> My Requests
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
                          {isDeclined ? "Declined" : isConfirmed ? "Waiting for confirmation" : "Pending"}
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

        <FullscreenMapModal 
          job={selectedMapJob} 
          isOpen={!!selectedMapJob} 
          onClose={() => setSelectedMapJob(null)} 
        />
      </div>
    </div>
  );
}
