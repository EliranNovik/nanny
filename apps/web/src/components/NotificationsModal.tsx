import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    Bell, Briefcase, Loader2, MessageSquare, X, 
    Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export interface NotificationAlert {
  id: string;
  type: "job_request" | "confirmation" | "message" | "job_update";
  title: string;
  description?: string;
  link: string;
  created_at?: string;
  sender_name?: string;
  sender_photo?: string;
  metadata?: any;
}

interface NotificationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationsModal({ open, onOpenChange }: NotificationsModalProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<NotificationAlert[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAlerts = async () => {
    if (!user || !profile) return;
    setLoading(true);
    
    try {
      const allAlerts: NotificationAlert[] = [];

      // 1. Fetch Unread Messages
      const { data: convos } = await supabase
        .from("conversations")
        .select(`
          id, 
          client_id, 
          freelancer_id,
          job_id,
          job_requests (care_type)
        `)
        .or(`client_id.eq.${user.id},freelancer_id.eq.${user.id}`);

      if (convos && convos.length > 0) {
        const convoIds = convos.map(c => c.id);
        const { data: unreadMsgs } = await supabase
          .from("messages")
          .select("id, conversation_id, sender_id, body, created_at")
          .in("conversation_id", convoIds)
          .neq("sender_id", user.id)
          .is("read_at", null)
          .order("created_at", { ascending: false });

        if (unreadMsgs && unreadMsgs.length > 0) {
          // Group by conversation
          const latestByConvo = new Map();
          unreadMsgs.forEach(m => {
            if (!latestByConvo.has(m.conversation_id)) {
              latestByConvo.set(m.conversation_id, m);
            }
          });

          for (const [convoId, msg] of latestByConvo.entries()) {
            const convo = convos.find(c => c.id === convoId);
            if (!convo) continue;
            
            const otherId = user.id === convo.client_id ? convo.freelancer_id : convo.client_id;
            
            const { data: senderProfile } = await supabase
              .from("profiles")
              .select("full_name, photo_url")
              .eq("id", otherId)
              .single();

            allAlerts.push({
              id: `msg-${msg.id}`,
              type: "message",
              title: senderProfile?.full_name || "New Message",
              description: msg.body,
              link: `/chat/${convoId}`,
              created_at: msg.created_at,
              sender_name: senderProfile?.full_name || "User",
              sender_photo: senderProfile?.photo_url || undefined,
              metadata: { conversation_id: convoId, sender_id: otherId }
            });
          }
        }
      }

      // 2. Fetch Freelancer Job Requests
      if (profile.role === "freelancer") {
        const { data: notifications } = await supabase
          .from("job_candidate_notifications")
          .select(`
            id, created_at, job_id,
            job_requests (
              id, location_city, service_type, care_type, confirm_ends_at
            )
          `)
          .eq("freelancer_id", user.id)
          .in("status", ["pending", "opened"])
          .order("created_at", { ascending: false });

        if (notifications) {
          const now = new Date();
          notifications.forEach((n: any) => {
            const job = n.job_requests;
            if (job && (!job.confirm_ends_at || new Date(job.confirm_ends_at) > now)) {
              allAlerts.push({
                id: n.id,
                type: "job_request",
                title: `New ${job.care_type || job.service_type || "Job"} Request`,
                description: job.location_city ? `Location: ${job.location_city}` : "Check details",
                link: `/jobs?tab=requests`,
                created_at: n.created_at,
                metadata: { table: 'job_candidate_notifications', job_id: job.id }
              });
            }
          });
        }

        // 3. Fetch Live Job Updates for Freelancers (Confirmed)
        const { data: liveJobs } = await supabase
            .from("job_requests")
            .select("id, status, care_type, updated_at")
            .eq("selected_freelancer_id", user.id)
            .in("status", ["locked", "active"])
            .gte("updated_at", new Date(Date.now() - 48 * 60 * 60000).toISOString()) // Last 48h
            .order("updated_at", { ascending: false });

        if (liveJobs) {
            liveJobs.forEach((job) => {
                allAlerts.push({
                    id: `job-up-${job.id}`,
                    type: "job_update",
                    title: "Job Confirmed!",
                    description: `Your ${job.care_type || "job"} is ready to start.`,
                    link: `/jobs?tab=live`,
                    created_at: job.updated_at,
                    metadata: { job_id: job.id }
                });
            });
        }
      }

      // 4. Fetch Client Confirmations
      if (profile.role === "client") {
        const { data: jobs } = await supabase
          .from("job_requests")
          .select("id, care_type")
          .eq("client_id", user.id)
          .in("status", ["notifying", "confirmations_closed"]);

        if (jobs && jobs.length > 0) {
          const jobIds = jobs.map(j => j.id);
          const { data: confirmations } = await supabase
            .from("job_confirmations")
            .select(`
                id, created_at, job_id, freelancer_id,
                profiles (full_name, photo_url)
            `)
            .in("job_id", jobIds)
            .eq("status", "available");

          if (confirmations) {
            confirmations.forEach((c: any) => {
              allAlerts.push({
                id: c.id,
                type: "confirmation",
                title: "Helper Available",
                description: `${c.profiles?.full_name || "A helper"} responded to your request.`,
                link: `/jobs?tab=pending`,
                created_at: c.created_at,
                sender_name: c.profiles?.full_name,
                sender_photo: c.profiles?.photo_url,
                metadata: { table: 'job_confirmations', confirmation_id: c.id }
              });
            });
          }
        }
      }

      // Sort all by created_at
      allAlerts.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });

      setAlerts(allAlerts);
    } catch (err) {
      console.error("Error fetching news:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchAlerts();
  }, [open, user?.id]);

  const handleIgnore = async (alert: NotificationAlert) => {
    try {
      if (alert.type === "message") {
        const { conversation_id } = alert.metadata;
        await supabase
          .from("messages")
          .update({ read_at: new Date().toISOString() })
          .eq("conversation_id", conversation_id)
          .neq("sender_id", user?.id)
          .is("read_at", null);
      } else if (alert.type === "job_request") {
        await supabase
          .from("job_candidate_notifications")
          .update({ status: "ignored" })
          .eq("id", alert.id);
      } else if (alert.type === "confirmation") {
        await supabase
          .from("job_confirmations")
          .update({ status: "dismissed" })
          .eq("id", alert.id);
      }
      
      // Update local state
      setAlerts(prev => prev.filter(a => a.id !== alert.id));
    } catch (err) {
      console.error("Error ignoring notification:", err);
    }
  };

  const handleView = (alert: NotificationAlert) => {
    onOpenChange(false);
    navigate(alert.link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 border-none bg-slate-50 dark:bg-zinc-950 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden rounded-[32px]">
        <DialogHeader className="p-6 pb-4 bg-white dark:bg-zinc-900 border-b border-black/[0.03] dark:border-white/[0.03]">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                    <Bell className="w-5 h-5 text-orange-600" />
                </div>
                <span className="text-xl font-black tracking-tight">News & Activity</span>
            </div>
            {alerts.length > 0 && (
                <span className="px-3 py-1 bg-orange-500 text-white text-[10px] font-black rounded-full uppercase tracking-tighter">
                    {alerts.length} NEW
                </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Checking for updates...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-8">
              <div className="w-16 h-16 rounded-[24px] bg-slate-100 dark:bg-zinc-900 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-slate-300 dark:text-zinc-700" />
              </div>
              <h3 className="font-bold text-lg mb-1">Stay Tuned!</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Everything is up to date. We'll notify you here when something new happens.</p>
            </div>
          ) : (
            <div className="space-y-3 pb-6">
              {alerts.map((alert) => (
                <div 
                  key={alert.id}
                  className="group relative flex items-center gap-4 p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-black/[0.03] dark:border-white/[0.03] shadow-[0_4px_12px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="relative flex-shrink-0">
                    {alert.sender_photo ? (
                      <Avatar className="w-12 h-12 rounded-2xl border-2 border-white dark:border-zinc-800 shadow-md">
                        <AvatarImage src={alert.sender_photo} className="object-cover" />
                        <AvatarFallback className="bg-orange-50 text-orange-600 font-bold">
                          {alert.title.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shadow-md",
                        alert.type === 'message' ? "bg-blue-500/10 text-blue-600" :
                        alert.type === 'job_request' ? "bg-emerald-500/10 text-emerald-600" : "bg-orange-500/10 text-orange-600"
                      )}>
                        {alert.type === 'message' ? <MessageSquare className="w-6 h-6" /> :
                         alert.type === 'job_request' ? <Bell className="w-6 h-6" /> : <Briefcase className="w-6 h-6" />}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {alert.title}
                        </h4>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                            {alert.created_at ? new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                      {alert.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 ml-2">
                    <Button 
                      onClick={() => handleView(alert)}
                      size="sm"
                      className="h-9 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
                    >
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleIgnore(alert)}
                      className="h-9 w-9 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {alerts.length > 0 && (
            <div className="p-4 bg-white dark:bg-zinc-900 border-t border-black/[0.03] dark:border-white/[0.03] text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">End of news feed</p>
            </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
