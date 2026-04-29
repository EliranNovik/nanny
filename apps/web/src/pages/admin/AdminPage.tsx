import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Briefcase,
  Users,
  BarChart3,
  MessageSquare,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { getJobStageBadge } from "@/lib/jobStages";
import { apiGet, apiPost } from "@/lib/api";

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
  requirements?: string[];
  languages_pref?: string[];
  budget_min?: number | null;
  budget_max?: number | null;
  shift_hours?: string | null;
  confirm_starts_at?: string | null;
  confirm_ends_at?: string | null;
  notes?: string | null;
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
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);

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
      const data = await apiGet<{
        jobs: Job[];
        users: UserProfile[];
        reports: ReportConversation[];
        statistics: Statistics;
      }>("/api/admin/dashboard");

      setJobs(data.jobs);
      setUsers(data.users);
      setReports(data.reports);
      setStatistics(data.statistics);
    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setLoading(false);
    }
  }

  const openJobModal = (job: Job) => {
    setSelectedJob(job);
    setIsJobModalOpen(true);
  };

  async function handleUserAction(userId: string, action: "disconnect" | "delete") {
    const confirmationText =
      action === "delete"
        ? "Are you sure you want to COMPLETELY DELETE this user? This removes authentication logins and operational records permanently."
        : "Are you sure you want to DISCONNECT this user profile? Operational logs will purge, but core authentication credentials remain.";

    if (!window.confirm(confirmationText)) return;

    try {
      setLoading(true);
      const res = await apiPost<{ success: boolean; message?: string }>(
        `/api/admin/users/${userId}/action`,
        { action }
      );
      if (res.success) {
        fetchAllData();
      }
    } catch (err: any) {
      alert(`Administrative action failed: ${err.message || err}`);
      setLoading(false);
    }
  }



  const activeJobs = jobs.filter(
    (j) => j.status === "locked" || j.status === "active",
  );
  const requestedJobs = jobs.filter(
    (j) => j.status === "notifying" || j.status === "confirmations_closed",
  );
  const completedJobs = jobs.filter((j) => j.status === "completed");

  // Show loading while auth is loading or data is loading
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6 md:pb-8">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage jobs, users, and reports
          </p>
        </div>

        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Jobs
                </CardTitle>
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
                <CardTitle className="text-sm font-medium">
                  Active Jobs
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statistics.activeJobs}
                </div>
                <p className="text-xs text-muted-foreground">
                  Currently in progress
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Users
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statistics.totalUsers}
                </div>
                <p className="text-xs text-muted-foreground">
                  {statistics.totalClients} clients,{" "}
                  {statistics.totalFreelancers} freelancers
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
                <p className="text-xs text-muted-foreground">User reports</p>
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
              {reports.filter((r) => r.unread_count > 0).length > 0 && (
                <Badge className="ml-2" variant="destructive">
                  {reports.filter((r) => r.unread_count > 0).length}
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
                    <p className="text-sm text-muted-foreground">
                      No active jobs
                    </p>
                  ) : (
                    activeJobs.map((job) => (
                      <Card
                        key={job.id}
                        className="p-3 cursor-pointer hover:bg-muted/50"
                        onClick={() => openJobModal(job)}
                      >
                          <div className="flex items-start gap-2">
                            <Avatar className="w-8 h-8">
                              <AvatarImage
                                src={job.client?.photo_url || undefined}
                              />
                              <AvatarFallback>
                                {job.client?.full_name?.[0] || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {job.client?.full_name || "Unknown"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {job.location_city}
                              </p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <Badge variant="outline" className="text-xs">
                                  {job.status}
                                </Badge>
                                {job.stage && (
                                  <Badge
                                    variant={
                                      getJobStageBadge(job.stage).variant
                                    }
                                    className="text-xs"
                                  >
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
                    <p className="text-sm text-muted-foreground">
                      No requested jobs
                    </p>
                  ) : (
                    requestedJobs.map((job) => (
                      <Card
                        key={job.id}
                        className="p-3 cursor-pointer hover:bg-muted/50"
                        onClick={() => openJobModal(job)}
                      >
                        <div className="flex items-start gap-2">
                          <Avatar className="w-8 h-8">
                            <AvatarImage
                              src={job.client?.photo_url || undefined}
                            />
                            <AvatarFallback>
                              {job.client?.full_name?.[0] || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {job.client?.full_name || "Unknown"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {job.location_city}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {job.status}
                              </Badge>
                              {job.stage && (
                                <Badge
                                  variant={getJobStageBadge(job.stage).variant}
                                  className="text-xs"
                                >
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
                    <p className="text-sm text-muted-foreground">
                      No completed jobs
                    </p>
                  ) : (
                    completedJobs.map((job) => (
                      <Card 
                        key={job.id} 
                        className="p-3 cursor-pointer hover:bg-muted/50"
                        onClick={() => openJobModal(job)}
                      >
                        <div className="flex items-start gap-2">
                          <Avatar className="w-8 h-8">
                            <AvatarImage
                              src={job.client?.photo_url || undefined}
                            />
                            <AvatarFallback>
                              {job.client?.full_name?.[0] || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {job.client?.full_name || "Unknown"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {job.location_city}
                            </p>
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
            <Card className="border border-border/50 shadow-sm overflow-hidden rounded-xl bg-card">
              <CardHeader className="px-6 py-5 border-b border-border/50">
                <CardTitle className="text-xl font-bold">Comprehensive User Registry</CardTitle>
                <CardDescription className="text-zinc-500 dark:text-zinc-400">
                  Manage marketplace participants, active sessions, and access permissions.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 max-h-[600px] overflow-y-auto">
                {users.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    No active user data loaded.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm text-zinc-600 dark:text-zinc-300">
                      <thead className="sticky top-0 bg-zinc-50/80 backdrop-blur-md dark:bg-zinc-900/80 border-b border-border/50 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        <tr>
                          <th scope="col" className="px-6 py-3.5">Participant</th>
                          <th scope="col" className="px-6 py-3.5">Role</th>
                          <th scope="col" className="px-6 py-3.5">Location</th>
                          <th scope="col" className="px-6 py-3.5">Onboarded</th>
                          <th scope="col" className="px-6 py-3.5 text-right">Operations</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 bg-card">
                        {users.map((u) => (
                          <tr key={u.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors">
                            <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 border border-border/30 shadow-sm">
                                  <AvatarImage src={u.photo_url || undefined} alt={u.full_name || "User Avatar"} />
                                  <AvatarFallback className="bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 text-xs">
                                    {u.full_name?.[0] || "?"}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                  <span className="font-semibold text-sm tracking-tight">{u.full_name || "Anonymous"}</span>
                                  <span className="text-xs text-muted-foreground font-normal">{u.phone || "No phone listed"}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {u.is_admin ? (
                                <Badge variant="destructive" className="rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-sm">Admin</Badge>
                              ) : (
                                <Badge
                                  variant={u.role === "client" ? "default" : "secondary"}
                                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-sm ${
                                    u.role === "client" 
                                      ? "bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900" 
                                      : "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900"
                                  }`}
                                >
                                  {u.role}
                                </Badge>
                              )}
                            </td>
                            <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400 whitespace-nowrap text-sm">
                              {u.city || "N/A"}
                            </td>
                            <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400 whitespace-nowrap text-sm">
                              {format(new Date(u.created_at), "MMM d, yyyy")}
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              {!u.is_admin && (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleUserAction(u.id, "disconnect")}
                                    className="px-3 py-1 text-xs font-medium text-amber-600 hover:text-amber-700 border border-amber-200 hover:border-amber-300 bg-amber-50/50 dark:bg-amber-950/10 dark:border-amber-900/30 dark:hover:bg-amber-950/20 rounded-lg transition-all shadow-sm"
                                  >
                                    Disconnect
                                  </button>
                                  <button
                                    onClick={() => handleUserAction(u.id, "delete")}
                                    className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 bg-red-50/50 dark:bg-red-950/10 dark:border-red-900/30 dark:hover:bg-red-950/20 rounded-lg transition-all shadow-sm"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="statistics" className="mt-6">
            {statistics && (
              <div className="space-y-6">
                {/* Quick Glance Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-card border border-border/50 rounded-xl p-5 flex flex-col shadow-sm transition-all hover:shadow-md hover:border-border">
                    <span className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">Total Operations</span>
                    <span className="text-3xl font-extrabold tracking-tight mt-1 text-zinc-900 dark:text-zinc-50">{statistics.totalJobs}</span>
                    <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <span>{statistics.jobsThisWeek} created this week</span>
                    </div>
                  </div>
                  
                  <div className="bg-card border border-border/50 rounded-xl p-5 flex flex-col shadow-sm transition-all hover:shadow-md hover:border-border">
                    <span className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">Active Assignments</span>
                    <span className="text-3xl font-extrabold tracking-tight mt-1 text-emerald-600 dark:text-emerald-400">{statistics.activeJobs}</span>
                    <span className="text-xs text-muted-foreground mt-2 font-medium">In execution phase</span>
                  </div>

                  <div className="bg-card border border-border/50 rounded-xl p-5 flex flex-col shadow-sm transition-all hover:shadow-md hover:border-border">
                    <span className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">Fulfilling Requests</span>
                    <span className="text-3xl font-extrabold tracking-tight mt-1 text-amber-600 dark:text-amber-400">{statistics.requestedJobs}</span>
                    <span className="text-xs text-muted-foreground mt-2 font-medium">Candidate matching process</span>
                  </div>

                  <div className="bg-card border border-border/50 rounded-xl p-5 flex flex-col shadow-sm transition-all hover:shadow-md hover:border-border">
                    <span className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">Completed Work</span>
                    <span className="text-3xl font-extrabold tracking-tight mt-1 text-blue-600 dark:text-blue-400">{statistics.completedJobs}</span>
                    <span className="text-xs text-muted-foreground mt-2 font-medium">Archived and paid out</span>
                  </div>
                </div>

                {/* User Breakdown Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border border-border/50 shadow-sm rounded-xl overflow-hidden bg-card">
                    <CardHeader className="px-6 py-4 border-b border-border/50">
                      <CardTitle className="text-base font-bold">Participant Metrics</CardTitle>
                    </CardHeader>
                    <CardContent className="px-6 py-5 space-y-5">
                      <div>
                        <div className="flex justify-between items-center text-sm mb-1.5">
                          <span className="font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-orange-500"></span>
                            Clients (Employers)
                          </span>
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{statistics.totalClients}</span>
                        </div>
                        <div className="w-full bg-zinc-100 dark:bg-zinc-800/60 rounded-full h-2">
                          <div 
                            className="bg-orange-500 h-2 rounded-full" 
                            style={{ 
                              width: `${statistics.totalUsers > 0 ? (statistics.totalClients / statistics.totalUsers) * 100 : 0}%` 
                            }}
                          ></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center text-sm mb-1.5">
                          <span className="font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                            Freelancers (Helpers)
                          </span>
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{statistics.totalFreelancers}</span>
                        </div>
                        <div className="w-full bg-zinc-100 dark:bg-zinc-800/60 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full" 
                            style={{ 
                              width: `${statistics.totalUsers > 0 ? (statistics.totalFreelancers / statistics.totalUsers) * 100 : 0}%` 
                            }}
                          ></div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border/40 flex justify-between items-center text-sm">
                        <span className="text-zinc-500">Gross Platform Accounts</span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-50 text-base">{statistics.totalUsers}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border border-border/50 shadow-sm rounded-xl overflow-hidden bg-card">
                    <CardHeader className="px-6 py-4 border-b border-border/50">
                      <CardTitle className="text-base font-bold">Activity Velocity</CardTitle>
                    </CardHeader>
                    <CardContent className="px-6 py-5 flex items-center justify-center h-full">
                      <div className="text-center py-4">
                        <span className="text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                          {statistics.jobsLastWeek > 0 
                            ? `${Math.round(((statistics.jobsThisWeek - statistics.jobsLastWeek) / statistics.jobsLastWeek) * 100)}%`
                            : "N/A"
                          }
                        </span>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mt-1">Week-over-Week Request Growth</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
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
                    <p className="text-sm text-muted-foreground">
                      No reports yet
                    </p>
                  ) : (
                    reports.map((report) => (
                      <Card
                        key={report.id}
                        className={`p-4 cursor-pointer hover:bg-muted/50 ${report.unread_count > 0 ? "border-primary" : ""}`}
                        onClick={() => navigate(`/chat/${report.id}`)}
                      >
                        <div className="flex items-start gap-4">
                          <Avatar>
                            <AvatarImage
                              src={report.client?.photo_url || undefined}
                            />
                            <AvatarFallback>
                              {report.client?.full_name?.[0] || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {report.client?.full_name || "Unknown User"}
                              </p>
                              {report.unread_count > 0 && (
                                <Badge variant="destructive">
                                  {report.unread_count}
                                </Badge>
                              )}
                            </div>
                            {report.last_message && (
                              <p className="text-sm text-muted-foreground mt-1 truncate">
                                {report.last_message.body}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(
                                new Date(report.created_at),
                                "MMM d, yyyy 'at' h:mm a",
                              )}
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

        {/* Unified Job Details Modal */}
        <Dialog open={isJobModalOpen} onOpenChange={setIsJobModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl border border-border/40 bg-card p-0">
            {selectedJob && (
              <div className="flex flex-col">
                {/* Header banner */}
                <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 dark:from-zinc-950 dark:to-zinc-900 text-zinc-50 px-6 py-5 flex items-center justify-between border-b border-white/10 rounded-t-2xl">
                  <div>
                    <DialogTitle className="text-xl font-bold tracking-tight text-white">
                      Job Specification Detail
                    </DialogTitle>
                    <p className="text-xs text-zinc-400 mt-1 font-medium">
                      Reference ID: <span className="font-mono">{selectedJob.id}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/20 border-none px-2.5 py-0.5 text-xs font-semibold shadow-sm uppercase tracking-wide">
                      {selectedJob.status}
                    </Badge>
                    {selectedJob.stage && (
                      <Badge className="px-2.5 py-0.5 text-xs font-semibold shadow-sm uppercase tracking-wide">
                        {getJobStageBadge(selectedJob.stage).label}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Content body */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left Column: Client & Freelancer Profiles */}
                  <div className="space-y-6 md:col-span-1 border-r border-border/40 pr-0 md:pr-6 flex flex-col justify-start">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3">
                        Employer (Client)
                      </h4>
                      <div className="flex items-center gap-3 p-3 bg-zinc-50/50 dark:bg-zinc-900/50 rounded-xl border border-border/40">
                        <Avatar className="h-11 w-11 shadow-sm border border-border/20">
                          <AvatarImage src={selectedJob.client?.photo_url || undefined} />
                          <AvatarFallback className="bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-sm">
                            {selectedJob.client?.full_name?.[0] || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate text-zinc-900 dark:text-zinc-100">
                            {selectedJob.client?.full_name || "Anonymous Client"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {selectedJob.location_city || "No location listed"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3">
                        Assigned Helper (Freelancer)
                      </h4>
                      {selectedJob.freelancer ? (
                        <div className="flex items-center gap-3 p-3 bg-zinc-50/50 dark:bg-zinc-900/50 rounded-xl border border-border/40">
                          <Avatar className="h-11 w-11 shadow-sm border border-border/20">
                            <AvatarImage src={selectedJob.freelancer.photo_url || undefined} />
                            <AvatarFallback className="bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-sm">
                              {selectedJob.freelancer.full_name?.[0] || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate text-zinc-900 dark:text-zinc-100">
                              {selectedJob.freelancer.full_name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              Platform Helper
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 text-center bg-zinc-50/30 dark:bg-zinc-900/20 rounded-xl border border-dashed border-border/50 text-xs text-muted-foreground">
                          No candidate currently locked.
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-border/40 mt-auto flex flex-col gap-2">
                      <button
                        onClick={async () => {
                          const { data: conv } = await supabase
                            .from("conversations")
                            .select("id")
                            .eq("job_id", selectedJob.id)
                            .maybeSingle();
                          if (conv) {
                            navigate(`/chat/${conv.id}`);
                            setIsJobModalOpen(false);
                          } else {
                            alert("No conversation logs established yet for this job.");
                          }
                        }}
                        className="w-full px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-zinc-50 dark:text-zinc-900 font-semibold text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                      >
                        <MessageSquare className="h-4 w-4" /> Open Conversation
                      </button>
                      <button
                        onClick={() => {
                          navigate(`/client/jobs/${selectedJob.id}/live`);
                          setIsJobModalOpen(false);
                        }}
                        className="w-full px-4 py-2.5 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 border border-border/80 hover:border-border font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 bg-white dark:bg-zinc-900 shadow-sm"
                      >
                        <Briefcase className="h-4 w-4" /> Live Tracking
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Full specifications metadata */}
                  <div className="md:col-span-2 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-zinc-50/50 dark:bg-zinc-900/50 border border-border/40 rounded-xl">
                        <span className="text-xs text-zinc-500 font-medium">Care Category</span>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mt-0.5 capitalize">
                          {selectedJob.care_type?.replace("_", " ")}
                        </p>
                      </div>

                      <div className="p-3 bg-zinc-50/50 dark:bg-zinc-900/50 border border-border/40 rounded-xl">
                        <span className="text-xs text-zinc-500 font-medium">Compensation Range</span>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mt-0.5">
                          {selectedJob.budget_min && selectedJob.budget_max 
                            ? `$${selectedJob.budget_min} - $${selectedJob.budget_max}/hr` 
                            : "Rate custom/not specified"}
                        </p>
                      </div>

                      <div className="p-3 bg-zinc-50/50 dark:bg-zinc-900/50 border border-border/40 rounded-xl">
                        <span className="text-xs text-zinc-500 font-medium">Shift Parameters</span>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mt-0.5 capitalize">
                          {selectedJob.shift_hours?.replace("_", " ")}
                        </p>
                      </div>

                      <div className="p-3 bg-zinc-50/50 dark:bg-zinc-900/50 border border-border/40 rounded-xl">
                        <span className="text-xs text-zinc-500 font-medium">Target Schedule</span>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mt-0.5">
                          {selectedJob.start_at 
                            ? format(new Date(selectedJob.start_at), "MMM d, yyyy 'at' h:mm a") 
                            : "Flexible start date"}
                        </p>
                      </div>
                    </div>

                    {/* Care Specifics */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 border-b border-border/30 pb-1.5">
                        Requirements & Support
                      </h4>
                      <div className="grid grid-cols-2 gap-y-2 text-sm">
                        <div className="text-zinc-500">Total Children:</div>
                        <div className="font-medium text-zinc-900 dark:text-zinc-50">
                          {selectedJob.children_count || "0"} Children
                        </div>

                        <div className="text-zinc-500">Age Group Focus:</div>
                        <div className="font-medium text-zinc-900 dark:text-zinc-50 capitalize">
                          {selectedJob.children_age_group}
                        </div>

                        <div className="text-zinc-500">Required Skills:</div>
                        <div className="flex flex-wrap gap-1 font-medium">
                          {selectedJob.requirements && selectedJob.requirements.length > 0 ? (
                            selectedJob.requirements.map((r: string, i: number) => (
                              <Badge key={i} variant="outline" className="px-1.5 py-0 text-[10px] uppercase font-bold tracking-tight bg-zinc-100/50 dark:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300">
                                {r.replace("_", " ")}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-zinc-400 font-normal">No specialized skills tagged</span>
                          )}
                        </div>

                        <div className="text-zinc-500">Preferred Languages:</div>
                        <div className="flex flex-wrap gap-1 font-medium">
                          {selectedJob.languages_pref && selectedJob.languages_pref.length > 0 ? (
                            selectedJob.languages_pref.map((l: string, i: number) => (
                              <Badge key={i} variant="secondary" className="px-1.5 py-0 text-[10px] uppercase font-bold tracking-tight">
                                {l}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-zinc-400 font-normal">None specified</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Confirmation settings */}
                    {(selectedJob.confirm_starts_at || selectedJob.confirm_ends_at) && (
                      <div className="space-y-3 pt-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 border-b border-border/30 pb-1.5">
                          Operational Windowing
                        </h4>
                        <div className="grid grid-cols-2 gap-y-2 text-sm">
                          <div className="text-zinc-500">Matching Opens:</div>
                          <div className="font-medium text-zinc-900 dark:text-zinc-100">
                            {selectedJob.confirm_starts_at ? format(new Date(selectedJob.confirm_starts_at), "MMM d, h:mm a") : "N/A"}
                          </div>
                          
                          <div className="text-zinc-500">Matching Closes:</div>
                          <div className="font-medium text-zinc-900 dark:text-zinc-100">
                            {selectedJob.confirm_ends_at ? format(new Date(selectedJob.confirm_ends_at), "MMM d, h:mm a") : "N/A"}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Operational Notes */}
                    {selectedJob.notes && (
                      <div className="space-y-1.5 bg-zinc-50/50 dark:bg-zinc-900/50 border border-border/40 p-4 rounded-xl">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                          Execution Directives & Notes
                        </span>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed font-normal">
                          "{selectedJob.notes}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
