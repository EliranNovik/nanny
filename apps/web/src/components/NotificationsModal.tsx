import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  fetchInboxActivityAlerts,
  type NotificationAlert,
} from "@/lib/inboxActivityAlerts";
import { rememberDismissedActivity } from "@/lib/inboxDismissedActivity";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bell,
  Briefcase,
  Loader2,
  MessageSquare,
  X,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export type { NotificationAlert } from "@/lib/inboxActivityAlerts";

interface NotificationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationsModal({
  open,
  onOpenChange,
}: NotificationsModalProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<NotificationAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const alertsRef = useRef<NotificationAlert[]>([]);
  alertsRef.current = alerts;

  const fetchAlerts = async (silent = false) => {
    if (!user || !profile) return;
    if (!silent) setLoading(true);

    try {
      const allAlerts = await fetchInboxActivityAlerts(user, profile, {
        includeUnreadMessageAlerts: true,
      });
      setAlerts(allAlerts);
    } catch (err) {
      console.error("Error fetching news:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void fetchAlerts();
    }
  }, [open, user?.id, profile?.role]);

  // Real-time updates for news feed
  useEffect(() => {
    if (!user || !profile) return;

    const channel = supabase
      .channel(`notifications-live:${user.id}`)
      // Job candidate notifications (for freelancers)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_candidate_notifications",
          filter: `freelancer_id=eq.${user.id}`,
        },
        () => void fetchAlerts(true)
      )
      // Job requests (for clients/freelancers)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_requests",
          filter: profile.role === "client" 
            ? `client_id=eq.${user.id}` 
            : `selected_freelancer_id=eq.${user.id}`,
        },
        () => void fetchAlerts(true)
      )
      // New messages
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => void fetchAlerts(true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, profile?.role]);

  const handleIgnore = async (alert: NotificationAlert) => {
    if (user?.id) rememberDismissedActivity(user.id, alert.id);

    try {
      if (alert.type === "message") {
        const conversation_id = alert.metadata?.conversation_id as
          | string
          | undefined;
        if (!conversation_id) return;
        await supabase
          .from("messages")
          .update({ read_at: new Date().toISOString() })
          .eq("conversation_id", conversation_id)
          .neq("sender_id", user?.id)
          .is("read_at", null);
      } else if (alert.type === "job_request") {
        await supabase
          .from("job_candidate_notifications")
          .update({ status: "closed" })
          .eq("id", alert.id);
      }
      /* confirmation + job_update + hire_interest: no safe status to set; inbox hides via rememberDismissedActivity */
    } catch (err) {
      console.error("Error ignoring notification:", err);
    } finally {
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
    }
  };

  const handleView = (alert: NotificationAlert) => {
    if (user?.id) rememberDismissedActivity(user.id, alert.id);
    onOpenChange(false);
    navigate(alert.link);
  };

  const handleDialogOpenChange = (next: boolean) => {
    if (!next && user?.id) {
      for (const a of alertsRef.current) {
        rememberDismissedActivity(user.id, a.id);
      }
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[440px] max-h-[85vh] flex flex-col p-0 gap-0 border-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] overflow-hidden rounded-[32px] ring-1 ring-black/5 dark:ring-white/10">
        <DialogHeader className="px-8 pt-8 pb-6 bg-transparent">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 dark:bg-orange-500/20 flex items-center justify-center shadow-sm ring-1 ring-orange-500/20">
                <Bell className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="space-y-0.5">
                <span className="block text-xl font-black tracking-tight text-zinc-950 dark:text-white">
                  Notifications
                </span>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                  <span className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                    Live Feed
                  </span>
                </div>
              </div>
            </div>
            {alerts.length > 0 && (
              <div className="bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[11px] font-black px-2.5 py-1 rounded-full shadow-lg">
                {alerts.length}
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-2">
          <div className="px-6 py-2 space-y-4">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => <NotificationSkeleton key={i} />)}
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center px-8">
                <div className="w-20 h-20 rounded-[32px] bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6 shadow-inner ring-1 ring-black/5 dark:ring-white/5">
                  <Sparkles className="w-10 h-10 text-zinc-300 dark:text-zinc-700" />
                </div>
                <h3 className="font-black text-xl text-zinc-950 dark:text-white mb-3">Quiet for now</h3>
                <p className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-[220px]">
                  New updates and messages will appear here as they happen.
                </p>
              </div>
            ) : (
              <div className="space-y-3 pb-8">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="group relative flex items-start gap-4 p-5 rounded-[24px] bg-white dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/50 hover:border-orange-500/30 hover:bg-orange-500/[0.03] transition-all duration-500 shadow-sm hover:shadow-xl hover:shadow-orange-500/5"
                  >
                    <div className="flex-shrink-0">
                      {alert.sender_photo ? (
                        <Avatar className="w-12 h-12 rounded-[18px] ring-2 ring-white dark:ring-zinc-900 shadow-md">
                          <AvatarImage
                            src={alert.sender_photo}
                            className="object-cover"
                          />
                          <AvatarFallback className="bg-zinc-100 dark:bg-zinc-800 text-zinc-400 text-sm font-black">
                            {alert.title.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div
                          className={cn(
                            "w-12 h-12 rounded-[18px] flex items-center justify-center shadow-sm ring-1 ring-inset",
                            alert.type === "message"
                              ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-100 dark:ring-blue-500/20"
                              : alert.type === "job_request"
                                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-100 dark:ring-emerald-500/20"
                                : alert.type === "job_comment"
                                  ? "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-rose-100 dark:ring-rose-500/20"
                                  : "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-orange-100 dark:ring-orange-500/20",
                          )}
                        >
                          {alert.type === "message" ? (
                            <MessageSquare className="w-6 h-6" />
                          ) : alert.type === "job_request" ? (
                            <Briefcase className="w-6 h-6" />
                          ) : alert.type === "job_comment" ? (
                            <MessageSquare className="w-6 h-6" />
                          ) : alert.type === "hire_interest" ? (
                            <Sparkles className="w-6 h-6" />
                          ) : (
                            <Briefcase className="w-6 h-6" />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <h4 className="text-[15px] font-black text-zinc-950 dark:text-white truncate tracking-tight">
                          {alert.title}
                        </h4>
                        <span className="text-[11px] font-bold text-zinc-400 tabular-nums shrink-0">
                          {alert.created_at
                            ? new Date(alert.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </span>
                      </div>
                      <p className="text-[13px] font-medium text-zinc-600 dark:text-zinc-400 leading-snug line-clamp-2 mb-4">
                        {alert.description}
                      </p>

                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleView(alert)}
                          size="sm"
                          className="h-9 px-5 rounded-xl text-[11px] font-black bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 border-0 shadow-lg shadow-black/10 dark:shadow-white/5 transition-all active:scale-[0.98]"
                        >
                          View Activity
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleIgnore(alert)}
                          className="h-9 w-9 rounded-xl text-zinc-400 hover:text-rose-500 hover:bg-rose-500/5 transition-colors ml-auto"
                        >
                          <X className="w-4.5 h-4.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="px-8 py-6 bg-zinc-50/50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800/50 flex items-center justify-between">
          <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.2em]">
            {alerts.length > 0 ? `${alerts.length} New Updates` : "Fully Updated"}
          </p>
          <button 
            onClick={() => {
              if (user?.id) {
                for (const a of alerts) rememberDismissedActivity(user.id, a.id);
                setAlerts([]);
              }
            }}
            className="text-[11px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all"
          >
            Clear All
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-muted/30 border border-transparent animate-pulse">
      <div className="w-11 h-11 rounded-xl bg-muted/50 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 bg-muted/60 rounded-md" />
          <div className="h-3 w-8 bg-muted/40 rounded-md" />
        </div>
        <div className="h-3 w-full bg-muted/40 rounded-md" />
        <div className="h-3 w-2/3 bg-muted/40 rounded-md" />
        <div className="flex gap-2 mt-3">
          <div className="h-8 w-24 bg-muted/50 rounded-xl" />
          <div className="h-8 w-8 bg-muted/50 rounded-xl ml-auto" />
        </div>
      </div>
    </div>
  );
}
