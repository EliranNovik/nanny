import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Briefcase, 
  Users, 
  BarChart3, 
  MessageSquare, 
  CheckCircle2,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { getJobStageBadge } from "@/lib/jobStages";

interface Job {
  id: string;
  status: string;
  stage: string | null;
  care_type: string;
  children_count: number;
  children_age_group: string;
  location_city: string;
  start_at: string | null;
  created_at: string;
  client_id: string;
  selected_freelancer_id: string | null;
  client?: {
    full_name: string | null;
    photo_url: string | null;
  };
  freelancer?: {
    full_name: string | null;
    photo_url: string | null;
  };
}

interface UserProfile {
  id: string;
  role: "client" | "freelancer";
  is_admin?: boolean;
  full_name: string | null;
  city: string | null;
  phone: string | null;
  photo_url: string | null;
  created_at: string;
}

interface ReportConversation {
  id: string;
  client_id: string;
  freelancer_id: string;
  created_at: string;
  last_message?: {
    body: string;
    created_at: string;
  };
  unread_count: number;
  client?: UserProfile;
}

interface Statistics {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  requestedJobs: number;
  totalUsers: number;
  totalClients: number;
  totalFreelancers: number;
  jobsThisWeek: number;
  jobsLastWeek: number;
}

export default function AdminPage() {
  const { profile, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("jobs");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<ReportConversation[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for auth to finish loading before checking
    if (authLoading) {
      return;
    }

    // If no profile or not admin, redirect
    if (!profile || !profile.is_admin) {
      navigate("/");
      return;
    }

    // Only fetch data if we have a user and confirmed admin access
    if (user && profile.is_admin) {
      fetchAllData();
    }
  }, [profile, authLoading, navigate, user]);

  async function fetchAllData() {
    if (!user) return;
    
    setLoading(true);
    try {
      await Promise.all([
        fetchJobs(),
        fetchUsers(),
        fetchReports(),
        fetchStatistics()
      ]);
    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchJobs() {
    const { data, error } = await supabase
      .from("job_requests")
      .select(`
        *,
        client:profiles!job_requests_client_id_fkey(id, full_name, photo_url),
        freelancer:profiles!job_requests_selected_freelancer_id_fkey(id, full_name, photo_url)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching jobs:", error);
      return;
    }

    setJobs(data || []);
  }

  async function fetchUsers() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching users:", error);
      return;
    }

    setUsers(data || []);
  }

  async function fetchReports() {
    if (!user) return;

    // Fetch conversations where job_id is null (admin reports)
    const { data: conversations, error: convError } = await supabase
      .from("conversations")
      .select(`
        *,
        client:profiles!conversations_client_id_fkey(*)
      `)
      .is("job_id", null)
      .order("created_at", { ascending: false });

    if (convError) {
      console.error("Error fetching reports:", convError);
      return;
    }

    // Fetch last message and unread count for each conversation
    const reportsWithMessages = await Promise.all(
      (conversations || []).map(async (conv) => {
        const { data: messages } = await supabase
          .from("messages")
          .select("body, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .is("read_at", null)
          .neq("sender_id", user.id);

        return {
          ...conv,
          last_message: messages || undefined,
          unread_count: count || 0,
        };
      })
    );

    setReports(reportsWithMessages);
  }

  async function fetchStatistics() {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Total jobs
    const { count: totalJobs } = await supabase
      .from("job_requests")
      .select("*", { count: "exact", head: true });

    // Active jobs
    const { count: activeJobs } = await supabase
      .from("job_requests")
      .select("*", { count: "exact", head: true })
      .in("status", ["locked", "active"]);

    // Completed jobs
    const { count: completedJobs } = await supabase
      .from("job_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed");

    // Requested jobs (notifying, confirmations_closed)
    const { count: requestedJobs } = await supabase
      .from("job_requests")
      .select("*", { count: "exact", head: true })
      .in("status", ["notifying", "confirmations_closed"]);

    // Total users (excluding admins from count)
    const { count: totalUsers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .or("is_admin.is.null,is_admin.eq.false");

    // Total clients (excluding admins)
    const { count: totalClients } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "client")
      .or("is_admin.is.null,is_admin.eq.false");

    // Total freelancers (excluding admins)
    const { count: totalFreelancers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "freelancer")
      .or("is_admin.is.null,is_admin.eq.false");

    // Jobs this week
    const { count: jobsThisWeek } = await supabase
      .from("job_requests")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekAgo.toISOString());

    // Jobs last week
    const { count: jobsLastWeek } = await supabase
      .from("job_requests")
      .select("*", { count: "exact", head: true })
      .gte("created_at", twoWeeksAgo.toISOString())
      .lt("created_at", weekAgo.toISOString());

    setStatistics({
      totalJobs: totalJobs || 0,
      activeJobs: activeJobs || 0,
      completedJobs: completedJobs || 0,
      requestedJobs: requestedJobs || 0,
      totalUsers: totalUsers || 0,
      totalClients: totalClients || 0,
      totalFreelancers: totalFreelancers || 0,
      jobsThisWeek: jobsThisWeek || 0,
      jobsLastWeek: jobsLastWeek || 0,
    });
  }

  const activeJobs = jobs.filter(j => j.status === "locked" || j.status === "active");
  const requestedJobs = jobs.filter(j => j.status === "notifying" || j.status === "confirmations_closed");
  const completedJobs = jobs.filter(j => j.status === "completed");

  // Show loading while auth is loading or data is loading
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32 md:pb-24">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage jobs, users, and reports</p>
        </div>

        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.totalJobs}</div>
                <p className="text-xs text-muted-foreground">
                  {statistics.jobsThisWeek} this week
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.activeJobs}</div>
                <p className="text-xs text-muted-foreground">
                  Currently in progress
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.totalUsers}</div>
                <p className="text-xs text-muted-foreground">
                  {statistics.totalClients} clients, {statistics.totalFreelancers} freelancers
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Reports</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reports.length}</div>
                <p className="text-xs text-muted-foreground">
                  User reports
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="jobs">
              <Briefcase className="w-4 h-4 mr-2" />
              Jobs
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="statistics">
              <BarChart3 className="w-4 h-4 mr-2" />
              Statistics
            </TabsTrigger>
            <TabsTrigger value="reports">
              <MessageSquare className="w-4 h-4 mr-2" />
              Reports
              {reports.filter(r => r.unread_count > 0).length > 0 && (
                <Badge className="ml-2" variant="destructive">
                  {reports.filter(r => r.unread_count > 0).length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="jobs" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Active Jobs */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    Active Jobs ({activeJobs.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
                  {activeJobs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active jobs</p>
                  ) : (
                    activeJobs.map((job) => {
                      const handleClick = async () => {
                        const { data: conv } = await supabase
                          .from("conversations")
                          .select("id")
                          .eq("job_id", job.id)
                          .maybeSingle();
                        if (conv) {
                          navigate(`/chat/${conv.id}`);
                        }
                      };
                      return (
                        <Card key={job.id} className="p-3 cursor-pointer hover:bg-muted/50" onClick={handleClick}>
                          <div className="flex items-start gap-2">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={job.client?.photo_url || undefined} />
                              <AvatarFallback>{job.client?.full_name?.[0] || "?"}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{job.client?.full_name || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">{job.location_city}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <Badge variant="outline" className="text-xs">{job.status}</Badge>
                                {job.stage && (
                                  <Badge variant={getJobStageBadge(job.stage).variant} className="text-xs">
                                    {getJobStageBadge(job.stage).label}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              {/* Requested Jobs */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" />
                    Requested Jobs ({requestedJobs.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
                  {requestedJobs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No requested jobs</p>
                  ) : (
                    requestedJobs.map((job) => (
                      <Card key={job.id} className="p-3 cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/client/jobs/${job.id}/confirmed`)}>
                        <div className="flex items-start gap-2">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={job.client?.photo_url || undefined} />
                            <AvatarFallback>{job.client?.full_name?.[0] || "?"}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{job.client?.full_name || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">{job.location_city}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant="outline" className="text-xs">{job.status}</Badge>
                              {job.stage && (
                                <Badge variant={getJobStageBadge(job.stage).variant} className="text-xs">
                                  {getJobStageBadge(job.stage).label}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Completed Jobs */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-blue-500" />
                    Completed Jobs ({completedJobs.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
                  {completedJobs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No completed jobs</p>
                  ) : (
                    completedJobs.map((job) => (
                      <Card key={job.id} className="p-3">
                        <div className="flex items-start gap-2">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={job.client?.photo_url || undefined} />
                            <AvatarFallback>{job.client?.full_name?.[0] || "?"}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{job.client?.full_name || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">{job.location_city}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(job.created_at), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>All Users</CardTitle>
                <CardDescription>Clients and freelancers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {users.map((user) => (
                    <Card key={user.id} className="p-4">
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarImage src={user.photo_url || undefined} />
                          <AvatarFallback>
                            {user.full_name?.[0] || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{user.full_name || "Unnamed"}</p>
                            {user.is_admin ? (
                              <Badge variant="destructive">Admin</Badge>
                            ) : (
                              <Badge variant={user.role === "client" ? "default" : "secondary"}>
                                {user.role}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{user.city || "No location"}</p>
                          <p className="text-xs text-muted-foreground">
                            Joined {format(new Date(user.created_at), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="statistics" className="mt-6">
            {statistics && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Job Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Total Jobs</span>
                      <span className="font-bold">{statistics.totalJobs}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Active Jobs</span>
                      <span className="font-bold text-green-600">{statistics.activeJobs}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Completed Jobs</span>
                      <span className="font-bold text-blue-600">{statistics.completedJobs}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Requested Jobs</span>
                      <span className="font-bold text-amber-600">{statistics.requestedJobs}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>User Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Total Users</span>
                      <span className="font-bold">{statistics.totalUsers}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Clients</span>
                      <span className="font-bold">{statistics.totalClients}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Freelancers</span>
                      <span className="font-bold">{statistics.totalFreelancers}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>User Reports</CardTitle>
                <CardDescription>Issues reported by users</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {reports.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No reports yet</p>
                  ) : (
                    reports.map((report) => (
                      <Card 
                        key={report.id} 
                        className={`p-4 cursor-pointer hover:bg-muted/50 ${report.unread_count > 0 ? "border-primary" : ""}`}
                        onClick={() => navigate(`/chat/${report.id}`)}
                      >
                        <div className="flex items-start gap-4">
                          <Avatar>
                            <AvatarImage src={report.client?.photo_url || undefined} />
                            <AvatarFallback>
                              {report.client?.full_name?.[0] || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{report.client?.full_name || "Unknown User"}</p>
                              {report.unread_count > 0 && (
                                <Badge variant="destructive">{report.unread_count}</Badge>
                              )}
                            </div>
                            {report.last_message && (
                              <p className="text-sm text-muted-foreground mt-1 truncate">
                                {report.last_message.body}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(report.created_at), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

