import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BadgeCheck, CheckCircle2, Search, ArrowUpDown, Download, MoreVertical, Settings, Trash } from "lucide-react";
import { getAdminData, getCachedAdminData, invalidateAdminData } from "@/lib/adminDataCache";
import { apiDelete } from "@/lib/api";
import { JobDetailsDialog } from "@/components/admin/JobDetailsDialog";
import { useProgressiveList } from "@/hooks/useProgressiveList";
import { AdminPageSkeleton } from "@/components/admin/AdminPageSkeleton";
import { format } from "date-fns";
import { adminCityLabel } from "@/lib/adminCityLabel";
import { adminJobCategory } from "@/lib/adminJobPresentation";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

interface Job {
  id: string;
  status: string;
  stage: string | null;
  care_type: string | null;
  service_type?: string | null;
  service_details?: { other_type?: string | null; custom_category?: string | null; subcategory?: string | null } | null;
  children_count: number;
  children_age_group: string;
  location_city: string;
  start_at: string | null;
  created_at: string;
  updated_at?: string | null;
  client_id: string;
  selected_freelancer_id: string | null;
  requirements?: string[];
  languages_pref?: string[];
  budget_min?: number | null;
  budget_max?: number | null;
  budget_rate_type?: "per_hour" | "fixed" | string | null;
  shift_hours?: string | null;
  confirm_starts_at?: string | null;
  confirm_ends_at?: string | null;
  notes?: string | null;
  client?: {
    id: string;
    full_name: string | null;
    photo_url: string | null;
    is_verified?: boolean | null;
  };
  freelancer?: {
    id: string;
    full_name: string | null;
    photo_url: string | null;
    is_verified?: boolean | null;
  };
}

function formatJobBudget(job: Job): string {
  const min = job.budget_min;
  const max = job.budget_max;
  if (min == null && max == null) return "No rate specified";
  const suffix = job.budget_rate_type === "fixed" ? " fixed" : "/hr";
  if (min != null && max != null && min !== max) return `₪${min}–₪${max}${suffix}`;
  const amount = min ?? max;
  if (job.budget_rate_type === "fixed" || min === max) return `₪${amount}${suffix}`;
  if (min != null) return `From ₪${min}${suffix}`;
  return `Up to ₪${max}${suffix}`;
}

export default function AdminCompletedJobsPage() {
  const cachedJobs = getCachedAdminData<{ jobs: Job[] }>("dashboard")?.jobs;
  const [jobs, setJobs] = useState<Job[]>(() =>
    (cachedJobs || []).filter((j) => j.status === "completed"),
  );
  const [loading, setLoading] = useState(!cachedJobs);
  const [search, setSearch] = useState("");
  const [careTypeFilter, setCareTypeFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"created_at" | "budget">("created_at");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [summaryJobs, setSummaryJobs] = useState<{
    title: string;
    jobs: Job[];
  } | null>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    const closeMenus = (event: PointerEvent) => {
      const target = event.target as Node;
      document.querySelectorAll<HTMLDetailsElement>("details[data-admin-job-actions][open]").forEach((menu) => {
        if (!menu.contains(target)) menu.removeAttribute("open");
      });
    };
    document.addEventListener("pointerdown", closeMenus);
    return () => document.removeEventListener("pointerdown", closeMenus);
  }, []);

  async function fetchJobs() {
    if (!getCachedAdminData("dashboard")) setLoading(true);
    try {
      const data = await getAdminData<{ jobs: Job[] }>("dashboard", "/api/admin/dashboard");
      // Filter for completed jobs
      const completed = data.jobs.filter((j) => j.status === "completed");
      setJobs(completed);
    } catch (error) {
      console.error("Error loading completed jobs:", error);
    } finally {
      setLoading(false);
    }
  }

  // Get unique cities and categories for filtering
  const cities = Array.from(new Set(jobs.map((j) => j.location_city).filter((c): c is string => !!c)));
  const careTypes = Array.from(new Set(jobs.map(adminJobCategory).filter(Boolean)));

  // Filter & Sort
  const filteredJobs = jobs
    .filter((j) => {
      const matchesSearch =
        (j.client?.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (j.freelancer?.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
        j.id.includes(search) ||
        (j.location_city || "").toLowerCase().includes(search.toLowerCase());
      
      const matchesCareType = careTypeFilter === "all" || adminJobCategory(j) === careTypeFilter;
      const matchesCity = cityFilter === "all" || j.location_city === cityFilter;
      const completedDate = (j.updated_at || j.created_at).slice(0, 10);
      const matchesDate = (!dateFrom || completedDate >= dateFrom) && (!dateTo || completedDate <= dateTo);

      return matchesSearch && matchesCareType && matchesCity && matchesDate;
    })
    .sort((a, b) => {
      if (sortBy === "created_at") {
        return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
      } else {
        const budgetA = a.budget_max ?? a.budget_min ?? 0;
        const budgetB = b.budget_max ?? b.budget_min ?? 0;
        return budgetB - budgetA;
      }
    });

  // Calculate metrics
  const totalCompleted = filteredJobs.length;
  const hourlyBudgetJobs = filteredJobs.filter(
    (job) =>
      job.budget_rate_type !== "fixed" &&
      (job.budget_min != null || job.budget_max != null),
  );
  const avgHourlyRate = hourlyBudgetJobs.length > 0
    ? Math.round(
        hourlyBudgetJobs.reduce(
          (sum, job) => sum + (job.budget_max ?? job.budget_min ?? 0),
          0,
        ) / hourlyBudgetJobs.length,
      )
    : 0;
  const topClient = Object.values(
    filteredJobs.reduce<Record<string, { id: string; name: string; photo: string | null; verified: boolean; count: number }>>((acc, job) => {
      if (!job.client_id) return acc;
      const current = acc[job.client_id] || {
        id: job.client_id,
        name: job.client?.full_name || "Unknown",
        photo: job.client?.photo_url || null,
        verified: job.client?.is_verified === true,
        count: 0,
      };
      current.count += 1;
      acc[job.client_id] = current;
      return acc;
    }, {}),
  ).sort((a, b) => b.count - a.count)[0];
  const topFreelancer = Object.values(
    filteredJobs.reduce<Record<string, { id: string; name: string; photo: string | null; verified: boolean; count: number }>>((acc, job) => {
      if (!job.selected_freelancer_id) return acc;
      const current = acc[job.selected_freelancer_id] || {
        id: job.selected_freelancer_id,
        name: job.freelancer?.full_name || "Unknown",
        photo: job.freelancer?.photo_url || null,
        verified: job.freelancer?.is_verified === true,
        count: 0,
      };
      current.count += 1;
      acc[job.selected_freelancer_id] = current;
      return acc;
    }, {}),
  ).sort((a, b) => b.count - a.count)[0];

  const {
    visibleItems: paginatedJobs,
    hasMore,
    sentinelRef,
  } = useProgressiveList(filteredJobs, 24);

  const handleOpenJob = (job: Job) => {
    setSelectedJob(job);
    setIsModalOpen(true);
  };

  const handleDeleteJob = async (job: Job) => {
    if (!window.confirm(`Delete job ${job.id}? This cannot be undone.`)) return;
    try {
      await apiDelete(`/api/admin/jobs/${job.id}`);
      invalidateAdminData("dashboard");
      setJobs((current) => current.filter((item) => item.id !== job.id));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to delete job.");
    }
  };

  const exportCSV = () => {
    if (filteredJobs.length === 0) return;
    const csvRows = [
      ["Job ID", "Client Name", "Freelancer Name", "Care Type", "City", "Created At", "Completed At", "Budget Max/hr"],
      ...filteredJobs.map((j) => [
        j.id,
        j.client?.full_name || "N/A",
        j.freelancer?.full_name || "N/A",
        j.care_type,
        j.location_city,
        j.created_at,
        j.updated_at || j.created_at,
        formatJobBudget(j)
      ])
    ];

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.map(val => `"${val}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "completed_jobs_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return <AdminPageSkeleton summaryCards={2} columns={7} />;
  }

  return (
    <div className="admin-page admin-table-page min-h-screen bg-zinc-100 dark:bg-zinc-950 pb-10">
      <div className="w-full px-4 py-6 lg:px-6 xl:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <CheckCircle2 className="h-8 w-8 text-blue-500" /> Completed Jobs Registry
            </h1>
          </div>

          <button
            onClick={exportCSV}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm font-semibold rounded-xl transition-all shadow-xs"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>

        {/* Overview Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="rounded-2xl border-0 bg-white shadow-xs dark:bg-zinc-900">
            <CardHeader className="px-4 pb-1 pt-3">
              <CardDescription className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500">Completed Contracts</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">{totalCompleted}</span>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-0 bg-white shadow-xs dark:bg-zinc-900">
            <CardHeader className="px-4 pb-1 pt-3">
              <CardDescription className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500">Avg Hourly Rate</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">₪{avgHourlyRate}/hr</span>
            </CardContent>
          </Card>
          <Card
            role="button"
            tabIndex={topClient ? 0 : -1}
            onClick={() => topClient && setSummaryJobs({
              title: `${topClient.name} · Completed as client`,
              jobs: filteredJobs.filter((job) => job.client_id === topClient.id),
            })}
            className="cursor-pointer rounded-2xl border-0 bg-white shadow-xs transition-shadow hover:shadow-md dark:bg-zinc-900"
          >
            <CardHeader className="px-4 pb-1 pt-3">
              <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Most Jobs as Client</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={topClient?.photo || undefined} />
                  <AvatarFallback>{topClient?.name?.[0] || "—"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <span className="flex items-center gap-1 truncate text-lg font-extrabold text-zinc-900 dark:text-zinc-50">
                    {topClient?.name || "—"}
                    {topClient?.verified && <BadgeCheck className="h-4 w-4 shrink-0 fill-sky-500 text-white dark:text-zinc-900" aria-label="Verified" />}
                  </span>
                  <span className="text-xs font-semibold text-zinc-500">{topClient ? `${topClient.count} completed jobs` : "No completed jobs"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card
            role="button"
            tabIndex={topFreelancer ? 0 : -1}
            onClick={() => topFreelancer && setSummaryJobs({
              title: `${topFreelancer.name} · Completed as freelancer`,
              jobs: filteredJobs.filter((job) => job.selected_freelancer_id === topFreelancer.id),
            })}
            className="cursor-pointer rounded-2xl border-0 bg-white shadow-xs transition-shadow hover:shadow-md dark:bg-zinc-900"
          >
            <CardHeader className="px-4 pb-1 pt-3">
              <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Most Jobs as Freelancer</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={topFreelancer?.photo || undefined} />
                  <AvatarFallback>{topFreelancer?.name?.[0] || "—"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <span className="flex items-center gap-1 truncate text-lg font-extrabold text-zinc-900 dark:text-zinc-50">
                    {topFreelancer?.name || "—"}
                    {topFreelancer?.verified && <BadgeCheck className="h-4 w-4 shrink-0 fill-sky-500 text-white dark:text-zinc-900" aria-label="Verified" />}
                  </span>
                  <span className="text-xs font-semibold text-zinc-500">{topFreelancer ? `${topFreelancer.count} completed jobs` : "No completed jobs"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter controls */}
        <div className="admin-filter-panel grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-3 mb-6 p-0">
          <div className="relative col-span-1 lg:col-span-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Search by client, helper, city or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <select
              value={careTypeFilter}
              onChange={(e) => setCareTypeFilter(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
            >
              <option value="all">All Categories</option>
              {careTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="From date" className="w-full px-3 py-2.5 text-sm bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="To date" className="w-full px-3 py-2.5 text-sm bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl" />
          <div>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
            >
              <option value="all">All Cities</option>
              {cities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          <div>
            <button
              onClick={() => setSortBy(sortBy === "created_at" ? "budget" : "created_at")}
              className="w-full inline-flex items-center justify-between px-3 py-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <span className="flex items-center gap-1.5 font-medium">
                <ArrowUpDown className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                Sort: {sortBy === "created_at" ? "Recent" : "Highest Budget"}
              </span>
            </button>
          </div>
        </div>

        {paginatedJobs.length === 0 ? (
          <Card className="text-center py-16 bg-white sm:bg-white dark:bg-zinc-900 dark:sm:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs">
            <CardContent>
              <p className="text-zinc-500 dark:text-zinc-400 font-medium">No completed jobs matching filters.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="admin-table-panel bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden">
            <div className="admin-table-scroll overflow-auto">
              <table className="w-full min-w-[1080px] border-collapse text-left text-sm text-zinc-600 dark:text-zinc-300">
                <thead className="bg-zinc-50/75 dark:bg-zinc-950/75 border-b border-zinc-200 dark:border-zinc-800/80 text-[11px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Job ID</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Client</th>
                    <th className="px-6 py-4">Freelancer</th>
                    <th className="px-6 py-4">Location</th>
                    <th className="px-6 py-4">Created</th>
                    <th className="px-6 py-4">Date completed</th>
                    <th className="px-6 py-4 text-right">Budget</th>
                    <th className="admin-jobs-actions px-3 py-4" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-250/10 dark:divide-zinc-800/80">
                  {paginatedJobs.map((job) => (
                    <tr
                      key={job.id}
                      onClick={() => handleOpenJob(job)}
                      className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs font-mono text-zinc-500">{job.id.substring(0, 8)}</span>
                      </td>

                      {/* Care Type */}
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-zinc-900 dark:text-zinc-50 capitalize group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {adminJobCategory(job)}
                      </td>

                      {/* Client */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-7 w-7 border border-zinc-200 dark:border-zinc-800">
                            <AvatarImage src={job.client?.photo_url || undefined} />
                            <AvatarFallback className="text-[10px] font-bold bg-amber-100 text-amber-800">
                              {job.client?.full_name?.[0] || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                            {job.client?.full_name || "Unknown"}
                          </span>
                        </div>
                      </td>

                      {/* Helper */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-7 w-7 border border-zinc-200 dark:border-zinc-800">
                            <AvatarImage src={job.freelancer?.photo_url || undefined} />
                            <AvatarFallback className="text-[10px] font-bold bg-blue-100 text-blue-800">
                              {job.freelancer?.full_name?.[0] || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                            {job.freelancer?.full_name || "Unassigned"}
                          </span>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="px-6 py-4 whitespace-nowrap text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                        {adminCityLabel(job.location_city)}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">{format(new Date(job.created_at), "MMM d, yyyy")}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                        {format(new Date(job.updated_at || job.created_at), "MMM d, yyyy")}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                          {formatJobBudget(job)}
                        </span>
                      </td>
                      <td className="admin-jobs-actions px-3 py-2 text-right" onClick={(event) => event.stopPropagation()}>
                        <details className="relative inline-block" data-admin-job-actions>
                          <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 [&::-webkit-details-marker]:hidden">
                            <MoreVertical className="h-5 w-5" />
                          </summary>
                          <div className="absolute right-0 top-0 z-50 w-44 rounded-xl bg-white p-1.5 text-left shadow-xl ring-1 ring-black/5 dark:bg-zinc-800">
                            <button onClick={() => handleOpenJob(job)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-700">
                              <Settings className="h-4 w-4" /> Settings
                            </button>
                            <button onClick={() => void handleDeleteJob(job)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                              <Trash className="h-4 w-4" /> Delete
                            </button>
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div ref={sentinelRef} className="h-1" aria-hidden />
              {hasMore && <p className="py-3 text-center text-xs text-zinc-400">Loading more…</p>}
            </div>
          </div>
        )}
      </div>

      <Dialog open={Boolean(summaryJobs)} onOpenChange={(open) => !open && setSummaryJobs(null)}>
        <DialogContent className="admin-drawer-content max-w-3xl overflow-y-auto p-0">
          <div className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
            <DialogTitle className="text-xl font-extrabold">{summaryJobs?.title}</DialogTitle>
            <DialogDescription>
              {summaryJobs?.jobs.length || 0} completed jobs, organized by category.
            </DialogDescription>
          </div>
          <div className="overflow-auto p-5">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Client</th>
                  <th className="px-3 py-3">Freelancer</th>
                  <th className="px-3 py-3">Completed</th>
                  <th className="px-3 py-3 text-right">Budget</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {[...(summaryJobs?.jobs || [])]
                  .sort((a, b) => adminJobCategory(a).localeCompare(adminJobCategory(b)))
                  .map((job) => (
                    <tr key={job.id}>
                      <td className="px-3 py-3 font-semibold">{adminJobCategory(job)}</td>
                      <td className="px-3 py-3">{job.client?.full_name || "Unknown"}</td>
                      <td className="px-3 py-3">{job.freelancer?.full_name || "Unknown"}</td>
                      <td className="px-3 py-3 text-zinc-500">{format(new Date(job.updated_at || job.created_at), "MMM d, yyyy")}</td>
                      <td className="px-3 py-3 text-right font-bold">{formatJobBudget(job)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <JobDetailsDialog
        job={selectedJob}
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        onRefresh={fetchJobs}
      />
    </div>
  );
}
