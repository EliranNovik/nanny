import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Briefcase, Search, ArrowUpDown, Download } from "lucide-react";
import { apiGet } from "@/lib/api";
import { getJobStageBadge } from "@/lib/jobStages";
import { JobDetailsDialog } from "@/components/admin/JobDetailsDialog";

interface Job {
  id: string;
  status: string;
  stage: string | null;
  care_type: string | null;
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

export default function AdminActiveJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [careTypeFilter, setCareTypeFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"created_at" | "budget">("created_at");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    fetchJobs();
  }, []);

  async function fetchJobs() {
    setLoading(true);
    try {
      const data = await apiGet<{ jobs: Job[] }>("/api/admin/dashboard");
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
  const careTypes = Array.from(new Set(jobs.map((j) => j.care_type).filter((t): t is string => !!t)));

  // Filter & Sort
  const filteredJobs = jobs
    .filter((j) => {
      const matchesSearch =
        (j.client?.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (j.freelancer?.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
        j.id.includes(search) ||
        (j.location_city || "").toLowerCase().includes(search.toLowerCase());
      
      const matchesCareType = careTypeFilter === "all" || j.care_type === careTypeFilter;
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

  // Pagination
  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);
  const paginatedJobs = filteredJobs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleOpenJob = (job: Job) => {
    setSelectedJob(job);
    setIsModalOpen(true);
  };

  const exportCSV = () => {
    if (filteredJobs.length === 0) return;
    const csvRows = [
      ["Job ID", "Client Name", "Freelancer Name", "Care Type", "City", "Stage", "Budget Max/hr", "Created At"],
      ...filteredJobs.map((j) => [
        j.id,
        j.client?.full_name || "N/A",
        j.freelancer?.full_name || "Unassigned",
        j.care_type,
        j.location_city,
        j.stage || "N/A",
        j.budget_max || "N/A",
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-8 h-8 border-4 border-zinc-900 dark:border-zinc-100 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-10">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <Briefcase className="h-8 w-8 text-emerald-500" /> Active Jobs Dashboard
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              Monitor active work assignments and match execution pipelines
            </p>
          </div>

          <button
            onClick={exportCSV}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm font-semibold rounded-xl transition-all shadow-xs"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>

        {/* Filter controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 p-4 rounded-2xl shadow-xs">
          <div className="relative col-span-1 lg:col-span-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Search by client, helper, city or ID..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <select
              value={careTypeFilter}
              onChange={(e) => { setCareTypeFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2.5 text-sm bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
            >
              <option value="all">All Care Categories</option>
              {careTypes.map((type) => (
                <option key={type} value={type} className="capitalize">
                  {type.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={cityFilter}
              onChange={(e) => { setCityFilter(e.target.value); setCurrentPage(1); }}
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
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm text-zinc-600 dark:text-zinc-300">
                <thead className="bg-zinc-50/75 dark:bg-zinc-950/75 border-b border-zinc-200 dark:border-zinc-800/80 text-[11px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">ID / Status</th>
                    <th className="px-6 py-4">Care Category</th>
                    <th className="px-6 py-4">Client</th>
                    <th className="px-6 py-4">Helper</th>
                    <th className="px-6 py-4">Location</th>
                    <th className="px-6 py-4 text-right">Budget / Stage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-250/10 dark:divide-zinc-800/80">
                  {paginatedJobs.map((job) => (
                    <tr
                      key={job.id}
                      onClick={() => handleOpenJob(job)}
                      className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer"
                    >
                      {/* ID & Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-mono text-zinc-450 dark:text-zinc-500 uppercase tracking-wider">
                            ID: {job.id.substring(0, 8)}
                          </span>
                          <Badge variant={job.status === "active" ? "default" : "secondary"} className="rounded-full font-semibold text-[10px] px-2 py-0.5 w-max">
                            {job.status}
                          </Badge>
                        </div>
                      </td>

                      {/* Care Type */}
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-zinc-900 dark:text-zinc-50 capitalize group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {job.care_type?.replace("_", " ") || "N/A"}
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
                        {job.location_city}
                      </td>

                      {/* Budget & Stage */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                            {job.budget_max ? `$${job.budget_max}/hr` : "No rate spec"}
                          </span>
                          {job.stage && (
                            <Badge variant={getJobStageBadge(job.stage).variant} className="text-[9px] font-bold rounded-md px-1.5 py-0.5">
                              {getJobStageBadge(job.stage).label}
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-10">
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-4 py-2 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
            >
              Previous
            </button>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
            >
              Next
            </button>
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
