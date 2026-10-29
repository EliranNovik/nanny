import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Briefcase, Search, ArrowUpDown, Download, Eye, MoreVertical } from "lucide-react";
import { getAdminData, getCachedAdminData } from "@/lib/adminDataCache";
import { JobDetailsDialog } from "@/components/admin/JobDetailsDialog";
import { useProgressiveList } from "@/hooks/useProgressiveList";
import { AdminPageSkeleton } from "@/components/admin/AdminPageSkeleton";
import { postServiceCategoryLabel } from "@/lib/serviceCategories";
import { adminCityLabel } from "@/lib/adminCityLabel";
import { format } from "date-fns";

interface Job {
  id: string;
  status: string;
  stage: string | null;
  care_type: string | null;
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
  shift_hours?: string | null;
  confirm_starts_at?: string | null;
  confirm_ends_at?: string | null;
  notes?: string | null;
  client?: {
    id: string;
    full_name: string | null;
    photo_url: string | null;
  };
  freelancer?: {
    id: string;
    full_name: string | null;
    photo_url: string | null;
  };
}

function jobCategory(job: Job): string {
  const detail =
    job.service_details?.other_type ||
    job.service_details?.custom_category ||
    job.service_details?.subcategory;
  return postServiceCategoryLabel(job.service_type || job.care_type, detail);
}

export default function AdminActiveJobsPage() {
  const cachedJobs = getCachedAdminData<{ jobs: Job[] }>("dashboard")?.jobs;
  const [jobs, setJobs] = useState<Job[]>(() =>
    (cachedJobs || []).filter((j) => j.status === "locked" || j.status === "active"),
  );
  const [loading, setLoading] = useState(!cachedJobs);
  const [search, setSearch] = useState("");
  const [careTypeFilter, setCareTypeFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"created_at" | "budget">("created_at");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, []);

  async function fetchJobs() {
    if (!getCachedAdminData("dashboard")) setLoading(true);
    try {
      const data = await getAdminData<{ jobs: Job[] }>("dashboard", "/api/admin/dashboard");
      // Filter for active/locked jobs
      const active = data.jobs.filter((j) => j.status === "locked" || j.status === "active");
      setJobs(active);
    } catch (error) {
      console.error("Error loading active jobs:", error);
    } finally {
      setLoading(false);
    }
  }

  // Get unique cities and categories for filtering
  const cities = Array.from(new Set(jobs.map((j) => j.location_city).filter((c): c is string => !!c)));
  const careTypes = Array.from(new Set(jobs.map(jobCategory))).sort();

  // Filter & Sort
  const filteredJobs = jobs
    .filter((j) => {
      const matchesSearch =
        (j.client?.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (j.freelancer?.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
        j.id.includes(search) ||
        (j.location_city || "").toLowerCase().includes(search.toLowerCase());
      
      const matchesCareType = careTypeFilter === "all" || jobCategory(j) === careTypeFilter;
      const matchesCity = cityFilter === "all" || j.location_city === cityFilter;

      return matchesSearch && matchesCareType && matchesCity;
    })
    .sort((a, b) => {
      if (sortBy === "created_at") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else {
        const budgetA = a.budget_max || 0;
        const budgetB = b.budget_max || 0;
        return budgetB - budgetA;
      }
    });

  const {
    visibleItems: paginatedJobs,
    hasMore,
    sentinelRef,
  } = useProgressiveList(filteredJobs, 24);

  const handleOpenJob = (job: Job) => {
    setSelectedJob(job);
    setIsModalOpen(true);
  };

  const exportCSV = () => {
    if (filteredJobs.length === 0) return;
    const csvRows = [
      ["Job ID", "Client", "Freelancer", "Category", "Location", "Status", "Created"],
      ...filteredJobs.map((j) => [
        j.id,
        j.client?.full_name || "N/A",
        j.freelancer?.full_name || "Unassigned",
        jobCategory(j),
        adminCityLabel(j.location_city),
        "In process",
        j.created_at
      ])
    ];

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.map(val => `"${val}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "active_jobs_export.csv");
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
              <Briefcase className="h-8 w-8 text-emerald-500" /> Active Jobs Dashboard
            </h1>
          </div>

          <button
            onClick={exportCSV}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm font-semibold rounded-xl transition-all shadow-xs"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>

        {/* Filter controls */}
        <div className="admin-filter-panel grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6 p-0">
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
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

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
              <p className="text-zinc-500 dark:text-zinc-400 font-medium">No active assignments matching filters.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="admin-table-panel bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden">
            <div className="admin-table-scroll overflow-auto">
              <table className="w-full min-w-[1180px] border-collapse text-left text-sm text-zinc-600 dark:text-zinc-300">
                <thead className="bg-zinc-50/75 dark:bg-zinc-950/75 border-b border-zinc-200 dark:border-zinc-800/80 text-[11px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Client</th>
                    <th className="px-6 py-4">Freelancer</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Location</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Cancelled reason</th>
                    <th className="px-6 py-4">Created</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-250/10 dark:divide-zinc-800/80">
                  {paginatedJobs.map((job) => (
                    <tr
                      key={job.id}
                      onClick={() => handleOpenJob(job)}
                      className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer"
                    >
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

                      {/* Freelancer */}
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

                      <td className="px-6 py-4 whitespace-nowrap font-medium text-zinc-900 dark:text-zinc-50">
                        {jobCategory(job)}
                      </td>

                      {/* Location */}
                      <td className="px-6 py-4 whitespace-nowrap text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                        {adminCityLabel(job.location_city)}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap font-semibold">In process</td>
                      <td className="px-6 py-4 whitespace-nowrap text-zinc-400">—</td>
                      <td className="px-6 py-4 whitespace-nowrap text-zinc-500">
                        {format(new Date(job.created_at), "MMM d, yyyy")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right" onClick={(event) => event.stopPropagation()}>
                        <details className="relative inline-block text-left">
                          <summary
                            className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 [&::-webkit-details-marker]:hidden"
                            aria-label="Job actions"
                          >
                            <MoreVertical className="h-5 w-5" />
                          </summary>
                          <div className="absolute right-0 z-30 mt-2 w-40 overflow-hidden rounded-xl bg-white p-1.5 shadow-xl ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10">
                            <button
                              type="button"
                              onClick={(event) => {
                                handleOpenJob(job);
                                event.currentTarget.closest("details")?.removeAttribute("open");
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-700"
                            >
                              <Eye className="h-4 w-4" /> View
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

      <JobDetailsDialog
        job={selectedJob}
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        onRefresh={fetchJobs}
      />
    </div>
  );
}
