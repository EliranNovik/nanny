import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BadgeCheck, Clock, Search, ArrowUpDown, Download, MoreVertical, Settings, Trash } from "lucide-react";
import { getAdminData, getCachedAdminData, invalidateAdminData } from "@/lib/adminDataCache";
import { apiDelete } from "@/lib/api";
import { JobDetailsDialog } from "@/components/admin/JobDetailsDialog";
import { useProgressiveList } from "@/hooks/useProgressiveList";
import { AdminPageSkeleton } from "@/components/admin/AdminPageSkeleton";
import { format } from "date-fns";
import { adminCityLabel } from "@/lib/adminCityLabel";
import { adminJobBudget, adminJobCancellationReason, adminJobCategory, adminJobStatus } from "@/lib/adminJobPresentation";
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
  latest_cancellation?: { reason: string; freelancer_id: string; created_at: string } | null;
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

export default function AdminRequestedJobsPage() {
  const cachedJobs = getCachedAdminData<{ jobs: Job[] }>("dashboard")?.jobs;
  const [jobs, setJobs] = useState<Job[]>(() =>
    (cachedJobs || []).filter(
      (j) => !["locked", "active", "completed"].includes(j.status),
    ),
  );
  const [loading, setLoading] = useState(!cachedJobs);
  const [search, setSearch] = useState("");
  const [careTypeFilter, setCareTypeFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"created_at" | "budget">("created_at");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [summaryJobs, setSummaryJobs] = useState<{ title: string; jobs: Job[] } | null>(null);

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
      // Filter for requested jobs
      const requested = data.jobs.filter((j) => !["locked", "active", "completed"].includes(j.status));
      setJobs(requested);
    } catch (error) {
      console.error("Error loading requested jobs:", error);
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
        j.id.includes(search) ||
        (j.location_city || "").toLowerCase().includes(search.toLowerCase());
      
      const matchesCareType = careTypeFilter === "all" || adminJobCategory(j) === careTypeFilter;
      const matchesCity = cityFilter === "all" || j.location_city === cityFilter;
      const createdDate = j.created_at.slice(0, 10);
      const matchesDate = (!dateFrom || createdDate >= dateFrom) && (!dateTo || createdDate <= dateTo);
      const matchesStatus = statusFilter === "all" || adminJobStatus(j) === statusFilter;

      return matchesSearch && matchesCareType && matchesCity && matchesDate && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === "created_at") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else {
        const budgetA = a.budget_max ?? a.budget_min ?? 0;
        const budgetB = b.budget_max ?? b.budget_min ?? 0;
        return budgetB - budgetA;
      }
    });

  const budgetedJobs = filteredJobs.filter(
    (job) => job.budget_min != null || job.budget_max != null,
  );
  const averageBudget = budgetedJobs.length
    ? Math.round(
        budgetedJobs.reduce(
          (sum, job) => sum + (job.budget_max ?? job.budget_min ?? 0),
          0,
        ) / budgetedJobs.length,
      )
    : 0;
  const rankedUsers = (
    role: "client" | "freelancer",
  ) => Object.values(
    filteredJobs.reduce<Record<string, {
      id: string;
      name: string;
      photo: string | null;
      verified: boolean;
      count: number;
    }>>((acc, job) => {
      const id = role === "client" ? job.client_id : job.selected_freelancer_id;
      const person = role === "client" ? job.client : job.freelancer;
      if (!id) return acc;
      const current = acc[id] || {
        id,
        name: person?.full_name || "Unknown",
        photo: person?.photo_url || null,
        verified: person?.is_verified === true,
        count: 0,
      };
      current.count += 1;
      acc[id] = current;
      return acc;
    }, {}),
  ).sort((a, b) => b.count - a.count);
  const topClient = rankedUsers("client")[0];
  const topFreelancer = rankedUsers("freelancer")[0];

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
      setSummaryJobs((current) =>
        current
          ? { ...current, jobs: current.jobs.filter((item) => item.id !== job.id) }
          : null,
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to delete job.");
    }
  };

  const exportCSV = () => {
    if (filteredJobs.length === 0) return;
    const csvRows = [
      ["Job ID", "Client Name", "Care Type", "City", "Status", "Stage", "Budget Max/hr", "Created At"],
      ...filteredJobs.map((j) => [
        j.id,
        j.client?.full_name || "N/A",
        j.care_type,
        j.location_city,
        j.status,
        j.stage || "N/A",
        adminJobBudget(j),
        j.created_at
      ])
    ];

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.map(val => `"${val}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "requested_jobs_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return <AdminPageSkeleton columns={6} />;
  }

  return (
    <div className="admin-page admin-table-page min-h-screen bg-zinc-100 dark:bg-zinc-950 pb-10">
      <div className="w-full px-4 py-6 lg:px-6 xl:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <Clock className="h-8 w-8 text-amber-500" /> Requested Jobs Dashboard
            </h1>
          </div>

          <button
            onClick={exportCSV}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm font-semibold rounded-xl transition-all shadow-xs"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl border-0 bg-white shadow-xs dark:bg-zinc-900">
            <CardHeader className="px-4 pb-1 pt-3">
              <CardDescription className="text-[10px] font-bold uppercase tracking-wider">Requested Jobs</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-3 text-3xl font-extrabold text-amber-500">{filteredJobs.length}</CardContent>
          </Card>
          <Card className="rounded-2xl border-0 bg-white shadow-xs dark:bg-zinc-900">
            <CardHeader className="px-4 pb-1 pt-3">
              <CardDescription className="text-[10px] font-bold uppercase tracking-wider">Average Budget</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-3 text-3xl font-extrabold">₪{averageBudget}</CardContent>
          </Card>
          {([
            { person: topClient, role: "client" as const, label: "Most Jobs as Client" },
            { person: topFreelancer, role: "freelancer" as const, label: "Most Jobs as Freelancer" },
          ]).map(({ person, role, label }) => (
            <Card
              key={role}
              role="button"
              tabIndex={person ? 0 : -1}
              onClick={() => person && setSummaryJobs({
                title: `${person.name} · Requested jobs as ${role}`,
                jobs: filteredJobs.filter((job) =>
                  role === "client"
                    ? job.client_id === person.id
                    : job.selected_freelancer_id === person.id,
                ),
              })}
              className="cursor-pointer rounded-2xl border-0 bg-white shadow-xs transition-shadow hover:shadow-md dark:bg-zinc-900"
            >
              <CardHeader className="px-4 pb-1 pt-3">
                <CardDescription className="text-[10px] font-bold uppercase tracking-wider">{label}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-2.5 px-4 pb-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={person?.photo || undefined} />
                  <AvatarFallback>{person?.name?.[0] || "—"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <span className="flex items-center gap-1 truncate text-lg font-extrabold">
                    {person?.name || "—"}
                    {person?.verified && <BadgeCheck className="h-4 w-4 shrink-0 fill-sky-500 text-white dark:text-zinc-900" aria-label="Verified" />}
                  </span>
                  <span className="text-xs font-semibold text-zinc-500">{person ? `${person.count} requested jobs` : "No requested jobs"}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter controls */}
        <div className="admin-filter-panel grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-3 mb-6 p-0">
          <div className="relative col-span-1 lg:col-span-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Search by client, city or ID..."
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
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2.5 text-sm bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl">
            <option value="all">All Statuses</option>
            <option value="In process">In process</option>
            <option value="Cancelled">Cancelled</option>
          </select>

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
              <p className="text-zinc-500 dark:text-zinc-400 font-medium">No requested jobs matching filters.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="admin-table-panel bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden">
            <div className="admin-table-scroll overflow-auto">
              <table className="w-full min-w-[1180px] border-collapse text-left text-sm text-zinc-600 dark:text-zinc-300">
                <thead className="bg-zinc-50/75 dark:bg-zinc-950/75 border-b border-zinc-200 dark:border-zinc-800/80 text-[11px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Job ID</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Client</th>
                    <th className="px-6 py-4">Freelancer</th>
                    <th className="px-6 py-4">Location</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Cancelled reason</th>
                    <th className="px-6 py-4">Requested Date</th>
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
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-zinc-900 dark:text-zinc-50 capitalize group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
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

                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {job.freelancer?.full_name || (job.latest_cancellation ? "Previously matched" : "Unassigned")}
                      </td>

                      {/* Location */}
                      <td className="px-6 py-4 whitespace-nowrap text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                        {adminCityLabel(job.location_city)}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">{adminJobStatus(job)}</td>
                      <td className="px-6 py-4 text-sm">{adminJobCancellationReason(job)}</td>

                      {/* Requested Date */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-zinc-400 dark:text-zinc-500 font-semibold">
                        {format(new Date(job.created_at), "MMM d, yyyy")}
                      </td>

                      {/* Budget */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                          {adminJobBudget(job)}
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
            <DialogDescription>{summaryJobs?.jobs.length || 0} requested jobs, sorted by category.</DialogDescription>
          </div>
          <div className="overflow-auto p-5">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Client</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Requested</th>
                  <th className="px-3 py-3 text-right">Budget</th>
                  <th className="w-12 px-3 py-3" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {[...(summaryJobs?.jobs || [])]
                  .sort((a, b) => adminJobCategory(a).localeCompare(adminJobCategory(b)))
                  .map((summaryJob) => (
                    <tr key={summaryJob.id}>
                      <td className="px-3 py-3 font-semibold">{adminJobCategory(summaryJob)}</td>
                      <td className="px-3 py-3">{summaryJob.client?.full_name || "Unknown"}</td>
                      <td className="px-3 py-3">{adminJobStatus(summaryJob)}</td>
                      <td className="px-3 py-3 text-zinc-500">{format(new Date(summaryJob.created_at), "MMM d, yyyy")}</td>
                      <td className="px-3 py-3 text-right font-bold">{adminJobBudget(summaryJob)}</td>
                      <td className="px-3 py-3 text-right">
                        <details className="relative inline-block" data-admin-job-actions>
                          <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 [&::-webkit-details-marker]:hidden">
                            <MoreVertical className="h-5 w-5" />
                          </summary>
                          <div className="absolute right-0 top-0 z-50 w-44 rounded-xl bg-white p-1.5 text-left shadow-xl ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10">
                            <button
                              type="button"
                              onClick={(event) => {
                                handleOpenJob(summaryJob);
                                event.currentTarget.closest("details")?.removeAttribute("open");
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-700"
                            >
                              <Settings className="h-4 w-4" /> Open job
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteJob(summaryJob)}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              <Trash className="h-4 w-4" /> Delete job
                            </button>
                          </div>
                        </details>
                      </td>
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
