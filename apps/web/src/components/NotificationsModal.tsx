import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Briefcase, Loader2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NotificationAlert {
  id: string;
  type: "job_request" | "confirmation" | "schedule";
  title: string;
  description?: string;
  link: string;
  created_at?: string;
}

interface NotificationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationsModal({ open, onOpenChange }: NotificationsModalProps) {
  const { user, profile } = useAuth();
  const [alerts, setAlerts] = useState<NotificationAlert[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user || !profile) {
      return;
    }

    let cancelled = false;

    async function fetchAlerts() {
      setLoading(true);
      try {
        if (profile.role === "freelancer") {
          const { data: notifications } = await supabase
            .from("job_candidate_notifications")
            .select(`
              id,
              created_at,
              job_requests (
                id,
                location_city,
                service_type,
                care_type,
                confirm_ends_at
              )
            `)
            .eq("freelancer_id", user.id)
            .in("status", ["pending", "opened"])
            .order("created_at", { ascending: false });

          if (cancelled) return;

          const now = new Date();
          const items: NotificationAlert[] = (notifications || [])
            .filter((n: any) => {
              const job = n.job_requests;
              if (!job?.confirm_ends_at) return false;
              return new Date(job.confirm_ends_at).getTime() > now.getTime();
            })
            .map((n: any) => {
              const job = n.job_requests;
              const label = job?.service_type || job?.care_type || "Job";
              return {
                id: n.id,
                type: "job_request" as const,
                title: `Job request: ${label}`,
                description: job?.location_city ? `${job.location_city}` : undefined,
                link: "/freelancer/notifications",
                created_at: n.created_at,
              };
            });
          setAlerts(items);
        } else if (profile.role === "client") {
          const { data: jobs } = await supabase
            .from("job_requests")
            .select("id")
            .eq("client_id", user.id)
            .in("status", ["notifying", "confirmations_closed"]);

          const jobIds = (jobs || []).map((j) => j.id);
          const items: NotificationAlert[] = [];

          if (jobIds.length > 0) {
            const { count } = await supabase
              .from("job_confirmations")
              .select("*", { count: "exact", head: true })
              .in("job_id", jobIds)
              .eq("status", "available");

            if (count && count > 0 && !cancelled) {
              items.push({
                id: "confirmations",
                type: "confirmation",
                title: "Confirmations pending",
                description: `${count} helper${count > 1 ? "s" : ""} waiting for your response`,
                link: "/client/active-jobs",
              });
            }
          }

          if (cancelled) return;

          setAlerts(items);
        } else {
          setAlerts([]);
        }
      } catch (err) {
        if (!cancelled) setAlerts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAlerts();
    return () => {
      cancelled = true;
    };
  }, [open, user, profile]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0 px-4 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No notifications right now.
            </p>
          ) : (
            <ul className="space-y-1">
              {alerts.map((alert) => (
                <li key={alert.id}>
                  <Link
                    to={alert.link}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg p-3 text-left",
                      "hover:bg-muted transition-colors"
                    )}
                  >
                    {alert.type === "job_request" && (
                      <Briefcase className="w-5 h-5 flex-shrink-0 text-primary mt-0.5" />
                    )}
                    {alert.type === "confirmation" && (
                      <Briefcase className="w-5 h-5 flex-shrink-0 text-primary mt-0.5" />
                    )}
                    {alert.type === "schedule" && (
                      <MessageSquare className="w-5 h-5 flex-shrink-0 text-primary mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{alert.title}</p>
                      {alert.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {alert.description}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
