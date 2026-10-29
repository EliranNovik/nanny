import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  Briefcase,
  Users,
  BarChart3,
  MessageSquare,
  CheckCircle2,
  Eye,
  Loader2,
  MessageCircle,
  MoreVertical,
  BadgeCheck,
} from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { getJobStageBadge } from "@/lib/jobStages";
import { apiGet, apiPost } from "@/lib/api";
import { postServiceCategoryLabel } from "@/lib/serviceCategories";
import { findOrCreateDirectConversation } from "@/lib/findOrCreateDirectConversation";
import { adminCityLabel } from "@/lib/adminCityLabel";
import { AdminPageSkeleton } from "@/components/admin/AdminPageSkeleton";
import { adminJobBudget } from "@/lib/adminJobPresentation";

interface Job {
  id: string;
  status: string;
  stage: string | null;
  care_type: string;
  service_type?: string | null;
  service_details?: {
    other_type?: string | null;
    custom_category?: string | null;
    subcategory?: string | null;
  } | null;
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
  budget_rate_type?: string | null;
  shift_hours?: string | null;
  confirm_starts_at?: string | null;
  confirm_ends_at?: string | null;
  notes?: string | null;
  latest_cancellation?: {
    client_id: string;
    freelancer_id: string;
    reason: string;
    cancelled_by_role: "client" | "helper";
    created_at: string;
  } | null;
  client?: {
    full_name: string | null;
    photo_url: string | null;
    is_verified?: boolean | null;
  };
  freelancer?: {
    full_name: string | null;
    photo_url: string | null;
    is_verified?: boolean | null;
  };
}

interface UserProfile {
  id: string;
  role: "client" | "freelancer";
  is_admin?: boolean;
  is_verified?: boolean | null;
  full_name: string | null;
  city: string | null;
  phone: string | null;
  photo_url: string | null;
  whatsapp_number_e164?: string | null;
  telegram_username?: string | null;
  legal_terms_accepted_at?: string | null;
  privacy_accepted_at?: string | null;
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

type AdminDashboardPayload = {
  jobs: Job[];
  users: UserProfile[];
  reports: ReportConversation[];
  statistics: Statistics;
};

const ADMIN_DASHBOARD_CACHE_KEY = "admin-dashboard:v2";
const ADMIN_DASHBOARD_CACHE_TTL = 5 * 60 * 1000;

function readAdminDashboardCache(): {
  savedAt: number;
  data: AdminDashboardPayload;
} | null {
  try {
    const parsed = JSON.parse(
      sessionStorage.getItem(ADMIN_DASHBOARD_CACHE_KEY) || "null",
    );
    if (!parsed?.savedAt || !parsed?.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeAdminDashboardCache(data: AdminDashboardPayload) {
  try {
    sessionStorage.setItem(
      ADMIN_DASHBOARD_CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), data }),
    );
  } catch {
    // Cache is an optional performance enhancement.
  }
}

function getAdminJobStatus(job: Job): "In process" | "Cancelled" | "Completed" {
  if (job.status === "completed") return "Completed";
  if (
    job.status === "cancelled" ||
    (job.status === "ready" && job.latest_cancellation)
  ) {
    return "Cancelled";
  }
  return "In process";
}

function getAdminJobCategory(job: Job): string {
  const category = job.service_type || job.care_type;
  const detail =
    job.service_details?.other_type ||
    job.service_details?.custom_category ||
    job.service_details?.subcategory;
  return postServiceCategoryLabel(category, detail);
}

const CANCELLATION_REASON_LABELS: Record<string, string> = {
  helper_no_show: "Helper didn't show up",
  helper_unresponsive: "Helper stopped responding",
  helper_not_good_enough: "Helper wasn't good enough",
  helper_unprofessional: "Helper was unprofessional",
  price_disagreement: "Price disagreement",
  schedule_changed: "Client schedule changed",
  client_unresponsive: "Client stopped responding",
  job_not_as_described: "Job wasn't as described",
  schedule_conflict: "Helper schedule conflict",
  personal_emergency: "Personal emergency",
  other: "Other reason",
};

function getCancellationReason(job: Job): string {
  const reason = job.latest_cancellation?.reason;
  return reason ? CANCELLATION_REASON_LABELS[reason] || reason.replace(/_/g, " ") : "—";
}

export default function AdminPage() {
  const { profile, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const initialDashboardCache = readAdminDashboardCache();
  const [activeTab, setActiveTab] = useState("jobs");
  const [jobsDateFrom, setJobsDateFrom] = useState("");
  const [jobsDateTo, setJobsDateTo] = useState("");
  const [jobsCategory, setJobsCategory] = useState("all");
  const [jobsStatus, setJobsStatus] = useState("all");
  const [jobs, setJobs] = useState<Job[]>(() => initialDashboardCache?.data.jobs || []);
  const [users, setUsers] = useState<UserProfile[]>(() => initialDashboardCache?.data.users || []);
  const [reports, setReports] = useState<ReportConversation[]>(() => initialDashboardCache?.data.reports || []);
  const [statistics, setStatistics] = useState<Statistics | null>(
    () => initialDashboardCache?.data.statistics || null,
  );
  const [loading, setLoading] = useState(!initialDashboardCache);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [messagingTargetId, setMessagingTargetId] = useState<string | null>(null);
  const fetchInFlightRef = useRef(false);
  const lastFetchAtRef = useRef(0);

  const applyDashboardData = useCallback((data: AdminDashboardPayload) => {
    setJobs(data.jobs);
    setUsers(data.users);
    setReports(data.reports);
    setStatistics(data.statistics);
  }, []);

  const fetchAllData = useCallback(
    async (options: { silent?: boolean; force?: boolean } = {}) => {
      if (!user || fetchInFlightRef.current) return;
      if (
        !options.force &&
        Date.now() - lastFetchAtRef.current < 30 * 1000
      ) {
        return;
      }

      fetchInFlightRef.current = true;
      if (!options.silent) setLoading(true);
      try {
        const data = await apiGet<AdminDashboardPayload>(
          "/api/admin/dashboard",
        );
        applyDashboardData(data);
        writeAdminDashboardCache(data);
        lastFetchAtRef.current = Date.now();
      } catch (error) {
        console.error("Error fetching admin data:", error);
      } finally {
        fetchInFlightRef.current = false;
        setLoading(false);
      }
    },
    [applyDashboardData, user],
  );

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
      const cached = readAdminDashboardCache();
      if (cached) {
        applyDashboardData(cached.data);
        lastFetchAtRef.current = cached.savedAt;
        setLoading(false);
        if (Date.now() - cached.savedAt > ADMIN_DASHBOARD_CACHE_TTL) {
          void fetchAllData({ silent: true, force: true });
        }
      } else {
        void fetchAllData();
      }
    }
  }, [
    profile,
    authLoading,
    navigate,
    user,
    applyDashboardData,
    fetchAllData,
  ]);

  useEffect(() => {
    if (!user || !profile?.is_admin) return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchAllData({ silent: true, force: true });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchAllData, profile?.is_admin, user]);

  const openJobModal = (job: Job) => {
    setSelectedJob(job);
    setIsJobModalOpen(true);
  };

  const messageJobParticipant = async (targetId: string) => {
    if (!user?.id || messagingTargetId) return;
    setMessagingTargetId(targetId);
    try {
      const result = await findOrCreateDirectConversation({
        clientId: user.id,
        freelancerId: targetId,
      });
      navigate(`/messages?conversation=${result.conversationId}`);
    } catch (error) {
      console.error("Unable to open participant conversation:", error);
      window.alert("Unable to open this conversation.");
    } finally {
      setMessagingTargetId(null);
    }
  };

  const overviewCategories = Array.from(
    new Set(jobs.map(getAdminJobCategory).filter(Boolean)),
  ).sort();
  const overviewJobs = jobs.filter((job) => {
    const createdDate = job.created_at.slice(0, 10);
    return (
      (!jobsDateFrom || createdDate >= jobsDateFrom) &&
      (!jobsDateTo || createdDate <= jobsDateTo) &&
      (jobsCategory === "all" || getAdminJobCategory(job) === jobsCategory) &&
      (jobsStatus === "all" || getAdminJobStatus(job) === jobsStatus)
    );
  });

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
        void fetchAllData({ force: true });
      }
    } catch (err: any) {
      alert(`Administrative action failed: ${err.message || err}`);
      setLoading(false);
    }
  }



  // Show loading while auth is loading or data is loading
  if ((authLoading && (!user || !profile)) || loading) {
    return <AdminPageSkeleton summaryCards={4} columns={8} />;
  }

  return (
    <div className="admin-page admin-overview-page admin-overview-workspace min-h-screen bg-zinc-100 pb-6 dark:bg-zinc-950 md:pb-8">
      <div className="admin-overview-content w-full px-4 py-6 lg:px-6 xl:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        </div>

        {/* Statistics Cards */}
        {statistics && (
          <div className="admin-kpi-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <Card className="relative rounded-2xl">
              <CardHeader className="absolute right-0 top-0 p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
                  <Briefcase className="h-6 w-6" />
                </span>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-8">
                <div className="text-5xl font-black tracking-tight">{statistics.totalJobs}</div>
                <CardTitle className="mt-2 text-base font-bold">Total Jobs</CardTitle>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  {statistics.jobsThisWeek} this week
                </p>
              </CardContent>
            </Card>

            <Card className="relative rounded-2xl">
              <CardHeader className="absolute right-0 top-0 p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <CheckCircle2 className="h-6 w-6" />
                </span>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-8">
                <div className="text-5xl font-black tracking-tight">
                  {statistics.activeJobs}
                </div>
                <CardTitle className="mt-2 text-base font-bold">Active Jobs</CardTitle>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  Currently in progress
                </p>
              </CardContent>
            </Card>

            <Card className="relative rounded-2xl">
              <CardHeader className="absolute right-0 top-0 p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
                  <Users className="h-6 w-6" />
                </span>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-8">
                <div className="text-5xl font-black tracking-tight">
                  {statistics.totalUsers}
                </div>
                <CardTitle className="mt-2 text-base font-bold">Total Users</CardTitle>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  {statistics.totalClients} clients,{" "}
                  {statistics.totalFreelancers} freelancers
                </p>
              </CardContent>
            </Card>

            <Card className="relative rounded-2xl">
              <CardHeader className="absolute right-0 top-0 p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
                  <MessageSquare className="h-6 w-6" />
                </span>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-8">
                <div className="text-5xl font-black tracking-tight">{reports.length}</div>
                <CardTitle className="mt-2 text-base font-bold">Reports</CardTitle>
                <p className="mt-1 text-xs font-medium text-muted-foreground">User reports</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="admin-overview-tabs w-full">
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

          <TabsContent value="jobs" className="admin-overview-tab mt-6">
            <div className="admin-overview-table-panel overflow-hidden rounded-2xl bg-white dark:bg-zinc-900">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-6 py-3 dark:border-zinc-800">
                <h2 className="text-lg font-bold">Jobs overview</h2>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <input
                    type="date"
                    value={jobsDateFrom}
                    onChange={(event) => setJobsDateFrom(event.target.value)}
                    aria-label="Jobs from date"
                    className="h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                  />
                  <input
                    type="date"
                    value={jobsDateTo}
                    onChange={(event) => setJobsDateTo(event.target.value)}
                    aria-label="Jobs to date"
                    className="h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                  />
                  <select
                    value={jobsCategory}
                    onChange={(event) => setJobsCategory(event.target.value)}
                    aria-label="Filter jobs by category"
                    className="h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <option value="all">All categories</option>
                    {overviewCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                  <select
                    value={jobsStatus}
                    onChange={(event) => setJobsStatus(event.target.value)}
                    aria-label="Filter jobs by status"
                    className="h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <option value="all">All statuses</option>
                    <option value="In process">In process</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>
              <div className="admin-overview-table-scroll overflow-auto">
                <table className="w-full min-w-[1180px] text-left">
                  <thead className="bg-zinc-50 text-xs font-bold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60">
                    <tr>
                      <th className="px-6 py-3">Client</th>
                      <th className="px-6 py-3">Freelancer</th>
                      <th className="px-6 py-3">Category</th>
                      <th className="px-6 py-3">Location</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Cancelled reason</th>
                      <th className="px-6 py-3">Created</th>
                      <th className="px-6 py-3 text-right">Budget</th>
                      <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {overviewJobs.map((job) => {
                      const freelancerId =
                        job.selected_freelancer_id ||
                        job.latest_cancellation?.freelancer_id ||
                        null;
                      const freelancer =
                        job.freelancer ||
                        users.find((candidate) => candidate.id === freelancerId);
                      return (
                      <tr key={job.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={job.client?.photo_url || undefined} />
                              <AvatarFallback>{job.client?.full_name?.[0] || "?"}</AvatarFallback>
                            </Avatar>
                            <span className="inline-flex items-center gap-1 font-semibold">
                              {job.client?.full_name || "Unknown"}
                              {job.client?.is_verified && (
                                <BadgeCheck className="h-4 w-4 shrink-0 fill-sky-500 text-white dark:text-zinc-900" aria-label="Verified" />
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {freelancer ? (
                            <div className="flex items-center gap-3">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={freelancer.photo_url || undefined} />
                                <AvatarFallback>{freelancer.full_name?.[0] || "?"}</AvatarFallback>
                              </Avatar>
                              <span className="inline-flex items-center gap-1 font-semibold">
                                {freelancer.full_name || "Unknown"}
                                {freelancer.is_verified && (
                                  <BadgeCheck className="h-4 w-4 shrink-0 fill-sky-500 text-white dark:text-zinc-900" aria-label="Verified" />
                                )}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-zinc-400">Unassigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium">{getAdminJobCategory(job)}</td>
                        <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-300">{adminCityLabel(job.location_city)}</td>
                        <td className="px-6 py-4 text-sm font-semibold">{getAdminJobStatus(job)}</td>
                        <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-300">{getCancellationReason(job)}</td>
                        <td className="px-6 py-4 text-sm text-zinc-500">{format(new Date(job.created_at), "MMM d, yyyy")}</td>
                        <td className="px-6 py-4 text-right text-sm font-bold">{adminJobBudget(job)}</td>
                        <td className="px-6 py-4 text-right">
                          <details className="relative inline-block text-left">
                            <summary
                              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 [&::-webkit-details-marker]:hidden"
                              aria-label="Job actions"
                            >
                              <MoreVertical className="h-5 w-5" />
                            </summary>
                            <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl bg-white p-1.5 text-left shadow-xl ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10">
                              <button
                                type="button"
                                onClick={(event) => {
                                  openJobModal(job);
                                  event.currentTarget.closest("details")?.removeAttribute("open");
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-700"
                              >
                                <Eye className="h-4 w-4" /> View
                              </button>
                              <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                Message
                              </div>
                              <button
                                type="button"
                                onClick={() => void messageJobParticipant(job.client_id)}
                                disabled={messagingTargetId !== null}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-700"
                              >
                                {messagingTargetId === job.client_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                                Client: {job.client?.full_name || "Unknown"}
                              </button>
                              <button
                                type="button"
                                onClick={() => freelancerId && void messageJobParticipant(freelancerId)}
                                disabled={!freelancerId || messagingTargetId !== null}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-700"
                              >
                                {messagingTargetId === freelancerId ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                                Freelancer: {freelancer?.full_name || "Unassigned"}
                              </button>
                            </div>
                          </details>
                        </td>
                      </tr>
                    )})}
                    {overviewJobs.length === 0 && (
                      <tr><td colSpan={8} className="px-6 py-14 text-center text-sm text-muted-foreground">No jobs match these filters</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="users" className="admin-overview-tab mt-6">
            <Card className="admin-overview-table-panel overflow-hidden rounded-2xl border-0 bg-card shadow-none">
              <CardHeader className="px-6 py-5 border-b border-border/50">
                <CardTitle className="text-xl font-bold">Comprehensive User Registry</CardTitle>
              </CardHeader>
              <CardContent className="admin-overview-table-scroll overflow-auto p-0">
                {users.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    No active user data loaded.
                  </div>
                ) : (
                  <div className="overflow-x-auto bg-white dark:bg-zinc-900">
                    <table className="w-full min-w-[1380px] border-collapse bg-white text-left text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                      <thead className="sticky top-0 border-b border-zinc-100 bg-white text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                        <tr>
                          <th scope="col" className="px-6 py-3.5">Participant</th>
                          <th scope="col" className="px-6 py-3.5">Role</th>
                          <th scope="col" className="px-6 py-3.5">Location</th>
                          <th scope="col" className="px-6 py-3.5">WhatsApp</th>
                          <th scope="col" className="px-6 py-3.5">Telegram</th>
                          <th scope="col" className="px-6 py-3.5">Agreement signed</th>
                          <th scope="col" className="px-6 py-3.5">Completed as client</th>
                          <th scope="col" className="px-6 py-3.5">Completed as freelancer</th>
                          <th scope="col" className="px-6 py-3.5">Onboarded</th>
                          <th scope="col" className="px-6 py-3.5 text-right">Operations</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
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
                              {adminCityLabel(u.city)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {u.whatsapp_number_e164 || "—"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {u.telegram_username ? `@${u.telegram_username.replace(/^@/, "")}` : "—"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                              {u.legal_terms_accepted_at && u.privacy_accepted_at ? "Yes" : "No"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {jobs.filter((job) => job.status === "completed" && job.client_id === u.id).length}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {jobs.filter((job) => job.status === "completed" && job.selected_freelancer_id === u.id).length}
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

          <TabsContent value="statistics" className="admin-overview-tab mt-6">
            {statistics && (
              <div className="admin-overview-table-panel overflow-hidden rounded-2xl bg-white dark:bg-zinc-900">
                <div className="border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
                  <h2 className="text-lg font-bold">Platform statistics</h2>
                </div>
                <div className="admin-overview-table-scroll overflow-auto">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="bg-zinc-50 text-xs font-bold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60">
                      <tr><th className="px-6 py-3">Metric</th><th className="px-6 py-3">Value</th><th className="px-6 py-3">Context</th></tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      <tr><td className="px-6 py-3 font-semibold">Total operations</td><td className="px-6 py-3">{statistics.totalJobs}</td><td className="px-6 py-3 text-muted-foreground">{statistics.jobsThisWeek} created this week</td></tr>
                      <tr><td className="px-6 py-3 font-semibold">Active assignments</td><td className="px-6 py-3">{statistics.activeJobs}</td><td className="px-6 py-3 text-muted-foreground">In execution</td></tr>
                      <tr><td className="px-6 py-3 font-semibold">Fulfilling requests</td><td className="px-6 py-3">{statistics.requestedJobs}</td><td className="px-6 py-3 text-muted-foreground">Candidate matching</td></tr>
                      <tr><td className="px-6 py-3 font-semibold">Completed work</td><td className="px-6 py-3">{statistics.completedJobs}</td><td className="px-6 py-3 text-muted-foreground">Archived and completed</td></tr>
                      <tr><td className="px-6 py-3 font-semibold">Clients</td><td className="px-6 py-3">{statistics.totalClients}</td><td className="px-6 py-3 text-muted-foreground">Employer accounts</td></tr>
                      <tr><td className="px-6 py-3 font-semibold">Helpers</td><td className="px-6 py-3">{statistics.totalFreelancers}</td><td className="px-6 py-3 text-muted-foreground">Freelancer accounts</td></tr>
                      <tr><td className="px-6 py-3 font-semibold">Total users</td><td className="px-6 py-3">{statistics.totalUsers}</td><td className="px-6 py-3 text-muted-foreground">All platform accounts</td></tr>
                      <tr><td className="px-6 py-3 font-semibold">Weekly growth</td><td className="px-6 py-3">{statistics.jobsLastWeek > 0 ? `${Math.round(((statistics.jobsThisWeek - statistics.jobsLastWeek) / statistics.jobsLastWeek) * 100)}%` : "N/A"}</td><td className="px-6 py-3 text-muted-foreground">Week over week</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="reports" className="admin-overview-tab mt-6">
            <div className="admin-overview-table-panel overflow-hidden rounded-2xl bg-white dark:bg-zinc-900">
              <div className="border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
                <h2 className="text-lg font-bold">User reports</h2>
              </div>
              <div className="admin-overview-table-scroll overflow-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-zinc-50 text-xs font-bold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60">
                    <tr><th className="px-6 py-3">User</th><th className="px-6 py-3">Latest message</th><th className="px-6 py-3">Created</th><th className="px-6 py-3">Unread</th><th className="px-6 py-3 text-right">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {reports.map((report) => (
                      <tr key={report.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40">
                        <td className="px-6 py-3 font-semibold">{report.client?.full_name || "Unknown User"}</td>
                        <td className="max-w-sm truncate px-6 py-3 text-muted-foreground">{report.last_message?.body || "No message"}</td>
                        <td className="px-6 py-3 text-muted-foreground">{format(new Date(report.created_at), "MMM d, yyyy")}</td>
                        <td className="px-6 py-3">{report.unread_count || 0}</td>
                        <td className="px-6 py-3 text-right"><Button size="sm" className="rounded-full" onClick={() => void messageJobParticipant(report.client_id)}>Open</Button></td>
                      </tr>
                    ))}
                    {reports.length === 0 && <tr><td colSpan={5} className="px-6 py-14 text-center text-muted-foreground">No reports yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Unified Job Details Modal */}
        <Dialog open={isJobModalOpen} onOpenChange={setIsJobModalOpen}>
          <DialogContent className="admin-drawer-content max-w-3xl overflow-y-auto p-0">
            {selectedJob && (
              <div className="flex flex-col">
                {/* Header banner */}
                <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 dark:from-zinc-950 dark:to-zinc-900 text-zinc-50 px-6 py-5 flex items-center justify-between border-b border-white/10 rounded-t-2xl">
                  <div>
                    <DialogTitle className="text-xl font-bold tracking-tight text-white">
                      Job Specification Detail
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                      Review and manage the selected job.
                    </DialogDescription>
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
                          {adminJobBudget(selectedJob)}
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
