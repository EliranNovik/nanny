import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { apiPost } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Bell, 
  Clock, 
  MapPin, 
  Baby, 
  DollarSign,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  Trash2,
  MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";

interface JobRequest {
  id: string;
  care_type: string;
  children_count: number;
  children_age_group: string;
  location_city: string;
  shift_hours: string;
  budget_min: number | null;
  budget_max: number | null;
  requirements: string[];
  confirm_ends_at: string;
}

interface Notification {
  id: string;
  job_id: string;
  status: string;
  created_at: string;
  job_requests: JobRequest;
  isConfirmed?: boolean; // Added to track if freelancer has confirmed
  isDeclined?: boolean; // Added to track if client declined the confirmation
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [openJobAcceptModalOpen, setOpenJobAcceptModalOpen] = useState(false);
  const [openJobAcceptJobId, setOpenJobAcceptJobId] = useState<string | null>(null);
  const [openJobAcceptNotifId, setOpenJobAcceptNotifId] = useState<string | null>(null);
  const [openJobAcceptNote, setOpenJobAcceptNote] = useState("");
  const [acceptingOpenJob, setAcceptingOpenJob] = useState(false);
  const previousNotificationIdsRef = useRef<Set<string>>(new Set());

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      console.log("[NotificationsPage] Fetching notifications for user", user.id);
      
      // Fetch notifications
      const { data: notificationsData, error: notifError } = await supabase
        .from("job_candidate_notifications")
        .select(`
          id,
          job_id,
          status,
          created_at,
          job_requests (
            id,
            care_type,
            children_count,
            children_age_group,
            location_city,
            shift_hours,
            budget_min,
            budget_max,
            requirements,
            confirm_ends_at
          )
        `)
        .eq("freelancer_id", user.id)
        .in("status", ["pending", "opened"])
        .order("created_at", { ascending: false });

      if (notifError) {
        console.error("[NotificationsPage] Error fetching notifications:", notifError);
        throw notifError;
      }

      // Fetch confirmations to check which jobs have been confirmed or declined
      const { data: confirmationsData } = await supabase
        .from("job_confirmations")
        .select("job_id, status")
        .eq("freelancer_id", user.id);

      const confirmedJobIds = new Set(
        (confirmationsData || [])
          .filter((c) => c.status === "available")
          .map((c) => c.job_id)
      );
      
      const declinedJobIds = new Set(
        (confirmationsData || [])
          .filter((c) => c.status === "declined")
          .map((c) => c.job_id)
      );

      console.log("[NotificationsPage] Loaded", (notificationsData || []).length, "notifications");
      console.log("[NotificationsPage] Found", confirmedJobIds.size, "confirmed jobs");
      
      // Filter out notifications where job_requests is null (RLS blocked)
      const validNotifications = (notificationsData || []).filter((notif: any) => {
        if (!notif.job_requests) {
          console.warn("[NotificationsPage] Notification", notif.id, "has null job_requests - RLS may be blocking");
          return false;
        }
        return true;
      });
      
      // Add confirmation status to each notification
      const enrichedNotifications = validNotifications.map((notif: any) => ({
        ...notif,
        isConfirmed: confirmedJobIds.has(notif.job_id),
        isDeclined: declinedJobIds.has(notif.job_id)
      }));
      
      console.log("[NotificationsPage] Valid notifications after filtering:", enrichedNotifications.length);
      
      // Check for new notifications and show toast
      const currentNotificationIds = new Set(enrichedNotifications.map((n: any) => n.id));
      const newNotifications = enrichedNotifications.filter((n: any) => 
        !previousNotificationIdsRef.current.has(n.id)
      );
      
      // Show toast for new notifications (but not on initial load)
      if (previousNotificationIdsRef.current.size > 0 && newNotifications.length > 0) {
        newNotifications.forEach((notif: any) => {
          const job = notif.job_requests;
          addToast({
            title: "New Job Request!",
            description: `${job?.location_city || "Location"} - ${job?.care_type || "Care"} needed`,
            variant: "info",
            duration: 5000,
            action: {
              label: "View Requests",
              onClick: () => {
                navigate("/freelancer/notifications");
              },
            },
          });
        });
      }
      
      previousNotificationIdsRef.current = currentNotificationIds;
      setNotifications((enrichedNotifications as unknown as Notification[]) || []);
    } catch (err) {
      console.error("[NotificationsPage] Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [user, addToast, navigate]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetchNotifications();

    // Subscribe to realtime updates for INSERT and UPDATE
    const notificationsChannel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen for INSERT, UPDATE, DELETE
          schema: "public",
          table: "job_candidate_notifications",
          filter: `freelancer_id=eq.${user.id}`,
        },
        () => {
          console.log("[NotificationsPage] Realtime update received, refetching...");
          // Re-fetch notifications when realtime update is received
          fetchNotifications();
        }
      )
      .subscribe();

    // Subscribe to job_confirmations to detect when client declines
    const confirmationsChannel = supabase
      .channel(`confirmations:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE", // Listen for UPDATE (when status changes to "declined")
          schema: "public",
          table: "job_confirmations",
          filter: `freelancer_id=eq.${user.id}`,
        },
        () => {
          console.log("[NotificationsPage] Confirmation status changed, refetching...");
          // Re-fetch notifications to update declined status
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(confirmationsChannel);
    };
  }, [user, fetchNotifications]);

  async function handleConfirm(jobId: string, notifId: string) {
    setConfirming(notifId);

    try {
      console.log("[NotificationsPage] Confirming availability for job", jobId);
      
      // Mark as opened first
      await apiPost(`/api/jobs/${jobId}/notifications/${notifId}/open`, {});
      console.log("[NotificationsPage] Notification marked as opened");
      
      // Then confirm availability
      await apiPost(`/api/jobs/${jobId}/confirm`, {});
      console.log("[NotificationsPage] Availability confirmed successfully");

      // Update local state optimistically
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notifId ? { ...n, isConfirmed: true } : n
        )
      );
      
      // Refresh to get latest data
      fetchNotifications();
    } catch (err: any) {
      console.error("[NotificationsPage] Error confirming availability:", err);
      alert(err?.message || "Failed to confirm availability. Please try again.");
    } finally {
      setConfirming(null);
    }
  }

  function openOpenJobAcceptModal(jobId: string, notifId: string) {
    setOpenJobAcceptJobId(jobId);
    setOpenJobAcceptNotifId(notifId);
    setOpenJobAcceptNote("");
    setOpenJobAcceptModalOpen(true);
  }

  async function handleAcceptOpenJob() {
    if (!openJobAcceptJobId || !openJobAcceptNotifId || !openJobAcceptNote.trim()) {
      addToast({
        title: "Note required",
        description: "Please add a note explaining why you're interested in this open job.",
        variant: "error",
        duration: 3000,
      });
      return;
    }

    setAcceptingOpenJob(true);

    try {
      console.log("[NotificationsPage] Accepting open job request", openJobAcceptJobId);
      
      // Mark as opened first
      await apiPost(`/api/jobs/${openJobAcceptJobId}/notifications/${openJobAcceptNotifId}/open`, {});
      
      // Accept open job request with note
      await apiPost(`/api/jobs/${openJobAcceptJobId}/accept-open-job`, {
        note: openJobAcceptNote.trim(),
      });

      console.log("[NotificationsPage] Open job request accepted successfully");

      // Update local state
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === openJobAcceptNotifId ? { ...n, isConfirmed: true } : n
        )
      );

      addToast({
        title: "Request accepted",
        description: "Your note has been sent to the client. They can now review your response.",
        variant: "success",
        duration: 5000,
      });

      setOpenJobAcceptModalOpen(false);
      setOpenJobAcceptJobId(null);
      setOpenJobAcceptNotifId(null);
      setOpenJobAcceptNote("");
      
      // Refresh to get latest data
      fetchNotifications();
    } catch (err: any) {
      console.error("[NotificationsPage] Error accepting open job request:", err);
      addToast({
        title: "Failed to accept",
        description: err?.message || "Could not accept the request. Please try again.",
        variant: "error",
        duration: 5000,
      });
    } finally {
      setAcceptingOpenJob(false);
    }
  }

  async function handleDelete(notifId: string) {
    setDeleting(notifId);

    try {
      console.log("[NotificationsPage] Deleting notification", notifId);
      
      const { error } = await supabase
        .from("job_candidate_notifications")
        .delete()
        .eq("id", notifId);

      if (error) {
        throw error;
      }

      console.log("[NotificationsPage] Notification deleted successfully");

      // Remove from local state
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
      
      // Update previous notification IDs ref
      previousNotificationIdsRef.current.delete(notifId);

      addToast({
        title: "Request deleted",
        description: "The expired request has been removed.",
        variant: "success",
        duration: 3000,
      });
    } catch (err: any) {
      console.error("[NotificationsPage] Error deleting notification:", err);
      addToast({
        title: "Failed to delete",
        description: err?.message || "Could not delete the request. Please try again.",
        variant: "error",
        duration: 5000,
      });
    } finally {
      setDeleting(null);
    }
  }

  function getTimeRemaining(endTime: string): { minutes: number; seconds: number; expired: boolean } {
    const end = new Date(endTime).getTime();
    const now = Date.now();
    const diff = end - now;

    if (diff <= 0) {
      return { minutes: 0, seconds: 0, expired: true };
    }

    return {
      minutes: Math.floor(diff / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
      expired: false,
    };
  }

  function formatCareType(type: string): string {
    const map: Record<string, string> = {
      occasional: "One-time",
      part_time: "Part-time",
      full_time: "Full-time",
    };
    return map[type] || type;
  }

  function formatAgeGroup(group: string): string {
    const map: Record<string, string> = {
      newborn: "Newborn (0-6 mo)",
      infant: "Infant (6-12 mo)",
      toddler: "Toddler (1-3 yr)",
      preschool: "Preschool (3-5 yr)",
      school_age: "School Age (5+)",
      mixed: "Mixed Ages",
    };
    return map[group] || group;
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
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="w-6 h-6 text-primary" />
              Job Requests
            </h1>
            <p className="text-muted-foreground">
              {notifications.length === 0 
                ? "No pending requests"
                : `${notifications.length} pending request${notifications.length > 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        <div className="space-y-4 animate-stagger">
          {notifications.map((notif) => {
            const job = notif.job_requests;
            const time = getTimeRemaining(job.confirm_ends_at);
            const isConfirmed = notif.isConfirmed || false;
            const isDeclined = notif.isDeclined || false;

            return (
              <Card 
                key={notif.id}
                className={cn(
                  "border-0 shadow-lg overflow-hidden transition-all",
                  isDeclined && "opacity-60"
                )}
              >
                <CardContent className="p-0">
                  {/* Timer Bar */}
                  <div className={cn(
                    "px-4 py-2 flex items-center justify-between",
                    isDeclined
                      ? "bg-red-500/10"
                      : time.expired 
                        ? "bg-muted" 
                        : isConfirmed 
                          ? "bg-emerald-500/10"
                          : "bg-primary/10"
                  )}>
                    <div className="flex items-center gap-2">
                      {isDeclined ? (
                        <>
                          <XCircle className="w-4 h-4 text-red-500" />
                          <span className="text-sm font-medium text-red-600">
                            Client Declined
                          </span>
                        </>
                      ) : (
                        <>
                          <Clock className={cn(
                            "w-4 h-4",
                            time.expired 
                              ? "text-muted-foreground" 
                              : isConfirmed
                                ? "text-emerald-500"
                                : "text-primary animate-pulse-soft"
                          )} />
                          <span className={cn(
                            "text-sm font-medium",
                            time.expired 
                              ? "text-muted-foreground" 
                              : isConfirmed
                                ? "text-emerald-600"
                                : "text-primary"
                          )}>
                            {time.expired 
                              ? "Expired" 
                              : isConfirmed
                                ? "Confirmed!"
                                : `${time.minutes}:${time.seconds.toString().padStart(2, "0")} left`}
                          </span>
                        </>
                      )}
                    </div>
                    <Badge variant={isDeclined ? "destructive" : time.expired ? "outline" : "default"}>
                      {formatCareType(job.care_type)}
                    </Badge>
                  </div>

                  <div className="p-6 space-y-4">
                    {/* Job Details */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{job.location_city}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Baby className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">
                          {job.children_count} child{job.children_count > 1 ? "ren" : ""}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Age: {formatAgeGroup(job.children_age_group)}</span>
                    </div>

                    {(job.budget_min || job.budget_max) && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">
                          {job.budget_min && job.budget_max 
                            ? `₪${job.budget_min}-${job.budget_max}/hr`
                            : job.budget_min
                              ? `From ₪${job.budget_min}/hr`
                              : `Up to ₪${job.budget_max}/hr`}
                        </span>
                      </div>
                    )}

                    {/* Requirements */}
                    {job.requirements.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {job.requirements.includes("first_aid") && (
                          <Badge variant="secondary">🩹 First Aid Required</Badge>
                        )}
                        {job.requirements.includes("newborn") && (
                          <Badge variant="secondary">👶 Newborn Exp. Required</Badge>
                        )}
                        {job.requirements.includes("special_needs") && (
                          <Badge variant="secondary">💜 Special Needs Required</Badge>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    {isDeclined && (
                      <div className="flex flex-col items-center gap-2 py-2">
                        <div className="flex items-center justify-center gap-2 text-red-600">
                          <XCircle className="w-5 h-5" />
                          <span className="font-medium">Client declined your confirmation</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(notif.id)}
                          disabled={deleting === notif.id}
                          className="w-full"
                        >
                          {deleting === notif.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remove Request
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {!isDeclined && !time.expired && !isConfirmed && (
                      <Button
                        className="w-full"
                        size="lg"
                        onClick={() => handleConfirm(job.id, notif.id)}
                        disabled={confirming === notif.id}
                      >
                        {confirming === notif.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                        )}
                        I'm Available!
                      </Button>
                    )}

                    {!isDeclined && isConfirmed && (
                      <div className="flex items-center justify-center gap-2 text-emerald-600 py-2">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-medium">You confirmed availability</span>
                      </div>
                    )}

                    {time.expired && !isConfirmed && !isDeclined && (
                      <div className="flex flex-col items-center gap-3 py-2">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <XCircle className="w-5 h-5" />
                          <span>Open Job</span>
                        </div>
                        <div className="w-full space-y-2">
                          <Button
                            size="sm"
                            onClick={() => openOpenJobAcceptModal(job.id, notif.id)}
                            disabled={acceptingOpenJob}
                            className="w-full"
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Accept Open Job
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(notif.id)}
                            disabled={deleting === notif.id}
                            className="w-full"
                          >
                            {deleting === notif.id ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Remove Request
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Empty State */}
          {notifications.length === 0 && (
            <Card className="border-0 shadow-lg text-center py-12">
              <CardContent>
                <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                  <Bell className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">No Job Requests</h3>
                <p className="text-muted-foreground mb-4">
                  Make sure you're set as "Available" in your profile to receive requests.
                </p>
                <Button onClick={() => navigate("/freelancer/profile")}>
                  Update Profile
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Open Job Acceptance Modal */}
      <Dialog open={openJobAcceptModalOpen} onOpenChange={setOpenJobAcceptModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept Open Job</DialogTitle>
            <DialogDescription>
              The confirmation window has closed, but this job is still open. Express your interest by adding a note to the client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Add a note (required)
              </label>
              <Textarea
                placeholder="Explain why you're interested in this open job..."
                value={openJobAcceptNote}
                onChange={(e) => setOpenJobAcceptNote(e.target.value)}
                rows={4}
                maxLength={500}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {openJobAcceptNote.length}/500 characters
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setOpenJobAcceptModalOpen(false);
                  setOpenJobAcceptNote("");
                }}
                disabled={acceptingOpenJob}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAcceptOpenJob}
                disabled={acceptingOpenJob || !openJobAcceptNote.trim()}
              >
                {acceptingOpenJob ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Send Note
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

