import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  MessageCircle,
  Bell,
  Briefcase,
  MapPin,
  Edit,
  Loader2,
  ArrowRight,
  Calendar as CalendarIcon,
  Clock,
  Baby,
  ChevronRight,
  Calendar
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
  created_at: string;
}

interface Conversation {
  id: string;
  job_id: string;
  client_id: string;
  created_at: string;
  client_profile?: {
    full_name: string | null;
    photo_url: string | null;
  };
  last_message?: {
    body: string;
    created_at: string;
  };
}

interface Notification {
  id: string;
  job_id: string;
  status: string;
  created_at: string;
  job_requests: JobRequest | JobRequest[];
}

interface NextAppointment extends JobRequest {
  client_profile?: {
    full_name: string | null;
    photo_url: string | null;
  };
}

export default function FreelancerDashboardPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  
  // Try to load cached data immediately for instant rendering
  const getCachedDashboardData = () => {
    try {
      const cached = localStorage.getItem(`freelancer_dashboard_${user?.id}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Use cache if less than 30 seconds old
        if (parsed.timestamp && Date.now() - parsed.timestamp < 30000) {
          return parsed.data;
        }
      }
    } catch (e) {
      // Ignore cache errors
    }
    return null;
  };

  const cachedData = user ? getCachedDashboardData() : null;
  const [loading, setLoading] = useState(!cachedData); // Only show loading if no cache
  const [activeJobs, setActiveJobs] = useState<JobRequest[]>(cachedData?.activeJobs || []);
  const [lastConversation, setLastConversation] = useState<Conversation | null>(cachedData?.lastConversation || null);
  const [recentNotifications, setRecentNotifications] = useState<Notification[]>(cachedData?.recentNotifications || []);
  const [nextAppointment, setNextAppointment] = useState<NextAppointment | null>(cachedData?.nextAppointment || null);

  useEffect(() => {
    async function loadDashboard() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Fetch active jobs
        const { data: jobs } = await supabase
          .from("job_requests")
          .select("*")
          .eq("selected_freelancer_id", user.id)
          .in("status", ["locked", "active"])
          .order("created_at", { ascending: false });

        setActiveJobs(jobs || []);

        // Fetch last conversation
        const { data: conversations } = await supabase
          .from("conversations")
          .select("id, job_id, client_id, created_at")
          .eq("freelancer_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let clientProfile: any = null;
        let lastMessage: any = null;
        if (conversations) {
          // Fetch client profile
          const { data: clientProfileData } = await supabase
            .from("profiles")
            .select("id, full_name, photo_url")
            .eq("id", conversations.client_id)
            .single();

          clientProfile = clientProfileData;

          // Fetch last message
          const { data: lastMessageData } = await supabase
            .from("messages")
            .select("body, created_at")
            .eq("conversation_id", conversations.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          lastMessage = lastMessageData;

          setLastConversation({
            ...conversations,
            client_profile: clientProfile || {
              full_name: null,
              photo_url: null,
            },
            last_message: lastMessage || undefined,
          });
        }

        // Fetch latest notifications (last 5) - same as Requests tab
        const { data: notifications } = await supabase
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
              confirm_ends_at,
              start_at,
              created_at
            )
          `)
          .eq("freelancer_id", user.id)
          .in("status", ["pending", "opened"])
          .order("created_at", { ascending: false })
          .limit(5);

        // Map notifications to match the interface
        const mappedNotifications: Notification[] = (notifications || []).map((n: any) => ({
          id: n.id,
          job_id: n.job_id,
          status: n.status,
          created_at: n.created_at,
          job_requests: Array.isArray(n.job_requests) ? n.job_requests[0] : n.job_requests
        }));
        setRecentNotifications(mappedNotifications);


        // Fetch next scheduled appointment (earliest future appointment)
        const now = new Date().toISOString();
        const { data: scheduledJobs } = await supabase
          .from("job_requests")
          .select("*")
          .eq("selected_freelancer_id", user.id)
          .in("status", ["locked", "active"])
          .not("start_at", "is", null)
          .gte("start_at", now)
          .order("start_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        let scheduledClientProfile: any = null;
        if (scheduledJobs) {
          // Fetch client profile
          const { data: scheduledClientProfileData } = await supabase
            .from("profiles")
            .select("id, full_name, photo_url")
            .eq("id", scheduledJobs.client_id)
            .single();

          scheduledClientProfile = scheduledClientProfileData;

          setNextAppointment({
            ...scheduledJobs,
            client_profile: scheduledClientProfile || {
              full_name: null,
              photo_url: null,
            },
          });
        } else {
          setNextAppointment(null);
        }

        // Cache the dashboard data for instant loading next time
        if (user) {
          try {
            const cachedLastConversation = conversations ? {
              ...conversations,
              client_profile: clientProfile || { full_name: null, photo_url: null },
              last_message: lastMessage || undefined,
            } : null;

            const cachedNextAppt = scheduledJobs ? {
              ...scheduledJobs,
              client_profile: scheduledClientProfile || { full_name: null, photo_url: null },
            } : null;

            localStorage.setItem(`freelancer_dashboard_${user.id}`, JSON.stringify({
              timestamp: Date.now(),
              data: {
                activeJobs: jobs || [],
                lastConversation: cachedLastConversation,
                recentNotifications: mappedNotifications,
                nextAppointment: cachedNextAppt
              }
            }));
          } catch (e) {
            // Ignore cache errors
          }
        }
      } catch (err) {
        console.error("Error loading dashboard:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [user]);

  // Update cache whenever dashboard data changes (from real-time updates or initial load)
  useEffect(() => {
    if (user && (activeJobs.length >= 0 || lastConversation !== null || recentNotifications.length >= 0)) {
      try {
        localStorage.setItem(`freelancer_dashboard_${user.id}`, JSON.stringify({
          timestamp: Date.now(),
          data: {
            activeJobs,
            lastConversation,
            recentNotifications,
            nextAppointment
          }
        }));
      } catch (e) {
        // Ignore cache errors
      }
    }
  }, [activeJobs, lastConversation, recentNotifications, nextAppointment, user]);

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

  function formatJobTitle(job: JobRequest): string {
    return `${job.children_count} kid${job.children_count > 1 ? "s" : ""} (${formatAgeGroup(job.children_age_group)})`;
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
        {/* Logo */}
        <div className="text-center mb-6">
          <img 
            src="/ChatGPT Image Jan 19, 2026, 08_14_59 PM.png" 
            alt="MamaLama Logo" 
            className="h-16 w-auto mx-auto rounded-lg"
          />
        </div>

        {/* Profile Section */}
        <Card className="border-0 shadow-lg mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16 border-2 border-primary/20">
                <AvatarImage src={profile?.photo_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                  {profile?.full_name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold truncate">
                  {profile?.full_name || "Freelancer"}
                </h2>
                {profile?.city && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{profile.city}</span>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/freelancer/profile")}
                className="gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Active Jobs Section */}
        {activeJobs.length > 0 && (
          <Card className="border-0 shadow-lg mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-primary" />
                  Active Jobs
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/freelancer/active-jobs")}
                  className="gap-1"
                >
                  View All
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeJobs.slice(0, 2).map((job) => (
                <div
                  key={job.id}
                  className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate("/freelancer/active-jobs")}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">
                        {formatJobTitle(job)}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge
                          variant={getJobStageBadge(job.stage || "").variant}
                          className="text-xs"
                        >
                          {getJobStageBadge(job.stage || "").label}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {job.location_city}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Last Message Section */}
        {lastConversation && (
          <Card className="border-0 shadow-lg mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-primary" />
                  Last Message
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/chat/${lastConversation.id}`)}
                  className="gap-1"
                >
                  Open
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/chat/${lastConversation.id}`)}
              >
                <Avatar className="w-12 h-12 border-2 border-primary/20">
                  <AvatarImage
                    src={lastConversation.client_profile?.photo_url || undefined}
                  />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {lastConversation.client_profile?.full_name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm truncate">
                      {lastConversation.client_profile?.full_name || "Client"}
                    </span>
                    {lastConversation.last_message && (
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                        {new Date(
                          lastConversation.last_message.created_at
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                  {lastConversation.last_message ? (
                    <p className="text-sm text-muted-foreground truncate">
                      {lastConversation.last_message.body}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No messages yet
                    </p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Scheduled Appointment Section */}
        {nextAppointment && (
          <Card className="border-0 shadow-lg mb-6">
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
                  {nextAppointment.client_profile && (
                    <p className="text-sm text-muted-foreground">
                      Client: {nextAppointment.client_profile.full_name || "Unknown"}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-start gap-4 mb-2">
                  {nextAppointment.client_profile && (
                    <Avatar className="w-12 h-12 border-2 border-primary/20 flex-shrink-0">
                      <AvatarImage
                        src={nextAppointment.client_profile.photo_url || undefined}
                      />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {nextAppointment.client_profile.full_name
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
                        {formatJobTitle(nextAppointment)}
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

        {/* Latest Requests Section */}
        <Card className="border-0 shadow-lg mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                Latest Requests
              </CardTitle>
              {recentNotifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/freelancer/notifications")}
                  className="gap-1"
                >
                  View All
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentNotifications.length > 0 ? (
              recentNotifications.map((notif) => {
                const job = notif.job_requests as JobRequest;
                return (
                  <div
                    key={notif.id}
                    className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate("/freelancer/notifications")}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">
                          {formatJobTitle(job)}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {job.location_city}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Baby className="w-3 h-3" />
                            {formatAgeGroup(job.children_age_group)}
                          </span>
                          {job.start_at && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(job.start_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant={notif.status === "opened" ? "default" : "secondary"}
                        className="text-xs flex-shrink-0"
                      >
                        {notif.status === "opened" ? "Opened" : "New"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                      <Clock className="w-3 h-3" />
                      {new Date(notif.created_at).toLocaleString()}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground mb-4">
                  No new requests at the moment
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/freelancer/notifications")}
                >
                  View All Requests
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Empty States */}
        {activeJobs.length === 0 && !lastConversation && (
          <Card className="border-0 shadow-lg text-center py-12">
            <CardContent>
              <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                <Briefcase className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Welcome!</h3>
              <p className="text-muted-foreground mb-4">
                Complete your profile to start receiving job requests.
              </p>
              <Button onClick={() => navigate("/freelancer/profile/edit")}>
                Complete Profile
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
